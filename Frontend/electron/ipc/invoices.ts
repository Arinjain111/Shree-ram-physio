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
      let backendNextNumber = 0;

      // 1. Try to fetch from backend with patient context
      try {
        const query = new URLSearchParams();
        if (patientData?.cloudId) {
          query.append('patientCloudId', patientData.cloudId.toString());
        } else if (patientData?.id) {
          query.append('patientId', patientData.id.toString());
        }
        
        const url = `${backendUrl}/api/invoices/next-number?${query.toString()}`;
        const response = await axios.get(url, {
          timeout: 3000 // Short timeout to not block UI
        });

        if (response.data.success && response.data.invoiceNumber) {
          // Assume numeric 0001 format
          const match = response.data.invoiceNumber.match(/(\d+)$/);
          if (match) {
            backendNextNumber = parseInt(match[1], 10);
          }
        }
      } catch (e) {
        logWarning('Invoice number', 'Backend unavailable, checking local ONLY');
      }

      // 2. Check Local Database - also per patient
      if (!prisma) {
        throw new Error('Prisma not initialized');
      }

      let lastInvoice;
      if (patientData?.id) {
        // Get last invoice for this specific patient
        lastInvoice = await prisma.invoice.findFirst({
          where: { patientId: patientData.id },
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
      const nextNumVal = Math.max(backendNextNumber, localMax + 1);
      const nextNumber = nextNumVal.toString().padStart(4, '0');

      return {
        success: true,
        invoiceNumber: nextNumber,
        source: nextNumVal > backendNextNumber ? 'local-conflict-resolved' : 'backend',
        patientId: patientData?.id
      };

    } catch (error) {
      logError('Invoice number', error);
      // Fallback
      return {
        success: false,
        error: String(error),
        invoiceNumber: '0001',
        source: 'fallback'
      };
    }
  });
}
