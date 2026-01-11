import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/errorHandler';
import { CreateInvoiceRequestSchema, validateOrThrow, type CreateInvoiceRequest } from '../schemas/validation.schema';

// Get next available invoice number for a patient
export const getNextInvoiceNumber = async (req: Request, res: Response) => {
  const { patientId } = req.query as { patientId?: number | string };

  if (!patientId) {
    throw new ApiError(400, 'patientId is required');
  }

  // Use transaction to ensure atomicity and prevent race conditions
  const nextNumber = await prisma.$transaction(async (tx) => {
    const resolvedPatientId = parseInt(patientId as string, 10);
    if (Number.isNaN(resolvedPatientId)) {
      throw new ApiError(400, 'Invalid patientId', { code: 'INVALID_PATIENT_ID' });
    }

    // Get the highest invoice number for THIS PATIENT
    const lastInvoice = await tx.invoice.findFirst({
      where: { patientId: resolvedPatientId },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true }
    });

    let maxNum = 0;
    if (lastInvoice && lastInvoice.invoiceNumber) {
      // Extract numeric part (handles formats like "0001", "0042", etc.)
      const match = lastInvoice.invoiceNumber.match(/^\d+$/);
      if (match) {
        maxNum = parseInt(match[0], 10);
      }
    }

    // Generate next number with padding (per patient)
    const nextNum = (maxNum + 1).toString().padStart(4, '0');
    return nextNum;
  });

  res.json({
    success: true,
    invoiceNumber: nextNumber
  });
};

// Get all invoices
export const getAllInvoices = async (_req: Request, res: Response) => {
  const invoices = await prisma.invoice.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      patient: true,
      treatments: true
    }
  });

  res.json({
    success: true,
    invoices
  });
};

// Get invoice by ID
export const getInvoiceById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const invoiceId = parseInt(id as string, 10);
  if (Number.isNaN(invoiceId)) {
    throw new ApiError(400, 'Invalid invoice ID', { code: 'INVALID_INVOICE_ID' });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      patient: true,
      treatments: true
    }
  });

  if (!invoice) {
    throw new ApiError(404, 'Invoice not found', { code: 'INVOICE_NOT_FOUND' });
  }

  res.json({
    success: true,
    invoice
  });
};

// Get invoices by patient ID
export const getInvoicesByPatient = async (req: Request, res: Response) => {
  const { patientId } = req.params;

  const numericPatientId = parseInt(patientId as string, 10);
  if (Number.isNaN(numericPatientId)) {
    throw new ApiError(400, 'Invalid patient ID', { code: 'INVALID_PATIENT_ID' });
  }

  const invoices = await prisma.invoice.findMany({
    where: { patientId: numericPatientId },
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      patient: true,
      treatments: true
    }
  });

  res.json({
    success: true,
    invoices
  });
};

// Create invoice with treatments
export const createInvoice = async (req: Request, res: Response) => {
  // Validate request body using shared Zod schema
  const { invoiceNumber, patientId, date, diagnosis, total, treatments } = validateOrThrow<CreateInvoiceRequest>(
    CreateInvoiceRequestSchema,
    req.body
  );

  // Check if patient exists
  const patient = await prisma.patient.findUnique({
    where: { id: patientId }
  });

  if (!patient) {
    throw new ApiError(404, 'Patient not found', { code: 'PATIENT_NOT_FOUND' });
  }

  // Check if invoice number already exists for this patient
  const existingInvoice = await prisma.invoice.findUnique({
    where: { patientId_invoiceNumber: { patientId, invoiceNumber } }
  });

  if (existingInvoice) {
    throw new ApiError(409, 'Invoice with this number already exists', { code: 'DUPLICATE_INVOICE_NUMBER' });
  }

  // Create invoice with treatments
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      patientId,
      date,
      diagnosis: diagnosis || '',
      total,
      ...(treatments && treatments.length > 0
        ? {
            treatments: {
              create: treatments.map((t) => ({
                name: t.name,
                sessions: t.sessions,
                startDate: t.startDate,
                endDate: t.endDate,
                amount: t.amount,
              })),
            },
          }
        : {}),
    },
    include: {
      patient: true,
      treatments: true,
    },
  });

  res.status(201).json({
    success: true,
    invoice,
  });
};

// Update invoice
export const updateInvoice = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { invoiceNumber, patientId, date, diagnosis, total, treatments } = req.body;

  const invoiceId = parseInt(id as string, 10);
  if (Number.isNaN(invoiceId)) {
    throw new ApiError(400, 'Invalid invoice ID', { code: 'INVALID_INVOICE_ID' });
  }

  // Check if invoice exists
  const existingInvoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { treatments: true },
  });

  if (!existingInvoice) {
    throw new ApiError(404, 'Invoice not found', { code: 'INVOICE_NOT_FOUND' });
  }

  // If invoice number is being changed, check for conflicts
  if (invoiceNumber && invoiceNumber !== existingInvoice.invoiceNumber) {
    const numberConflict = await prisma.invoice.findUnique({
      where: { patientId_invoiceNumber: { patientId: existingInvoice.patientId, invoiceNumber } },
    });

    if (numberConflict) {
      throw new ApiError(409, 'Another invoice with this number already exists', { code: 'DUPLICATE_INVOICE_NUMBER' });
    }
  }

  // Update invoice and treatments in a transaction
  const invoice = await prisma.$transaction(async (tx) => {
    // Update invoice
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        ...(invoiceNumber && { invoiceNumber }),
        ...(patientId && { patientId: Number(patientId) }),
        ...(date && { date }),
        ...(diagnosis !== undefined && { diagnosis }),
        ...(total && { total: Number(total) }),
      },
    });

    // If treatments are provided, replace them
    if (treatments) {
      // Delete existing treatments
      await tx.treatment.deleteMany({
        where: { invoiceId },
      });

      // Create new treatments
      if (treatments.length > 0) {
        await tx.treatment.createMany({
          data: treatments.map((t: any) => ({
            invoiceId,
            name: t.name,
            sessions: Number(t.sessions),
            startDate: t.startDate,
            endDate: t.endDate,
            amount: Number(t.amount),
          })),
        });
      }
    }

    // Return updated invoice with relations
    return tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        patient: true,
        treatments: true,
      },
    });
  });

  res.json({
    success: true,
    invoice,
  });
};

// Delete invoice
export const deleteInvoice = async (req: Request, res: Response) => {
  const { id } = req.params;

  const invoiceId = parseInt(id as string, 10);
  if (Number.isNaN(invoiceId)) {
    throw new ApiError(400, 'Invalid invoice ID', { code: 'INVALID_INVOICE_ID' });
  }

  // Check if invoice exists
  const existingInvoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!existingInvoice) {
    throw new ApiError(404, 'Invoice not found', { code: 'INVOICE_NOT_FOUND' });
  }

  // Delete invoice and associated treatments (cascade)
  await prisma.invoice.delete({
    where: { id: invoiceId },
  });

  res.json({
    success: true,
    message: 'Invoice deleted successfully',
  });
};
