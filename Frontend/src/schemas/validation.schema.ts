/**
 * Frontend Zod Validation Schemas
 * Single source of truth for all data validation on frontend
 * These schemas validate data from user input and sync operations
 */

import { z } from 'zod';

// ============================================
// BASE SCHEMAS - Core data types
// ============================================

/**
 * Patient Schema - Validates patient data
 */
export const PatientSchema = z.object({
  id: z.number().int().positive().optional(), // Local ID
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(50),
  name: z.string().optional(), // Deprecated - for backward compatibility
  age: z.number().int().min(0, 'Age must be positive').max(150, 'Invalid age'),
  gender: z.enum(['Male', 'Female', 'Other']),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
  uhid: z.string().min(1, 'UHID is required').max(50),
  // Sync fields
  cloudId: z.number().int().positive().optional(),
  syncStatus: z.enum(['PENDING', 'SYNCED', 'CONFLICT']).default('PENDING'),
  lastSyncAt: z.date().optional().or(z.string().datetime().optional()),
  createdAt: z.date().optional().or(z.string().datetime().optional()),
  updatedAt: z.date().optional().or(z.string().datetime().optional()),
});

export type Patient = z.infer<typeof PatientSchema>;

/**
 * Patient Form Schema - For user input validation
 */
export const PatientFormSchema = z.object({
  id: z.number().int().optional(),
  cloudId: z.number().int().optional(),
  firstName: z.string()
    .min(1, 'First name is required')
    .max(100, 'First name must be less than 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes')
    .refine(val => !/\d/.test(val), 'First name cannot contain numbers')
    .refine(val => !/[eE][+-]?\d+/.test(val), 'First name cannot contain exponential notation'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z'-]+$/, 'Last name can only contain letters, hyphens, and apostrophes (no spaces)')
    .refine(val => !/\s/.test(val), 'Last name must be a single word (no spaces)')
    .refine(val => !/\d/.test(val), 'Last name cannot contain numbers')
    .refine(val => !/[eE][+-]?\d+/.test(val), 'Last name cannot contain exponential notation'),
  age: z.number()
    .int('Age must be a whole number')
    .min(0, 'Age must be positive')
    .max(100, 'Age cannot exceed 100 years')
    .refine(val => val.toString().length <= 3, 'Age must be maximum 3 digits'),
  gender: z.string().min(1, 'Gender is required'), // Keep as string to match old PatientInfo type
  phone: z.string()
    .length(10, 'Phone number must be exactly 10 digits')
    .regex(/^\d{10}$/, 'Phone number must contain only 10 digits'),
  uhid: z.string()
    .min(1, 'UHID is required')
    .max(50, 'UHID must be less than 50 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'UHID can only contain letters and numbers'),
});

export type PatientForm = z.infer<typeof PatientFormSchema>;

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
  // Sync fields
  cloudId: z.number().int().positive().optional(),
  syncStatus: z.enum(['PENDING', 'SYNCED', 'CONFLICT']).default('PENDING'),
  lastSyncAt: z.date().optional().or(z.string().datetime().optional()),
  createdAt: z.date().optional().or(z.string().datetime().optional()),
  updatedAt: z.date().optional().or(z.string().datetime().optional()),
});

export type Invoice = z.infer<typeof InvoiceSchema>;

/**
 * Treatment Schema - Validates treatment data
 */
export const TreatmentSchema = z.object({
  id: z.number().int().positive().optional(),
  invoiceId: z.number().int().positive(),
  name: z.string().min(1, 'Treatment name is required').max(200),
  duration: z.string().max(100).default(''),
  sessions: z.number().int().min(1, 'At least 1 session required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  amount: z.number().min(0, 'Amount must be positive'),
  // Sync fields
  cloudId: z.number().int().positive().optional(),
  syncStatus: z.enum(['PENDING', 'SYNCED', 'CONFLICT']).default('PENDING'),
  lastSyncAt: z.date().optional().or(z.string().datetime().optional()),
  createdAt: z.date().optional().or(z.string().datetime().optional()),
  updatedAt: z.date().optional().or(z.string().datetime().optional()),
});

export type Treatment = z.infer<typeof TreatmentSchema>;

/**
 * Treatment Form Schema - For user input
 */
export const TreatmentFormSchema = z.object({
  name: z.string().min(1, 'Treatment name is required').max(200),
  duration: z.string().default(''), // Required string to match TreatmentItem
  sessions: z.number().int().min(1, 'At least 1 session required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  amount: z.number().min(0, 'Amount must be positive'),
  rate: z.number().optional(), // Deprecated field for backward compatibility
});

export type TreatmentForm = z.infer<typeof TreatmentFormSchema>;

// ============================================
// COMPOSITE SCHEMAS - Combined data
// ============================================

/**
 * Invoice with Patient Schema - Invoice with nested patient data
 */
export const InvoiceWithPatientSchema = InvoiceSchema.extend({
  patient: PatientSchema,
  treatments: z.array(TreatmentSchema).optional(),
});

export type InvoiceWithPatient = z.infer<typeof InvoiceWithPatientSchema>;

/**
 * Complete Invoice Data Schema - For invoice generation
 */
export const InvoiceDataSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  patient: PatientFormSchema,
  treatments: z.array(TreatmentFormSchema).min(1, 'At least one treatment is required'),
  diagnosis: z.string().max(500).optional(),
  notes: z.string().max(1000).default(''),
  paymentMethod: z.string().default('Cash'), // Keep as string to match old type
  total: z.string(), // Keep as string to match old InvoiceData type
  timestamp: z.string(), // Required timestamp field
});

export type InvoiceData = z.infer<typeof InvoiceDataSchema>;

// ============================================
// SYNC SCHEMAS - For sync operations
// ============================================

/**
 * Sync Payload Schema - Data sent to backend during sync
 */
export const SyncPayloadSchema = z.object({
  lastSyncTime: z.string().datetime().optional(),
  patients: z.array(
    PatientSchema.extend({
      updatedAt: z.string().datetime(),
    })
  ).optional(),
  invoices: z.array(
    InvoiceSchema.extend({
      patientCloudId: z.number().int().positive().nullish(),
      updatedAt: z.string().datetime(),
    })
  ).optional(),
  treatments: z.array(
    TreatmentSchema.extend({
      invoiceCloudId: z.number().int().positive().nullish(),
      updatedAt: z.string().datetime(),
    })
  ).optional(),
});

export type SyncPayload = z.infer<typeof SyncPayloadSchema>;

/**
 * Sync Response Schema - Response from backend
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

// ============================================
// IPC RESPONSE SCHEMAS
// ============================================

/**
 * Generic IPC Response Schema
 */
export const IPCResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

export type IPCResponse = z.infer<typeof IPCResponseSchema>;

/**
 * Save Invoice Response Schema
 */
export const SaveInvoiceResponseSchema = IPCResponseSchema.extend({
  invoiceId: z.number().int().optional(),
});

export type SaveInvoiceResponse = z.infer<typeof SaveInvoiceResponseSchema>;

/**
 * Load Invoices Response Schema
 */
export const LoadInvoicesResponseSchema = IPCResponseSchema.extend({
  invoices: z.array(InvoiceWithPatientSchema).optional(),
});

export type LoadInvoicesResponse = z.infer<typeof LoadInvoicesResponseSchema>;

/**
 * Get Next Invoice Number Response Schema
 */
export const GetNextInvoiceNumberResponseSchema = IPCResponseSchema.extend({
  invoiceNumber: z.string().regex(/^\d{4}$/).optional(),
  source: z.enum(['backend', 'local', 'fallback']).optional(),
});

export type GetNextInvoiceNumberResponse = z.infer<typeof GetNextInvoiceNumberResponseSchema>;

// ============================================
// LAYOUT SCHEMAS
// ============================================

/**
 * Invoice Layout Schema - For customization
 */
export const InvoiceLayoutSchema = z.object({
  clinicName: z.string().max(200).default('Shree Ram Physiotherapy and Rehabilitation Center'),
  clinicAddress: z.string().max(500).default(''),
  clinicPhone: z.string().max(50).default(''),
  clinicEmail: z.string().email().optional(),
  logoUrl: z.string().url().optional(),
  theme: z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#5F3794'),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#8B5CF6'),
    fontSize: z.number().min(8).max(24).default(12),
  }).optional(),
  showLogo: z.boolean().default(true),
  showHeader: z.boolean().default(true),
  showFooter: z.boolean().default(true),
});

export type InvoiceLayout = z.infer<typeof InvoiceLayoutSchema>;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Safe parse with detailed error messages
 */
export function validateData<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map((err: z.ZodIssue) => 
    `${err.path.join('.')}: ${err.message}`
  );
  
  return { success: false, errors };
}

/**
 * Validate and throw on error
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = validateData(schema, data);
  
  if (!result.success) {
    throw new Error(`Validation failed:\n${result.errors.join('\n')}`);
  }
  
  return result.data;
}

/**
 * Validate form data and return user-friendly errors
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): { valid: true; data: T } | { valid: false; fieldErrors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { valid: true, data: result.data };
  }
  
  const fieldErrors: Record<string, string> = {};
  result.error.issues.forEach((err: z.ZodIssue) => {
    const field = err.path.join('.');
    fieldErrors[field] = err.message;
  });
  
  return { valid: false, fieldErrors };
}
