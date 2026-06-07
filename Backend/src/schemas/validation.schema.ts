/**
 * Backend Zod Validation Schemas
 * Single source of truth for all data validation
 * These schemas validate data coming from external sources (Frontend sync, API requests)
 */

import { z, type ZodIssue } from 'zod';
import { ApiError } from '../middleware/errorHandler';

const OptionalUhidSchema = z.union([z.string().max(50), z.literal('')]).optional().nullable();

export const ValidDateStringSchema = z.union([
  z.date(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Date must be a valid ISO string or YYYY-MM-DD')
]).transform(val => typeof val === 'string' ? new Date(val) : val)

export const ValidFutureDateStringSchema = z.union([
  z.date(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Date must be a valid ISO string or YYYY-MM-DD')
]).transform(val => typeof val === 'string' ? new Date(val) : val)

// ============================================
// BASE SCHEMAS - Core data types
// ============================================

/**
 * Patient Schema - Validates patient data
 */
export const PatientSchema = z.object({
  id: z.number().int().positive().optional(), // Optional for creation
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(50),
  age: z.number().int().min(0).max(150),
  gender: z.enum(['Male', 'Female', 'Other']),
  phone: z.union([z.string().max(15), z.literal('')]),
  uhid: OptionalUhidSchema,
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type Patient = z.infer<typeof PatientSchema>;

/**
 * Invoice Schema - Validates invoice data
 */
export const InvoiceSchema = z.object({
  id: z.number().int().positive().optional(),
  invoiceNumber: z.string()
    .regex(/^\d{4}$/, 'Invoice number must be 4 digits')
    .min(1, 'Invoice number is required'),
  patientId: z.number().int().positive(),
  date: ValidDateStringSchema,
  diagnosis: z.string().max(500).default(''),
  notes: z.string().max(1000).default(''),
  paymentMethod: z.enum(['Cash', 'Card', 'UPI', 'Online', 'Cheque']).default('Cash'),
  TransactionId: z.string().max(100).optional(),
  total: z.number().min(0, 'Total must be positive'),
  discount: z.number().min(0).default(0),
  discountType: z.enum(['amount', 'percentage']).default('amount'),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;

/**
 * Treatment Schema - Validates treatment data
 */
export const TreatmentSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1, 'Treatment name is required').max(100),
  invoiceId: z.number().int().positive(),
  duration: z.string().max(100).default(''),
  sessions: z.number().int().min(1, 'At least 1 session required'),
  startDate: ValidFutureDateStringSchema,
  endDate: ValidFutureDateStringSchema,
  amount: z.number().min(0, 'Amount must be positive'),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type Treatment = z.infer<typeof TreatmentSchema>;

// ============================================
// SYNC SCHEMAS - For sync operations
// ============================================

/**
 * Patient Sync Schema - Patient data during sync
 */
export const PatientSyncSchema = z.object({
  id: z.number().int().positive().optional(),
  cloudId: z.number().int().positive().nullish(),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(50),
  age: z.number().int().min(0).max(150),
  gender: z.enum(['Male', 'Female', 'Other']),
  phone: z.union([z.string().max(15), z.literal('')]),
  uhid: OptionalUhidSchema,
  updatedAt: z.iso.datetime().optional(),
});

export type PatientSync = z.infer<typeof PatientSyncSchema>;

/**
 * Invoice Sync Schema - Invoice data during sync
 */
export const InvoiceSyncSchema = z.object({
  id: z.number().int().positive().optional(),
  cloudId: z.number().int().positive().nullish(),
  patientCloudId: z.number().int().positive().nullish(),
  invoiceNumber: z.string()
    .regex(/^\d{4}$/, 'Invoice number must be 4 digits')
    .min(1, 'Invoice number is required'),
  patientId: z.number().int().positive(),
  date: ValidDateStringSchema,
  diagnosis: z.string().max(500).nullish(),
  notes: z.string().max(1000).nullish(),
  paymentMethod: z.enum(['Cash', 'Card', 'UPI', 'Online', 'Cheque']).nullish(),
  TransactionId: z.string().max(100).nullish(),
  total: z.number().min(0, 'Total must be positive'),
  discount: z.number().min(0).default(0),
  discountType: z.enum(['amount', 'percentage']).default('amount'),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid', 'overdue']).optional(),
  amountPaid: z.number().min(0).optional(),
  updatedAt: z.iso.datetime().optional(),
}).transform(data => ({
  ...data,
  diagnosis: data.diagnosis || '',
  notes: data.notes || '',
  paymentMethod: data.paymentMethod || 'Cash',
  TransactionId: data.TransactionId || null,
  paymentStatus: data.paymentStatus || 'unpaid',
  amountPaid: data.amountPaid ?? 0,
}));

export type InvoiceSync = z.infer<typeof InvoiceSyncSchema>;

/**
 * Treatment Sync Schema - Treatment data during sync
 */
export const TreatmentSyncSchema = z.object({
  id: z.number().int().positive().optional(),
  cloudId: z.number().int().positive().nullish(),
  invoiceCloudId: z.number().int().positive().nullish(),
  invoiceId: z.number().int().positive(),
  name: z.string().min(1, 'Treatment name is required').max(100),
  duration: z.string().max(100).nullish(),
  sessions: z.number().int().min(1, 'At least 1 session required'),
  startDate: ValidFutureDateStringSchema,
  endDate: ValidFutureDateStringSchema,
  amount: z.number().min(0, 'Amount must be positive'),
  updatedAt: z.iso.datetime().optional(),
}).transform(data => ({
  ...data,
  duration: data.duration || ''
}));

export type TreatmentSync = z.infer<typeof TreatmentSyncSchema>;

/**
 * Inventory Item Sync Schema — item data during sync
 */
export const InventoryItemSyncSchema = z.object({
  id: z.number().int().positive().optional(),
  cloudId: z.number().int().positive().nullish(),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(500).nullish(),
  stock: z.number().int().min(0).default(0),
  costPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  updatedAt: z.iso.datetime().optional(),
});

export type InventoryItemSync = z.infer<typeof InventoryItemSyncSchema>;

/**
 * Inventory Transaction Sync Schema — transaction data during sync
 */
export const InventoryTransactionSyncSchema = z.object({
  id: z.number().int().positive().optional(),
  cloudId: z.number().int().positive().nullish(),
  itemCloudId: z.number().int().positive().nullish(),
  itemId: z.number().int().positive(),
  type: z.enum(['PURCHASE', 'SALE', 'ADJUSTMENT']),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  pricePerUnit: z.number().min(0),
  totalAmount: z.number().min(0),
  date: ValidDateStringSchema,
  notes: z.string().max(500).nullish(),
  updatedAt: z.iso.datetime().optional(),
});

export type InventoryTransactionSync = z.infer<typeof InventoryTransactionSyncSchema>;

// ============================================
// REQUEST SCHEMAS - API request validation
// ============================================

/**
 * Sync Request Schema - Validates incoming sync requests
 */
export const SyncRequestSchema = z.object({
  lastSyncTime: z.union([z.iso.datetime(), z.null()]).optional(),
  patients: z.array(PatientSyncSchema).max(500, 'Maximum 500 patients per sync batch').optional(),
  invoices: z.array(InvoiceSyncSchema).max(1000, 'Maximum 1000 invoices per sync batch').optional(),
  treatments: z.array(TreatmentSyncSchema).max(2000, 'Maximum 2000 treatments per sync batch').optional(),
  inventoryItems: z.array(InventoryItemSyncSchema).max(500, 'Maximum 500 inventory items per sync batch').optional(),
  inventoryTransactions: z.array(InventoryTransactionSyncSchema).max(2000, 'Maximum 2000 inventory transactions per sync batch').optional(),
});

export type SyncRequest = z.infer<typeof SyncRequestSchema>;

/**
 * Create Invoice Request Schema
 */
export const TreatmentInputSchema = z.object({
  name: z.string().min(1, 'Treatment name is required'),
  duration: z.string().optional(),
  sessions: z.number().int().min(1, 'At least 1 session required'),
  startDate: ValidFutureDateStringSchema,
  endDate: ValidFutureDateStringSchema,
  amount: z.number().min(0, 'Amount must be positive'),
});

export type TreatmentInput = z.infer<typeof TreatmentInputSchema>;

export const CreateInvoiceRequestSchema = z.object({
  invoiceNumber: z.string().regex(/^\d{4}$/, 'Invoice number must be 4 digits'),
  patientId: z.number().int().positive(),
  date: ValidDateStringSchema,
  diagnosis: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  paymentMethod: z.enum(['Cash', 'Card', 'UPI', 'Online', 'Cheque']).optional(),
  TransactionId: z.string().max(100).optional(),
  total: z.number().min(0),
  discount: z.number().min(0).default(0),
  discountType: z.enum(['amount', 'percentage']).default('amount'),
  paymentStatus: z.enum(['paid', 'partial', 'unpaid', 'overdue']).optional(),
  amountPaid: z.number().min(0).optional(),
  treatments: z.array(TreatmentInputSchema).optional(),
});

export type CreateInvoiceRequest = z.infer<typeof CreateInvoiceRequestSchema>;

/**
 * Create Patient Request Schema
 */
export const CreatePatientRequestSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(50),
  age: z.number().int().min(0).max(150),
  gender: z.enum(['Male', 'Female', 'Other']),
  phone: z.union([z.string().min(10).max(15), z.literal('')]),
  uhid: OptionalUhidSchema,
});

export type CreatePatientRequest = z.infer<typeof CreatePatientRequestSchema>;

/**
 * Preset Sync Schema - Validates bulk preset sync items
 */
export const PresetSyncSchema = z.object({
  name: z.string().min(1, 'Preset name is required').max(200),
  defaultSessions: z.number().int().min(1, 'At least 1 session required'),
  pricePerSession: z.number().min(0, 'Price must be positive'),
});

export const PresetSyncRequestSchema = z.object({
  presets: z.array(PresetSyncSchema).max(200, 'Maximum 200 presets per sync batch'),
});

export type PresetSyncRequest = z.infer<typeof PresetSyncRequestSchema>;

// ============================================
// RESPONSE SCHEMAS - API response validation
// ============================================

/**
 * Sync Response Schema
 */
export const SyncResponseSchema = z.object({
  synced: z.object({
    patients: z.array(
      z.object({
        localId: z.number().int().optional(),
        cloudId: z.number().int(),
      })
    ),
    invoices: z.array(
      z.object({
        localId: z.number().int().optional(),
        cloudId: z.number().int(),
        originalNumber: z.string().optional(),
        newNumber: z.string().optional(),
      })
    ),
    treatments: z.array(
      z.object({
        localId: z.number().int().optional(),
        cloudId: z.number().int(),
      })
    ),
  }),
  updates: z.object({
    patients: z.array(PatientSchema),
    invoices: z.array(InvoiceSchema),
    treatments: z.array(TreatmentSchema),
  }),
  conflicts: z.array(
    z.object({
      localId: z.number().int().optional(),
      originalNumber: z.string(),
      newNumber: z.string(),
      reason: z.string(),
    })
  ).optional(),
});

export type SyncResponse = z.infer<typeof SyncResponseSchema>;

/**
 * Next Invoice Number Response Schema
 */
export const NextInvoiceNumberResponseSchema = z.object({
  success: z.boolean(),
  invoiceNumber: z.string().regex(/^\d{4}$/),
});

export type NextInvoiceNumberResponse = z.infer<typeof NextInvoiceNumberResponseSchema>;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Safe parse with detailed error messages
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map((err: ZodIssue) => 
    `${err.path.join('.')}: ${err.message}`
  );
  
  return { success: false, errors };
}

/**
 * Validate and throw on error
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((err: ZodIssue) =>
      `${err.path.join('.')}: ${err.message}`
    );

    throw new ApiError(400, 'Validation failed', {
      code: 'VALIDATION_ERROR',
      details: { errors },
    });
  }

  return result.data;
}
