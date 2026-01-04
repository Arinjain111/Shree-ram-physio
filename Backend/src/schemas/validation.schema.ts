/**
 * Backend Zod Validation Schemas
 * Single source of truth for all data validation
 * These schemas validate data coming from external sources (Frontend sync, API requests)
 */

import { z } from 'zod';
import { ApiError } from '../middleware/errorHandler';

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
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
  uhid: z.string().min(1, 'UHID is required').max(50),
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
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  diagnosis: z.string().max(500).default(''),
  notes: z.string().max(1000).default(''),
  paymentMethod: z.enum(['Cash', 'Card', 'UPI', 'Online', 'Cheque']).default('Cash'),
  total: z.number().min(0, 'Total must be positive'),
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
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
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
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
  uhid: z.string().min(1, 'UHID is required').max(50),
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
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  diagnosis: z.string().max(500).nullish(),
  notes: z.string().max(1000).nullish(),
  paymentMethod: z.enum(['Cash', 'Card', 'UPI', 'Online', 'Cheque']).nullish(),
  total: z.number().min(0, 'Total must be positive'),
  updatedAt: z.iso.datetime().optional(),
}).transform(data => ({
  ...data,
  diagnosis: data.diagnosis || '',
  notes: data.notes || '',
  paymentMethod: data.paymentMethod || 'Cash'
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
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  amount: z.number().min(0, 'Amount must be positive'),
  updatedAt: z.iso.datetime().optional(),
}).transform(data => ({
  ...data,
  duration: data.duration || ''
}));

export type TreatmentSync = z.infer<typeof TreatmentSyncSchema>;

// ============================================
// REQUEST SCHEMAS - API request validation
// ============================================

/**
 * Sync Request Schema - Validates incoming sync requests
 */
export const SyncRequestSchema = z.object({
  lastSyncTime: z.union([z.iso.datetime(), z.null()]).optional(),
  patients: z.array(PatientSyncSchema).optional(),
  invoices: z.array(InvoiceSyncSchema).optional(),
  treatments: z.array(TreatmentSyncSchema).optional(),
});

export type SyncRequest = z.infer<typeof SyncRequestSchema>;

/**
 * Create Invoice Request Schema
 */
export const CreateInvoiceRequestSchema = z.object({
  invoiceNumber: z.string().regex(/^\d{4}$/, 'Invoice number must be 4 digits'),
  patientId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  diagnosis: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  paymentMethod: z.enum(['Cash', 'Card', 'UPI', 'Online', 'Cheque']).optional(),
  total: z.number().min(0),
  treatments: z.array(
    z.object({
      name: z.string().min(1),
      duration: z.string().optional(),
      sessions: z.number().int().min(1),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amount: z.number().min(0),
    })
  ).optional(),
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
  phone: z.string().min(10).max(15),
  uhid: z.string().min(1).max(50),
});

export type CreatePatientRequest = z.infer<typeof CreatePatientRequestSchema>;

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
  
  const errors = result.error.issues.map((err: z.core.$ZodIssue) => 
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
    const errors = result.error.issues.map((err: z.core.$ZodIssue) =>
      `${err.path.join('.')}: ${err.message}`
    );

    throw new ApiError(400, 'Validation failed', {
      code: 'VALIDATION_ERROR',
      details: { errors },
    });
  }

  return result.data;
}
