import { ipcMain } from 'electron';
import { getPrismaClient } from '../database/prisma';
import { logError, logWarning } from '../utils/errorLogger';
import axios from '../services/http'
import { getBackendUrl } from '../config/backend';

export function registerInvoiceHandlers() {
  const prisma = getPrismaClient();
  const backendUrl = getBackendUrl();

  ipcMain.handle('save-invoice', async (_event, invoiceData: any) => {
    try {
      if (!prisma) {
        throw new Error('Prisma not initialized');
      }

      // Validate invoice data using Zod
      // Fix import path to point to src directory
      const { InvoiceDataSchema, validateData } = await import('../../src/schemas/validation.schema');
      const validation = validateData(InvoiceDataSchema, invoiceData);

      if (!validation.success) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      const validatedData = validation.data;

      // Check if patient exists or create new
      let patient = await prisma.patient.findUnique({
        where: { uhid: validatedData.patient.uhid }
      });

      if (patient) {
        // Update patient info if changed
        patient = await prisma.patient.update({
          where: { id: patient.id },
          data: {
            firstName: validatedData.patient.firstName,
            lastName: validatedData.patient.lastName,
            age: validatedData.patient.age,
            gender: validatedData.patient.gender,
            phone: validatedData.patient.phone,
            syncStatus: 'PENDING'
          }
        });
      } else {
        // Create new patient
        patient = await prisma.patient.create({
          data: {
            firstName: validatedData.patient.firstName,
            lastName: validatedData.patient.lastName,
            age: validatedData.patient.age,
            gender: validatedData.patient.gender,
            phone: validatedData.patient.phone,
            uhid: validatedData.patient.uhid,
            syncStatus: 'PENDING'
          }
        });
      }

      // Convert total to number if it's a string
      const totalAmount = typeof validatedData.total === 'string'
        ? parseFloat(validatedData.total)
        : validatedData.total;

      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: validatedData.invoiceNumber,
          patientId: patient.id,
          date: validatedData.date,
          diagnosis: validatedData.diagnosis || '',
          notes: validatedData.notes || '',
          paymentMethod: validatedData.paymentMethod || 'Cash',
          total: totalAmount,
          syncStatus: 'PENDING'
        }
      });

      // Create treatments
      for (const treatment of validatedData.treatments) {
        await prisma.treatment.create({
          data: {
            invoiceId: invoice.id,
            name: treatment.name,
            duration: treatment.duration || '',
            sessions: treatment.sessions,
            startDate: treatment.startDate,
            endDate: treatment.endDate,
            amount: treatment.amount,
            syncStatus: 'PENDING'
          }
        });
      }

      return { success: true, invoiceId: invoice.id };
    } catch (error) {
      logError('Save invoice', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('load-invoices', async () => {
    try {
      if (!prisma) {
        throw new Error('Prisma not initialized');
      }

      const invoices = await prisma.invoice.findMany({
        include: {
          patient: true,
          treatments: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const formattedInvoices = invoices.map(invoice => ({
        id: invoice.id,
        patientId: invoice.patientId,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        patient: {
          id: invoice.patient.id,
          firstName: invoice.patient.firstName,
          lastName: invoice.patient.lastName,
          age: invoice.patient.age,
          gender: invoice.patient.gender,
          phone: invoice.patient.phone,
          uhid: invoice.patient.uhid,
          syncStatus: invoice.patient.syncStatus,
          cloudId: invoice.patient.cloudId
        },
        diagnosis: invoice.diagnosis,
        treatments: invoice.treatments.map(t => ({
          name: t.name,
          sessions: t.sessions,
          startDate: t.startDate,
          endDate: t.endDate,
          amount: t.amount
        })),
        total: invoice.total,
        syncStatus: invoice.syncStatus,
        cloudId: invoice.cloudId,
        lastSyncAt: invoice.lastSyncAt
      }));

      return { success: true, invoices: formattedInvoices };
    } catch (error) {
      logError('Load invoices', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-next-invoice-number', async (_event, patientData?: { id?: number; cloudId?: number }) => {
    try {
      const minimumInvoiceNumber = 401;
      let backendNextNumber = 0;
      let backendAvailable = false;
      let backendAttempted = false;
      let checkedUrl: string | undefined;
      let backendErrorStatus: number | undefined;
      let backendErrorMessage: string | undefined;

      // 1. Try to fetch from backend with patient context
      try {
        // Backend expects `patientId` (its own DB id).
        // In our local DB, `cloudId` maps to backend Patient.id.
        // Do NOT send local sqlite `id` to backend.
        const backendPatientId = patientData?.cloudId;

        if (backendPatientId) {
          backendAttempted = true;
          const query = new URLSearchParams({ patientId: backendPatientId.toString() });
          const url = `${backendUrl}/api/invoices/next-number?${query.toString()}`;
          checkedUrl = url;

          const response = await axios.get(url, {
            timeout: 3000 // Short timeout to not block UI
          });

          if (response.data?.success && response.data?.invoiceNumber != null) {
            const raw = String(response.data.invoiceNumber);
            const match = raw.match(/(\d+)$/);
            if (match) {
              backendNextNumber = parseInt(match[1], 10);
              backendAvailable = true;
            }
          }
        }
      } catch (e) {
        const anyErr: any = e;
        backendErrorStatus = anyErr?.response?.status;
        backendErrorMessage =
          anyErr?.response?.data?.message ||
          anyErr?.response?.data?.error ||
          anyErr?.message ||
          'Backend request failed';

        const msg = backendErrorStatus === 429
          ? `Rate limited (${checkedUrl || backendUrl}): ${backendErrorMessage}`
          : (checkedUrl
              ? `Backend unavailable (${checkedUrl}); checking local only`
              : 'Backend unavailable; checking local only');

        logWarning('Invoice number', msg);
      }

      // 2. Check Local Database - also per patient
      if (!prisma) {
        throw new Error('Prisma not initialized');
      }

      // Resolve a local patientId when we only have cloudId.
      // Without this, local checks fall back to global max invoice number.
      let localPatientId: number | undefined = patientData?.id;
      if (!localPatientId && patientData?.cloudId) {
        const localPatient = await prisma.patient.findFirst({
          where: { cloudId: patientData.cloudId },
          select: { id: true }
        });
        localPatientId = localPatient?.id;
      }

      let lastInvoice;
      if (localPatientId) {
        // Get last invoice for this specific patient
        lastInvoice = await prisma.invoice.findFirst({
          where: { patientId: localPatientId },
          orderBy: { invoiceNumber: 'desc' },
          select: { invoiceNumber: true }
        });
      } else {
        // Fallback: get highest invoice overall
        lastInvoice = await prisma.invoice.findFirst({
          orderBy: { invoiceNumber: 'desc' },
          select: { invoiceNumber: true }
        });
      }

      let localMax = 0;
      if (lastInvoice && lastInvoice.invoiceNumber) {
        const match = lastInvoice.invoiceNumber.match(/(\d+)$/);
        if (match) {
          localMax = parseInt(match[1], 10);
        }
      }

      // 3. Determine actual next number
      const nextNumVal = Math.max(backendNextNumber, localMax + 1, minimumInvoiceNumber);
      const nextNumber = nextNumVal.toString().padStart(4, '0');

      const minIsDriving = nextNumVal === minimumInvoiceNumber && backendNextNumber < minimumInvoiceNumber && localMax + 1 < minimumInvoiceNumber;
      const source = !backendAttempted
        ? (minIsDriving ? 'minimum' : 'local-only')
        : !backendAvailable
          ? (minIsDriving ? 'minimum' : 'backend-unavailable-local')
          : (nextNumVal === backendNextNumber ? 'backend' : 'local-conflict-resolved');

      return {
        success: true,
        invoiceNumber: nextNumber,
        source,
        patientId: patientData?.id,
        backendUrl,
        checkedUrl,
        backendErrorStatus,
        backendErrorMessage
      };

    } catch (error) {
      logError('Invoice number', error);
      // Fallback
      return {
        success: false,
        error: String(error),
        invoiceNumber: '0401',
        source: 'fallback'
      };
    }
  });
}
