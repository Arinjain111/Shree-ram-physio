import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { SyncRequestSchema, validateOrThrow, type SyncRequest, type PatientSync, type InvoiceSync, type TreatmentSync } from '../schemas/validation.schema';
import { logger } from '../utils/logger';

interface SyncResult {
  synced: {
    patients: Array<{ localId?: number; cloudId: number }>;
    invoices: Array<{ localId?: number; cloudId: number; originalNumber?: string; newNumber?: string }>;
    treatments: Array<{ localId?: number; cloudId: number }>;
  };
  updates: {
    patients: Array<{ id: number; firstName: string; lastName: string; age: number; gender: string; phone: string; uhid: string | null; createdAt: Date; updatedAt: Date }>;
    invoices: Array<{ id: number; invoiceNumber: string; patientId: number; date: Date; diagnosis: string; notes: string; paymentMethod: string; TransactionId: string | null; total: number; createdAt: Date; updatedAt: Date; patient: { id: number; firstName: string; lastName: string; age: number; gender: string; phone: string; uhid: string | null; createdAt: Date; updatedAt: Date }; treatments: Array<{ id: number; invoiceId: number; name: string; duration: string; sessions: number; startDate: Date; endDate: Date; amount: number; createdAt: Date; updatedAt: Date }> }>;
    treatments: Array<{ id: number; invoiceId: number; name: string; duration: string; sessions: number; startDate: Date; endDate: Date; amount: number; createdAt: Date; updatedAt: Date }>;
  };
  conflicts: Array<{ localId?: number; originalNumber: string; newNumber: string; reason: string }>;
}

function normalizeUhid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const syncData = async (req: Request, res: Response) => {
  const log = logger.child({ fields: { endpoint: 'sync' } });
  log.debug('sync', 'Request received');

  try {
    const { lastSyncTime, patients, invoices, treatments } = validateOrThrow<SyncRequest>(
      SyncRequestSchema,
      req.body
    );

    log.info('sync', 'Sync request received', {
      incoming: {
        patients: patients?.length || 0,
        invoices: invoices?.length || 0,
        treatments: treatments?.length || 0,
      },
      mode: lastSyncTime ? 'incremental' : 'full',
    });

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

        // Four-way match so the same patient never duplicates:
        //   1) cloudId is set              -> upsert by id (fast path, fresh sync)
        //   2) cloudId is null, UHID set   -> upsert by uhid (recover from previous failed
        //                                      syncs where the local row never received a cloudId)
        //   3) cloudId is null, no UHID,
        //      and a (firstName, lastName, phone) match exists
        //                                   -> update the existing row (dedup by identity)
        //   4) truly new patient           -> plain create
        // (Cases 3 prevents the sync loop where two local rows with the same name/phone
        // would otherwise each create their own cloud row, then both come back as
        // separate cloud rows and the client would create two more local rows, etc.)
        let cloudPatient;
        if (p.cloudId) {
          cloudPatient = await prisma.patient.upsert({
            where: { id: p.cloudId },
            update: patientData,
            create: patientData,
          });
        } else if (uhid) {
          cloudPatient = await prisma.patient.upsert({
            where: { uhid },
            update: patientData,
            create: patientData,
          });
        } else {
          const existingByIdentity = await prisma.patient.findFirst({
            where: {
              firstName: p.firstName,
              lastName: p.lastName,
              phone: p.phone,
            },
          });
          if (existingByIdentity) {
            cloudPatient = await prisma.patient.update({
              where: { id: existingByIdentity.id },
              data: patientData,
            });
          } else {
            cloudPatient = await prisma.patient.create({ data: patientData });
          }
        }

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
      try {
        const invoice = inv as InvoiceSync;
        const resolvedPatientId =
          invoice.patientCloudId || (invoice.patientId ? patientIdMap.get(invoice.patientId) : undefined);

        if (!resolvedPatientId) {
          log.warn('sync', 'Cannot resolve patient ID for invoice', { invoiceNumber: invoice.invoiceNumber });
          continue;
        }

        // Verify patient exists before trying to create/update invoice
        const patientExists = await prisma.patient.findUnique({ where: { id: resolvedPatientId }, select: { id: true } });
        if (!patientExists) {
          log.warn('sync', 'Patient not found for invoice, skipping', { patientId: resolvedPatientId, invoiceNumber: invoice.invoiceNumber });
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
          discount: invoice.discount ?? 0,
          discountType: invoice.discountType || 'amount',
          paymentStatus: invoice.paymentStatus || 'unpaid',
          amountPaid: invoice.amountPaid ?? 0,
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
            log.warn('sync', 'Duplicate invoice for patient (conflict)', { patientId: resolvedPatientId, invoiceNumber: invoice.invoiceNumber });

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
      } catch (err) {
        log.error('sync', 'Failed to sync invoice', {
          invoiceNumber: (inv as any)?.invoiceNumber,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue with next invoice instead of failing the entire batch
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
        log.warn('sync', 'Cannot resolve invoice ID for treatment', { name: treatment.name });
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

      // Three-way match (mirrors the patient dedup):
      //   1) cloudId is set                              -> upsert by id
      //   2) cloudId is null, but the same (invoiceId, name, sessions, amount)
      //      already exists in the cloud
      //                                                  -> update that row (dedup by identity)
      //   3) truly new treatment                         -> create
      // (Case 2 prevents the same bug we had for patients: when a local treatment
      // is uploaded with cloudId=null and a network blip causes a retry, the
      // old code created a duplicate cloud row. With the dedup the retry is
      // a no-op update.)
      let cloudTreatment;
      if (treatment.cloudId) {
        cloudTreatment = await prisma.treatment.upsert({
          where: { id: treatment.cloudId },
          update: treatmentData,
          create: treatmentData,
        });
      } else {
        const existingByIdentity = await prisma.treatment.findFirst({
          where: {
            invoiceId: resolvedInvoiceId,
            name: treatment.name,
            sessions: treatment.sessions,
            amount: treatment.amount,
          },
        });
        if (existingByIdentity) {
          cloudTreatment = await prisma.treatment.update({
            where: { id: existingByIdentity.id },
            data: treatmentData,
          });
        } else {
          cloudTreatment = await prisma.treatment.create({ data: treatmentData });
        }
      }

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

  log.debug('sync', lastSyncTime ? 'Fetching incremental updates' : 'Fetching full cloud snapshot', { since: lastSyncTime });

  // Get updated patients
  result.updates.patients = await prisma.patient.findMany({
    where: whereClause,
    orderBy: {
      updatedAt: 'desc',
    },
  });

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

  // Get updated treatments
  result.updates.treatments = await prisma.treatment.findMany({
    where: whereClause,
    orderBy: {
      updatedAt: 'desc',
    },
  });

  log.info('sync', 'Sync completed', {
    synced: {
      patients: result.synced.patients.length,
      invoices: result.synced.invoices.length,
      treatments: result.synced.treatments.length,
    },
    updates: {
      patients: result.updates.patients.length,
      invoices: result.updates.invoices.length,
      treatments: result.updates.treatments.length,
    },
    conflicts: result.conflicts.length,
  });

  res.json({
    success: true,
    ...result,
  });
  } catch (error) {
    // Re-throw so the central error handler can render the response.
    // We still log here for visibility since sync errors are common and
    // worth tracking separately from generic 500s.
    log.error('sync', 'Sync failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
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
    logger.error('sync', 'Failed to fetch sync status', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sync status'
    });
  }
};
