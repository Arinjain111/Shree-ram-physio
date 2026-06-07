import { ipcMain } from 'electron';
import { getPrismaClient } from '../database/prisma';
import { logError, logWarning } from '../utils/errorLogger';
import { logger } from '../utils/logger';
import { getCached, setCache, clearCache } from '../utils/readCache';
import axios from '../services/http'
import { getBackendUrl } from '../config/backend';

export function registerInvoiceHandlers() {
  const prisma = getPrismaClient();
  const backendUrl = getBackendUrl();

  function normalizeUhid(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  function normalizePhone(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

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

      const uhid = normalizeUhid(validatedData.patient.uhid);
      const phone = normalizePhone(validatedData.patient.phone);

      // Check if patient exists or create new
      let patient = null as any;

      if (uhid) {
        patient = await prisma.patient.findUnique({
          where: { uhid }
        });
      } else if (validatedData.patient.cloudId) {
        patient = await prisma.patient.findFirst({
          where: { cloudId: validatedData.patient.cloudId }
        });
      } else if (phone) {
        // Best-effort match when UHID is absent.
        patient = await prisma.patient.findFirst({
          where: {
            firstName: validatedData.patient.firstName,
            lastName: validatedData.patient.lastName,
            phone
          }
        });
      }

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
            ...(uhid ? { uhid } : {}),
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
            ...(uhid ? { uhid } : {}),
            syncStatus: 'PENDING'
          }
        });
      }

      // Convert total to number if it's a string
      const totalAmount = typeof validatedData.total === 'string'
        ? parseFloat(validatedData.total)
        : validatedData.total;
      const discountAmount = typeof validatedData.discount === 'string'
        ? parseFloat(validatedData.discount) || 0
        : (validatedData.discount ?? 0);

      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: validatedData.invoiceNumber,
          patientId: patient.id,
          date: validatedData.date,
          diagnosis: validatedData.diagnosis || '',
          notes: validatedData.notes || '',
          paymentMethod: validatedData.paymentMethod || 'Cash',
          TransactionId: validatedData.TransactionId || null,
          total: totalAmount,
          discount: discountAmount,
          discountType: validatedData.discountType || 'amount',
          paymentStatus: validatedData.amountPaid && validatedData.amountPaid >= totalAmount
            ? 'paid'
            : validatedData.amountPaid && validatedData.amountPaid > 0
              ? 'partial'
              : 'unpaid',
          amountPaid: validatedData.amountPaid ?? 0,
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

      clearCache('invoices');
      return { success: true, invoiceId: invoice.id };
    } catch (error) {
      logError('Save invoice', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('load-invoices', async (_event, options?: { page?: number; pageSize?: number }) => {
    try {
      const cacheKey = `invoices:${options?.page || 0}:${options?.pageSize || 0}`;
      const cached = getCached(cacheKey);
      if (cached) return cached;
      if (!prisma) {
        throw new Error('Prisma not initialized');
      }

      const page = options?.page && options.page > 0 ? options.page : undefined;
      const pageSize = options?.pageSize && options.pageSize > 0 ? options.pageSize : undefined;

      const invoices = await prisma.invoice.findMany({
        include: {
          patient: true,
          treatments: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        ...(page !== undefined && pageSize !== undefined
          ? { skip: (page - 1) * pageSize, take: pageSize }
          : {}),
      });

      const total = await prisma.invoice.count();

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
        notes: invoice.notes,
        paymentMethod: invoice.paymentMethod,
        TransactionId: invoice.TransactionId,
        treatments: invoice.treatments.map(t => ({
          name: t.name,
          duration: t.duration,
          sessions: t.sessions,
          startDate: t.startDate,
          endDate: t.endDate,
          amount: t.amount
        })),
        total: invoice.total,
        discount: invoice.discount ?? 0,
        discountType: invoice.discountType || 'amount',
        paymentStatus: invoice.paymentStatus,
        amountPaid: invoice.amountPaid,
        syncStatus: invoice.syncStatus,
        cloudId: invoice.cloudId,
        lastSyncAt: invoice.lastSyncAt
      }));

      const result = {
        success: true as const,
        invoices: formattedInvoices,
        total,
        page: page ?? 1,
        pageSize: pageSize ?? total,
        totalPages: pageSize ? Math.ceil(total / pageSize) : 1,
      };
      setCache(cacheKey, result);
      return result;
    } catch (error) {
      logError('Load invoices', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-invoice', async (_event, invoiceId: number) => {
    try {
      if (!prisma) {
        throw new Error('Prisma not initialized');
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { patient: true, treatments: true }
      });

      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      return {
        success: true,
        invoice: {
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
          notes: invoice.notes,
          paymentMethod: invoice.paymentMethod,
          total: invoice.total,
          discount: invoice.discount ?? 0,
          discountType: invoice.discountType || 'amount',
          amountPaid: invoice.amountPaid,
          paymentStatus: invoice.paymentStatus,
          syncStatus: invoice.syncStatus,
          cloudId: invoice.cloudId,
          lastSyncAt: invoice.lastSyncAt,
          treatments: invoice.treatments.map(t => ({
            name: t.name,
            duration: t.duration,
            sessions: t.sessions,
            startDate: t.startDate,
            endDate: t.endDate,
            amount: t.amount
          }))
        }
      };
    } catch (error) {
      logError('Get invoice', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('update-invoice', async (_event, invoiceId: number, invoiceData: any) => {
    try {
      if (!prisma) {
        throw new Error('Prisma not initialized');
      }

      const existing = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, patientId: true, syncStatus: true }
      });

      if (!existing) {
        return { success: false, error: 'Invoice not found' };
      }

      // Safety: avoid mutating invoices that are already synced.
      if (existing.syncStatus === 'SYNCED') {
        return { success: false, error: 'This invoice is already synced. Please duplicate/reissue instead of editing.' };
      }

      const { InvoiceDataSchema, validateData } = await import('../../src/schemas/validation.schema');
      const validation = validateData(InvoiceDataSchema, invoiceData);
      if (!validation.success) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      const validatedData = validation.data;
      const uhid = normalizeUhid(validatedData.patient.uhid);
      const phone = normalizePhone(validatedData.patient.phone);

      const totalAmount = typeof validatedData.total === 'string'
        ? parseFloat(validatedData.total)
        : validatedData.total;
      const discountAmount = typeof validatedData.discount === 'string'
        ? parseFloat(validatedData.discount) || 0
        : (validatedData.discount ?? 0);

      await prisma.$transaction(async (tx) => {
        // Update patient info (associated with this invoice)
        await tx.patient.update({
          where: { id: existing.patientId },
          data: {
            firstName: validatedData.patient.firstName,
            lastName: validatedData.patient.lastName,
            age: validatedData.patient.age,
            gender: validatedData.patient.gender,
            phone: phone || validatedData.patient.phone,
            ...(uhid ? { uhid } : {}),
            syncStatus: 'PENDING'
          }
        });

        // Update invoice
        await tx.invoice.update({
          where: { id: existing.id },
          data: {
            invoiceNumber: validatedData.invoiceNumber,
            date: validatedData.date,
            diagnosis: validatedData.diagnosis || '',
            notes: validatedData.notes || '',
            paymentMethod: validatedData.paymentMethod || 'Cash',
            TransactionId: validatedData.TransactionId || null,
          total: totalAmount,
          discount: discountAmount,
          discountType: validatedData.discountType || 'amount',
          paymentStatus: validatedData.amountPaid && validatedData.amountPaid >= totalAmount
            ? 'paid'
            : validatedData.amountPaid && validatedData.amountPaid > 0
              ? 'partial'
              : validatedData.paymentStatus || 'unpaid',
          amountPaid: validatedData.amountPaid ?? 0,
          syncStatus: 'PENDING',
          lastSyncAt: null
          }
        });

        // Replace treatments
        await tx.treatment.deleteMany({ where: { invoiceId: existing.id } });
        for (const treatment of validatedData.treatments) {
          await tx.treatment.create({
            data: {
              invoiceId: existing.id,
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
      });

      clearCache('invoices');
      return { success: true, invoiceId };
    } catch (error) {
      logError('Update invoice', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('delete-invoice', async (_event, invoiceId: number, target: 'local' | 'cloud' | 'both') => {
    try {
      if (!prisma) {
        throw new Error('Prisma not initialized');
      }

      const result = { local: false, cloud: false, errors: [] as string[] };
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

      if (!invoice) {
        return { success: false, error: 'Invoice not found locally' };
      }

      // 1. Delete from Cloud
      if (target === 'cloud' || target === 'both') {
        try {
          if (invoice.cloudId) {
            await axios.delete(`${backendUrl}/api/invoices/${invoice.cloudId}`);
            result.cloud = true;
          } else {
            throw new Error('Invoice not synced to cloud (no Cloud ID)');
          }
        } catch (e: any) {
          const status = e?.response?.status;
          const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Cloud delete failed';
          logger.error('invoices', 'Cloud delete failed', { error: msg, status, invoiceId: invoice.id });
          result.errors.push(`Cloud${status ? ` (${status})` : ''}: ${msg}`);
        }
      }

      // 2. Delete from Local
      if (target === 'local' || target === 'both') {
        try {
          if (target === 'both' && !result.cloud) {
             throw new Error('Skipped local delete because cloud delete failed');
          }
          await prisma.$transaction(async (tx) => {
            await tx.treatment.deleteMany({ where: { invoiceId: invoice.id } });
            await tx.invoice.delete({ where: { id: invoice.id } });

            // If this was the patient's last invoice, delete the orphaned patient
            const patientId = invoice.patientId;
            const remainingInvoices = await tx.invoice.count({ where: { patientId } });
            if (remainingInvoices === 0) {
              await tx.patient.delete({ where: { id: patientId } });
            }
          });
          result.local = true;
        } catch (e: any) {
          logger.error('invoices', 'Local delete failed', { error: e?.message ?? String(e), invoiceId: invoice.id });
          result.errors.push(`Local: ${e.message}`);
        }
      }

      const success = target === 'local'
        ? result.local
        : target === 'cloud'
          ? result.cloud
          : (result.local && result.cloud);

      return { success, ...result, error: result.errors.length ? result.errors.join(' | ') : undefined };
    } catch (error) {
      logError('Delete invoice', error);
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

  ipcMain.handle('record-payment', async (_event, invoiceId: number, amount: number, method?: string) => {
    try {
      if (!prisma) throw new Error('Prisma not initialized');

      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) return { success: false, error: 'Invoice not found' };

      const newAmountPaid = Math.min(invoice.amountPaid + amount, invoice.total);
      const newStatus = newAmountPaid >= invoice.total ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid';

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          paymentStatus: newStatus,
          paymentMethod: method || invoice.paymentMethod,
          syncStatus: 'PENDING',
        },
      });

      clearCache('invoices');
      return { success: true, amountPaid: newAmountPaid, paymentStatus: newStatus };
    } catch (error) {
      logError('Record payment', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-billing-summary', async () => {
    try {
      if (!prisma) throw new Error('Prisma not initialized');

      const today = new Date().toISOString().split('T')[0];
      const allInvoices = await prisma.invoice.findMany({
        include: { patient: true, treatments: true },
        orderBy: { createdAt: 'desc' },
      });

      // Compute corrected payment status in-memory only (no DB writes during reads)
      const withCorrectedStatus = allInvoices.map(inv => {
        const amountDue = inv.total - inv.amountPaid;
        const isOverdue = amountDue > 0 && new Date(inv.date).toISOString().split('T')[0] < today;
        const correctStatus = isOverdue
          ? 'overdue'
          : inv.amountPaid >= inv.total
            ? 'paid'
            : inv.amountPaid > 0
              ? 'partial'
              : 'unpaid';
        return { ...inv, paymentStatus: correctStatus };
      });

      const overdueInvoices = withCorrectedStatus.filter(
        i => (i.paymentStatus === 'unpaid' || i.paymentStatus === 'partial' || i.paymentStatus === 'overdue')
          && new Date(i.date).toISOString().split('T')[0] < today
          && (i.total - i.amountPaid) > 0
      );

      const formatted = withCorrectedStatus.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        total: inv.total,
        amountPaid: inv.amountPaid,
        paymentStatus: inv.paymentStatus,
        patientName: `${inv.patient.firstName} ${inv.patient.lastName}`,
      }));

      const totalOutstanding = overdueInvoices.reduce((s, i) => s + (i.total - i.amountPaid), 0);

      return {
        success: true,
        totalOutstanding,
        overdueCount: overdueInvoices.length,
        totalCollected: allInvoices.filter(i => i.paymentStatus === 'paid').reduce((s, i) => s + i.total, 0),
        overdueInvoices: formatted.filter(i => i.paymentStatus === 'overdue' || (i.paymentStatus !== 'paid' && new Date(i.date).toISOString().split('T')[0] < today)),
        invoices: formatted,
      };
    } catch (error) {
      logError('Get billing summary', error);
      return { success: false, error: String(error) };
    }
  });
}
