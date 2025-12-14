import { Router } from 'express';
import {
  getAllInvoices,
  getInvoiceById,
  getInvoicesByPatient,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getNextInvoiceNumber
} from '../controllers/invoice';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/invoices/next-number - Get next available invoice number
router.get('/next-number', asyncHandler(getNextInvoiceNumber));

// GET /api/invoices - Get all invoices
router.get('/', asyncHandler(getAllInvoices));

// GET /api/invoices/:id - Get invoice by ID
router.get('/:id', asyncHandler(getInvoiceById));

// GET /api/invoices/patient/:patientId - Get invoices by patient ID
router.get('/patient/:patientId', asyncHandler(getInvoicesByPatient));

// POST /api/invoices - Create new invoice with treatments
router.post('/', asyncHandler(createInvoice));

// PUT /api/invoices/:id - Update invoice
router.put('/:id', asyncHandler(updateInvoice));

// DELETE /api/invoices/:id - Delete invoice
router.delete('/:id', asyncHandler(deleteInvoice));

export default router;
