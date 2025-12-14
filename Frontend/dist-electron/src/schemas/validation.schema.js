"use strict";
/**
 * Frontend Zod Validation Schemas
 * Single source of truth for all data validation on frontend
 * These schemas validate data from user input and sync operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceLayoutSchema = exports.GetNextInvoiceNumberResponseSchema = exports.LoadInvoicesResponseSchema = exports.SaveInvoiceResponseSchema = exports.IPCResponseSchema = exports.SyncResponseSchema = exports.SyncPayloadSchema = exports.InvoiceDataSchema = exports.InvoiceWithPatientSchema = exports.TreatmentFormSchema = exports.TreatmentSchema = exports.InvoiceSchema = exports.PatientFormSchema = exports.PatientSchema = void 0;
exports.validateData = validateData;
exports.validateOrThrow = validateOrThrow;
exports.validateForm = validateForm;
const zod_1 = require("zod");
// ============================================
// BASE SCHEMAS - Core data types
// ============================================
/**
 * Patient Schema - Validates patient data
 */
exports.PatientSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive().optional(), // Local ID
    firstName: zod_1.z.string().min(1, 'First name is required').max(100),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(50),
    name: zod_1.z.string().optional(), // Deprecated - for backward compatibility
    age: zod_1.z.number().int().min(0, 'Age must be positive').max(150, 'Invalid age'),
    gender: zod_1.z.enum(['Male', 'Female', 'Other']),
    phone: zod_1.z.string().min(10, 'Phone must be at least 10 digits').max(15),
    uhid: zod_1.z.string().min(1, 'UHID is required').max(50),
    // Sync fields
    cloudId: zod_1.z.number().int().positive().optional(),
    syncStatus: zod_1.z.enum(['PENDING', 'SYNCED', 'CONFLICT']).default('PENDING'),
    lastSyncAt: zod_1.z.date().optional().or(zod_1.z.string().datetime().optional()),
    createdAt: zod_1.z.date().optional().or(zod_1.z.string().datetime().optional()),
    updatedAt: zod_1.z.date().optional().or(zod_1.z.string().datetime().optional()),
});
/**
 * Patient Form Schema - For user input validation
 */
exports.PatientFormSchema = zod_1.z.object({
    firstName: zod_1.z.string()
        .min(1, 'First name is required')
        .max(100, 'First name must be less than 100 characters')
        .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes')
        .refine(val => !/\d/.test(val), 'First name cannot contain numbers')
        .refine(val => !/[eE][+-]?\d+/.test(val), 'First name cannot contain exponential notation'),
    lastName: zod_1.z.string()
        .min(1, 'Last name is required')
        .max(50, 'Last name must be less than 50 characters')
        .regex(/^[a-zA-Z'-]+$/, 'Last name can only contain letters, hyphens, and apostrophes (no spaces)')
        .refine(val => !/\s/.test(val), 'Last name must be a single word (no spaces)')
        .refine(val => !/\d/.test(val), 'Last name cannot contain numbers')
        .refine(val => !/[eE][+-]?\d+/.test(val), 'Last name cannot contain exponential notation'),
    age: zod_1.z.number()
        .int('Age must be a whole number')
        .min(0, 'Age must be positive')
        .max(100, 'Age cannot exceed 100 years')
        .refine(val => val.toString().length <= 3, 'Age must be maximum 3 digits'),
    gender: zod_1.z.string().min(1, 'Gender is required'), // Keep as string to match old PatientInfo type
    phone: zod_1.z.string()
        .length(10, 'Phone number must be exactly 10 digits')
        .regex(/^\d{10}$/, 'Phone number must contain only 10 digits'),
    uhid: zod_1.z.string()
        .min(1, 'UHID is required')
        .max(50, 'UHID must be less than 50 characters')
        .regex(/^[a-zA-Z0-9]+$/, 'UHID can only contain letters and numbers'),
});
/**
 * Invoice Schema - Validates invoice data
 */
exports.InvoiceSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive().optional(),
    invoiceNumber: zod_1.z.string()
        .regex(/^\d{4}$/, 'Invoice number must be 4 digits')
        .min(1, 'Invoice number is required'),
    patientId: zod_1.z.number().int().positive(),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    diagnosis: zod_1.z.string().max(500).default(''),
    notes: zod_1.z.string().max(1000).default(''),
    paymentMethod: zod_1.z.enum(['Cash', 'Card', 'UPI', 'Online', 'Cheque']).default('Cash'),
    total: zod_1.z.number().min(0, 'Total must be positive'),
    // Sync fields
    cloudId: zod_1.z.number().int().positive().optional(),
    syncStatus: zod_1.z.enum(['PENDING', 'SYNCED', 'CONFLICT']).default('PENDING'),
    lastSyncAt: zod_1.z.date().optional().or(zod_1.z.string().datetime().optional()),
    createdAt: zod_1.z.date().optional().or(zod_1.z.string().datetime().optional()),
    updatedAt: zod_1.z.date().optional().or(zod_1.z.string().datetime().optional()),
});
/**
 * Treatment Schema - Validates treatment data
 */
exports.TreatmentSchema = zod_1.z.object({
    id: zod_1.z.number().int().positive().optional(),
    invoiceId: zod_1.z.number().int().positive(),
    name: zod_1.z.string().min(1, 'Treatment name is required').max(200),
    duration: zod_1.z.string().max(100).default(''),
    sessions: zod_1.z.number().int().min(1, 'At least 1 session required'),
    startDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    endDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
    amount: zod_1.z.number().min(0, 'Amount must be positive'),
    // Sync fields
    cloudId: zod_1.z.number().int().positive().optional(),
    syncStatus: zod_1.z.enum(['PENDING', 'SYNCED', 'CONFLICT']).default('PENDING'),
    lastSyncAt: zod_1.z.date().optional().or(zod_1.z.string().datetime().optional()),
    createdAt: zod_1.z.date().optional().or(zod_1.z.string().datetime().optional()),
    updatedAt: zod_1.z.date().optional().or(zod_1.z.string().datetime().optional()),
});
/**
 * Treatment Form Schema - For user input
 */
exports.TreatmentFormSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Treatment name is required').max(200),
    duration: zod_1.z.string().default(''), // Required string to match TreatmentItem
    sessions: zod_1.z.number().int().min(1, 'At least 1 session required'),
    startDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    endDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
    amount: zod_1.z.number().min(0, 'Amount must be positive'),
    rate: zod_1.z.number().optional(), // Deprecated field for backward compatibility
});
// ============================================
// COMPOSITE SCHEMAS - Combined data
// ============================================
/**
 * Invoice with Patient Schema - Invoice with nested patient data
 */
exports.InvoiceWithPatientSchema = exports.InvoiceSchema.extend({
    patient: exports.PatientSchema,
    treatments: zod_1.z.array(exports.TreatmentSchema).optional(),
});
/**
 * Complete Invoice Data Schema - For invoice generation
 */
exports.InvoiceDataSchema = zod_1.z.object({
    invoiceNumber: zod_1.z.string().min(1, 'Invoice number is required'),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    patient: exports.PatientFormSchema,
    treatments: zod_1.z.array(exports.TreatmentFormSchema).min(1, 'At least one treatment is required'),
    diagnosis: zod_1.z.string().max(500).optional(),
    notes: zod_1.z.string().max(1000).default(''),
    paymentMethod: zod_1.z.string().default('Cash'), // Keep as string to match old type
    total: zod_1.z.string(), // Keep as string to match old InvoiceData type
    timestamp: zod_1.z.string(), // Required timestamp field
});
// ============================================
// SYNC SCHEMAS - For sync operations
// ============================================
/**
 * Sync Payload Schema - Data sent to backend during sync
 */
exports.SyncPayloadSchema = zod_1.z.object({
    lastSyncTime: zod_1.z.string().datetime().optional(),
    patients: zod_1.z.array(exports.PatientSchema.extend({
        updatedAt: zod_1.z.string().datetime(),
    })).optional(),
    invoices: zod_1.z.array(exports.InvoiceSchema.extend({
        patientCloudId: zod_1.z.number().int().positive().nullish(),
        updatedAt: zod_1.z.string().datetime(),
    })).optional(),
    treatments: zod_1.z.array(exports.TreatmentSchema.extend({
        invoiceCloudId: zod_1.z.number().int().positive().nullish(),
        updatedAt: zod_1.z.string().datetime(),
    })).optional(),
});
/**
 * Sync Response Schema - Response from backend
 */
exports.SyncResponseSchema = zod_1.z.object({
    synced: zod_1.z.object({
        patients: zod_1.z.array(zod_1.z.object({
            localId: zod_1.z.number().int().optional(),
            cloudId: zod_1.z.number().int(),
        })),
        invoices: zod_1.z.array(zod_1.z.object({
            localId: zod_1.z.number().int().optional(),
            cloudId: zod_1.z.number().int(),
            originalNumber: zod_1.z.string().optional(),
            newNumber: zod_1.z.string().optional(),
        })),
        treatments: zod_1.z.array(zod_1.z.object({
            localId: zod_1.z.number().int().optional(),
            cloudId: zod_1.z.number().int(),
        })),
    }),
    updates: zod_1.z.object({
        patients: zod_1.z.array(exports.PatientSchema),
        invoices: zod_1.z.array(exports.InvoiceSchema),
        treatments: zod_1.z.array(exports.TreatmentSchema),
    }),
    conflicts: zod_1.z.array(zod_1.z.object({
        localId: zod_1.z.number().int().optional(),
        originalNumber: zod_1.z.string(),
        newNumber: zod_1.z.string(),
        reason: zod_1.z.string(),
    })).optional(),
});
// ============================================
// IPC RESPONSE SCHEMAS
// ============================================
/**
 * Generic IPC Response Schema
 */
exports.IPCResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    error: zod_1.z.string().optional(),
});
/**
 * Save Invoice Response Schema
 */
exports.SaveInvoiceResponseSchema = exports.IPCResponseSchema.extend({
    invoiceId: zod_1.z.number().int().optional(),
});
/**
 * Load Invoices Response Schema
 */
exports.LoadInvoicesResponseSchema = exports.IPCResponseSchema.extend({
    invoices: zod_1.z.array(exports.InvoiceWithPatientSchema).optional(),
});
/**
 * Get Next Invoice Number Response Schema
 */
exports.GetNextInvoiceNumberResponseSchema = exports.IPCResponseSchema.extend({
    invoiceNumber: zod_1.z.string().regex(/^\d{4}$/).optional(),
    source: zod_1.z.enum(['backend', 'local', 'fallback']).optional(),
});
// ============================================
// LAYOUT SCHEMAS
// ============================================
/**
 * Invoice Layout Schema - For customization
 */
exports.InvoiceLayoutSchema = zod_1.z.object({
    clinicName: zod_1.z.string().max(200).default('Shree Ram Physiotherapy and Rehabilitation Center'),
    clinicAddress: zod_1.z.string().max(500).default(''),
    clinicPhone: zod_1.z.string().max(50).default(''),
    clinicEmail: zod_1.z.string().email().optional(),
    logoUrl: zod_1.z.string().url().optional(),
    theme: zod_1.z.object({
        primaryColor: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#5F3794'),
        secondaryColor: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#8B5CF6'),
        fontSize: zod_1.z.number().min(8).max(24).default(12),
    }).optional(),
    showLogo: zod_1.z.boolean().default(true),
    showHeader: zod_1.z.boolean().default(true),
    showFooter: zod_1.z.boolean().default(true),
});
// ============================================
// UTILITY FUNCTIONS
// ============================================
/**
 * Safe parse with detailed error messages
 */
function validateData(schema, data) {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errors = result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
    return { success: false, errors };
}
/**
 * Validate and throw on error
 */
function validateOrThrow(schema, data) {
    const result = validateData(schema, data);
    if (!result.success) {
        throw new Error(`Validation failed:\n${result.errors.join('\n')}`);
    }
    return result.data;
}
/**
 * Validate form data and return user-friendly errors
 */
function validateForm(schema, data) {
    const result = schema.safeParse(data);
    if (result.success) {
        return { valid: true, data: result.data };
    }
    const fieldErrors = {};
    result.error.issues.forEach((err) => {
        const field = err.path.join('.');
        fieldErrors[field] = err.message;
    });
    return { valid: false, fieldErrors };
}
