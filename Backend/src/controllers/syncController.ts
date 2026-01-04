import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { SyncRequestSchema, validateOrThrow, type SyncRequest } from '../schemas/validation.schema';

export const syncData = async (req: Request, res: Response) => {
  console.log('🔄 [SYNC START] /api/sync endpoint called');
  console.log(`📥 Request received at ${new Date().toISOString()}`);
  
  try {
    // Validate incoming sync request at schema level
    const { lastSyncTime, patients, invoices, treatments } = validateOrThrow<SyncRequest>(
      SyncRequestSchema,
      req.body
    );

    console.log(`📋 Received ${patients?.length || 0} patients, ${invoices?.length || 0} invoices, ${treatments?.length || 0} treatments to sync`);

    const result = {
      synced: {
        patients: [] as Array<{ localId?: number; cloudId: number }>,
        invoices: [] as Array<{ localId?: number; cloudId: number; originalNumber?: string; newNumber?: string }>,
        treatments: [] as Array<{ localId?: number; cloudId: number }>
      },
      updates: {
        patients: [] as any[],
        invoices: [] as any[],
        treatments: [] as any[]
      },
      conflicts: [] as Array<{ localId?: number; originalNumber: string; newNumber: string; reason: string }>
    };    // Map to track local ID -> cloud ID
  const patientIdMap = new Map<number, number>();
  const invoiceIdMap = new Map<number, number>();

  // === SYNC PATIENTS ===
  if (patients && patients.length > 0) {
    for (const patient of patients) {
      let cloudPatient;

      if (patient.cloudId) {
        // Update existing patient
        cloudPatient = await prisma.patient.upsert({
          where: { id: patient.cloudId },
          update: {
            firstName: patient.firstName,
            lastName: patient.lastName,
            age: patient.age,
            gender: patient.gender,
            phone: patient.phone,
            uhid: patient.uhid,
          },
          create: {
            firstName: patient.firstName,
            lastName: patient.lastName,
            age: patient.age,
            gender: patient.gender,
            phone: patient.phone,
            uhid: patient.uhid,
          },
        });
      } else {
        // Create new patient
        cloudPatient = await prisma.patient.create({
          data: {
            firstName: patient.firstName,
            lastName: patient.lastName,
            age: patient.age,
            gender: patient.gender,
            phone: patient.phone,
            uhid: patient.uhid,
          },
        });
      }

      if (patient.id) {
        patientIdMap.set(patient.id, cloudPatient.id);
      }

      const syncedPatient: { localId?: number; cloudId: number } = {
        cloudId: cloudPatient.id,
      };
      if (patient.id !== undefined) {
        syncedPatient.localId = patient.id;
      }
      result.synced.patients.push(syncedPatient);
    }
  }

  // === SYNC INVOICES ===
  if (invoices && invoices.length > 0) {
    for (const invoice of invoices) {
      // Resolve patient ID (use cloud ID or map from local ID)
      const resolvedPatientId =
        invoice.patientCloudId || (invoice.patientId ? patientIdMap.get(invoice.patientId) : undefined);

      if (!resolvedPatientId) {
        console.error(`Cannot resolve patient ID for invoice ${invoice.invoiceNumber}`);
        continue;
      }

      let cloudInvoice;

      if (invoice.cloudId) {
        // Update existing invoice
        cloudInvoice = await prisma.invoice.upsert({
          where: { id: invoice.cloudId },
          update: {
            invoiceNumber: invoice.invoiceNumber,
            patientId: resolvedPatientId,
            date: invoice.date,
            diagnosis: invoice.diagnosis || '',
            notes: invoice.notes || '',
            paymentMethod: invoice.paymentMethod || 'Cash',
            total: invoice.total,
          },
          create: {
            invoiceNumber: invoice.invoiceNumber,
            patientId: resolvedPatientId,
            date: invoice.date,
            diagnosis: invoice.diagnosis || '',
            notes: invoice.notes || '',
            paymentMethod: invoice.paymentMethod || 'Cash',
            total: invoice.total,
          },
        });
      } else {
        // Check for duplicate invoice number before creating
        const existingInvoice = await prisma.invoice.findUnique({
          where: { invoiceNumber: invoice.invoiceNumber },
        });

        if (existingInvoice) {
          // CONFLICT: Invoice number already exists, generate new number
          console.warn(`Conflict detected: Invoice ${invoice.invoiceNumber} already exists`);

          // Get next available invoice number
          const lastInvoice = await prisma.invoice.findFirst({
            orderBy: { invoiceNumber: 'desc' },
            select: { invoiceNumber: true },
          });

          let maxNum = 0;
          if (lastInvoice && lastInvoice.invoiceNumber) {
            const match = lastInvoice.invoiceNumber.match(/^\d+$/);
            if (match) {
              maxNum = parseInt(match[0], 10);
            }
          }

          const newInvoiceNumber = (maxNum + 1).toString().padStart(4, '0');

          // Create invoice with new number
          cloudInvoice = await prisma.invoice.create({
            data: {
              invoiceNumber: newInvoiceNumber,
              patientId: resolvedPatientId,
              date: invoice.date,
              diagnosis: invoice.diagnosis || '',
              notes: invoice.notes || '',
              paymentMethod: invoice.paymentMethod || 'Cash',
              total: invoice.total,
            },
          });

          // Record conflict
          const conflict: { localId?: number; originalNumber: string; newNumber: string; reason: string } = {
            originalNumber: invoice.invoiceNumber,
            newNumber: newInvoiceNumber,
            reason: 'DUPLICATE_INVOICE_NUMBER',
          };
          if (invoice.id !== undefined) {
            conflict.localId = invoice.id;
          }
          result.conflicts.push(conflict);

          // Add to synced with both numbers for frontend update
          const syncedInvoice: { localId?: number; cloudId: number; originalNumber?: string; newNumber?: string } = {
            cloudId: cloudInvoice.id,
            originalNumber: invoice.invoiceNumber,
            newNumber: newInvoiceNumber,
          };
          if (invoice.id !== undefined) {
            syncedInvoice.localId = invoice.id;
          }
          result.synced.invoices.push(syncedInvoice);
        } else {
          // Create new invoice with original number
          cloudInvoice = await prisma.invoice.create({
            data: {
              invoiceNumber: invoice.invoiceNumber,
              patientId: resolvedPatientId,
              date: invoice.date,
              diagnosis: invoice.diagnosis || '',
              notes: invoice.notes || '',
              paymentMethod: invoice.paymentMethod || 'Cash',
              total: invoice.total,
            },
          });

          const syncedInvoice: { localId?: number; cloudId: number } = {
            cloudId: cloudInvoice.id,
          };
          if (invoice.id !== undefined) {
            syncedInvoice.localId = invoice.id;
          }
          result.synced.invoices.push(syncedInvoice);
        }
      }

      if (invoice.id && cloudInvoice) {
        invoiceIdMap.set(invoice.id, cloudInvoice.id);
      }
    }
  }

  // === SYNC TREATMENTS ===
  if (treatments && treatments.length > 0) {
    for (const treatment of treatments) {
      // Resolve invoice ID (use cloud ID or map from local ID)
      const resolvedInvoiceId =
        treatment.invoiceCloudId || (treatment.invoiceId ? invoiceIdMap.get(treatment.invoiceId) : undefined);

      if (!resolvedInvoiceId) {
        console.error(`Cannot resolve invoice ID for treatment ${treatment.name}`);
        continue;
      }

      let cloudTreatment;

      if (treatment.cloudId) {
        // Update existing treatment
        cloudTreatment = await prisma.treatment.upsert({
          where: { id: treatment.cloudId },
          update: {
            invoiceId: resolvedInvoiceId,
            name: treatment.name,
            duration: treatment.duration || '',
            sessions: treatment.sessions,
            startDate: treatment.startDate,
            endDate: treatment.endDate,
            amount: treatment.amount,
          },
          create: {
            invoiceId: resolvedInvoiceId,
            name: treatment.name,
            duration: treatment.duration || '',
            sessions: treatment.sessions,
            startDate: treatment.startDate,
            endDate: treatment.endDate,
            amount: treatment.amount,
          },
        });
      } else {
        // Create new treatment
        cloudTreatment = await prisma.treatment.create({
          data: {
            invoiceId: resolvedInvoiceId,
            name: treatment.name,
            duration: treatment.duration || '',
            sessions: treatment.sessions,
            startDate: treatment.startDate,
            endDate: treatment.endDate,
            amount: treatment.amount,
          },
        });
      }

      const syncedTreatment: { localId?: number; cloudId: number } = {
        cloudId: cloudTreatment.id,
      };
      if (treatment.id !== undefined) {
        syncedTreatment.localId = treatment.id;
      }
      result.synced.treatments.push(syncedTreatment);
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
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during sync'
    });
  }
};

export const getSyncStatus = async (req: Request, res: Response) => {
  // Use cacheStrategy with Prisma Accelerate to reduce DB load
  // TTL: 60 seconds (results cached for 1 min)
  // SWR: 60 seconds (serve stale result for another 1 min while fetching new)
  const cacheStrategy = { ttl: 60, swr: 60 };

  try {
    const [lastPatient, lastInvoice, lastTreatment] = await Promise.all([
      prisma.patient.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
        // @ts-ignore
        cacheStrategy,
      }),
      prisma.invoice.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
        // @ts-ignore
        cacheStrategy,
      }),
      prisma.treatment.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
        // @ts-ignore
        cacheStrategy,
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
