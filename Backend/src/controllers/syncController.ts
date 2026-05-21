import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { SyncRequestSchema, validateOrThrow, type SyncRequest, type PatientSync, type InvoiceSync, type TreatmentSync } from '../schemas/validation.schema';

interface SyncResult {
  synced: {
    patients: Array<{ localId?: number; cloudId: number }>;
    invoices: Array<{ localId?: number; cloudId: number; originalNumber?: string; newNumber?: string }>;
    treatments: Array<{ localId?: number; cloudId: number }>;
  };
  updates: {
    patients: Array<{ id: number; firstName: string; lastName: string; age: number; gender: string; phone: string; uhid: string | null; createdAt: Date; updatedAt: Date }>;
    invoices: Array<{ id: number; invoiceNumber: string; patientId: number; date: string; diagnosis: string; notes: string; paymentMethod: string; TransactionId: string | null; total: number; createdAt: Date; updatedAt: Date; patient: { id: number; firstName: string; lastName: string; age: number; gender: string; phone: string; uhid: string | null; createdAt: Date; updatedAt: Date }; treatments: Array<{ id: number; invoiceId: number; name: string; duration: string; sessions: number; startDate: string; endDate: string; amount: number; createdAt: Date; updatedAt: Date }> }>;
    treatments: Array<{ id: number; invoiceId: number; name: string; duration: string; sessions: number; startDate: string; endDate: string; amount: number; createdAt: Date; updatedAt: Date }>;
  };
  conflicts: Array<{ localId?: number; originalNumber: string; newNumber: string; reason: string }>;
}

function normalizeUhid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const syncData = async (req: Request, res: Response) => {
  console.log('🔄 [SYNC START] /api/sync endpoint called');
  console.log(`📥 Request received at ${new Date().toISOString()}`);
  
  try {
    const { lastSyncTime, patients, invoices, treatments } = validateOrThrow<SyncRequest>(
      SyncRequestSchema,
      req.body
    );

    console.log(`📋 Received ${patients?.length || 0} patients, ${invoices?.length || 0} invoices, ${treatments?.length || 0} treatments to sync`);

    const result: SyncResult = {
      synced: {
        patients: [],
        invoices: [],
        treatments: []
      },
      updates: {
        patients: [],
        invoices: [],
        treatments: []
      },
      conflicts: []
    };
    const patientIdMap = new Map<number, number>();
    const invoiceIdMap = new Map<number, number>();

    // === SYNC PATIENTS ===
    if (patients && patients.length > 0) {
      for (const patient of patients) {
        const p = patient as PatientSync;
        const uhid = normalizeUhid(p.uhid);
        const patientData = {
          firstName: p.firstName,
          lastName: p.lastName,
          age: p.age,
          gender: p.gender,
          phone: p.phone,
          ...(uhid ? { uhid } : {}),
        };

        const cloudPatient = p.cloudId
          ? await prisma.patient.upsert({
              where: { id: p.cloudId },
              update: patientData,
              create: patientData,
            })
          : await prisma.patient.create({ data: patientData });

        if (p.id) {
          patientIdMap.set(p.id, cloudPatient.id);
        }

        result.synced.patients.push({
          cloudId: cloudPatient.id,
          ...(p.id !== undefined ? { localId: p.id } : {}),
        });
      }
    }

  // === SYNC INVOICES ===
  if (invoices && invoices.length > 0) {
    for (const inv of invoices) {
      const invoice = inv as InvoiceSync;
      const resolvedPatientId =
        invoice.patientCloudId || (invoice.patientId ? patientIdMap.get(invoice.patientId) : undefined);

      if (!resolvedPatientId) {
        console.error(`Cannot resolve patient ID for invoice ${invoice.invoiceNumber}`);
        continue;
      }

      const invoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        patientId: resolvedPatientId,
        date: invoice.date,
        diagnosis: invoice.diagnosis || '',
        notes: invoice.notes || '',
        paymentMethod: invoice.paymentMethod || 'Cash',
        TransactionId: invoice.TransactionId || null,
        total: invoice.total,
      };

      if (invoice.cloudId) {
        const cloudInvoice = await prisma.invoice.upsert({
          where: { id: invoice.cloudId },
          update: invoiceData,
          create: invoiceData,
        });

        invoiceIdMap.set(invoice.id!, cloudInvoice.id);
      } else {
        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            invoiceNumber: invoice.invoiceNumber,
            patientId: resolvedPatientId
          },
        });

        if (existingInvoice) {
          console.warn(`⚠️ CONFLICT: Patient ${resolvedPatientId} already has Invoice #${invoice.invoiceNumber}`);
          
          const conflict: { localId?: number; originalNumber: string; newNumber: string; reason: string } = {
            reason: 'DUPLICATE_INVOICE_FOR_PATIENT',
            originalNumber: invoice.invoiceNumber,
            newNumber: invoice.invoiceNumber,
          };
          if (invoice.id !== undefined) {
            conflict.localId = invoice.id;
          }
          result.conflicts.push(conflict);
          continue;
        }

        const cloudInvoice = await prisma.invoice.create({ data: invoiceData });

        result.synced.invoices.push({
          cloudId: cloudInvoice.id,
          ...(invoice.id !== undefined ? { localId: invoice.id } : {}),
        });
        invoiceIdMap.set(invoice.id!, cloudInvoice.id);
      }
    }
  }
  // === SYNC TREATMENTS ===
  if (treatments && treatments.length > 0) {
    for (const tr of treatments) {
      const treatment = tr as TreatmentSync;
      const resolvedInvoiceId =
        treatment.invoiceCloudId || (treatment.invoiceId ? invoiceIdMap.get(treatment.invoiceId) : undefined);

      if (!resolvedInvoiceId) {
        console.error(`Cannot resolve invoice ID for treatment ${treatment.name}`);
        continue;
      }

      const treatmentData = {
        invoiceId: resolvedInvoiceId,
        name: treatment.name,
        duration: treatment.duration || '',
        sessions: treatment.sessions,
        startDate: treatment.startDate,
        endDate: treatment.endDate,
        amount: treatment.amount,
      };

      const cloudTreatment = treatment.cloudId
        ? await prisma.treatment.upsert({
            where: { id: treatment.cloudId },
            update: treatmentData,
            create: treatmentData,
          })
        : await prisma.treatment.create({ data: treatmentData });

      result.synced.treatments.push({
        cloudId: cloudTreatment.id,
        ...(treatment.id !== undefined ? { localId: treatment.id } : {}),
      });
    }
  }

  // === FETCH UPDATES FROM CLOUD ===
  // On first sync (no lastSyncTime), fetch ALL records
  // On subsequent syncs, only fetch records updated since last sync
  const whereClause = lastSyncTime
    ? {
      updatedAt: {
        gte: new Date(lastSyncTime),
      },
    }
    : {}; // Empty where clause = fetch all

  console.log(
    lastSyncTime ? `Fetching updates since ${lastSyncTime}` : 'First sync: Fetching ALL records from cloud'
  );

  // Get updated patients
  result.updates.patients = await prisma.patient.findMany({
    where: whereClause,
    orderBy: {
      updatedAt: 'desc',
    },
  });

  console.log(`📊 Fetched ${result.updates.patients.length} patients from database`);

  // Get updated invoices with relations
  result.updates.invoices = await prisma.invoice.findMany({
    where: whereClause,
    include: {
      patient: true,
      treatments: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  console.log(`📊 Fetched ${result.updates.invoices.length} invoices from database`);

  // Get updated treatments
  result.updates.treatments = await prisma.treatment.findMany({
    where: whereClause,
    orderBy: {
      updatedAt: 'desc',
    },
  });

  console.log(`📊 Fetched ${result.updates.treatments.length} treatments from database`);
  console.log(`📤 Sending response with synced: ${result.synced.patients.length}/${result.synced.invoices.length}/${result.synced.treatments.length}, updates: ${result.updates.patients.length}/${result.updates.invoices.length}/${result.updates.treatments.length}`);

  res.json({
    success: true,
    ...result,
  });
  } catch (error) {
    console.error('❌ [SYNC ERROR]', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Check if it's an ApiError (from validation)
    const isApiError = error && typeof error === 'object' && 'statusCode' in error;
    const statusCode = isApiError ? (error as any).statusCode || 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during sync',
      details: isApiError ? (error as any).details : undefined
    });
  }
};

export const getSyncStatus = async (req: Request, res: Response) => {
  try {
    const [lastPatient, lastInvoice, lastTreatment] = await Promise.all([
      prisma.patient.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      prisma.invoice.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      prisma.treatment.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    const timestamps = [
      lastPatient?.updatedAt,
      lastInvoice?.updatedAt,
      lastTreatment?.updatedAt
    ].filter((d): d is Date => !!d);

    const lastModified = timestamps.length > 0
      ? new Date(Math.max(...timestamps.map(d => d.getTime())))
      : new Date(0);

    res.json({
      success: true,
      lastModified: lastModified.toISOString()
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sync status'
    });
  }
};
