/**
 * IPC-specific type definitions for Electron main-renderer communication.
 */

import type { InvoiceData } from '@/schemas/validation.schema';
import type { TreatmentPreset } from './treatmentPreset.types';
import type { IPCResponse } from './api.types';

/**
 * Response from save-invoice IPC handler
 */
export interface SaveInvoiceResponse extends IPCResponse {
  invoice?: InvoiceData;
}

/**
 * Response from load-invoices IPC handler
 */
export interface LoadInvoicesResponse extends IPCResponse {
  invoices?: InvoiceData[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

/**
 * Response from get-next-invoice-number IPC handler
 */
export interface GetNextInvoiceNumberResponse extends IPCResponse {
  invoiceNumber?: string;
}

/**
 * Response from print-invoice IPC handler
 */
export interface PrintInvoiceResponse extends IPCResponse {
  printed?: boolean;
}

/**
 * Response from treatment preset operations
 */
export interface TreatmentPresetResponse extends IPCResponse {
  preset?: TreatmentPreset;
  presets?: TreatmentPreset[];
}

/**
 * Response from sync operations
 */
export interface SyncNowResponse extends IPCResponse {
  result?: {
    message: string;
    lastSyncTime?: string;
  };
}

/**
 * Response from cloud preset sync
 */
export interface SyncPresetsFromCloudResponse extends IPCResponse {
  stats?: {
    created: number;
    updated: number;
    failed: number;
  };
}

export interface BillingSummaryResponse extends IPCResponse {
  totalOutstanding?: number;
  overdueCount?: number;
  totalCollected?: number;
  overdueInvoices?: Array<{
    id: number;
    invoiceNumber: string;
    date: string;
    total: number;
    amountPaid: number;
    paymentStatus: string;
    patientName: string;
  }>;
  invoices?: Array<{
    id: number;
    invoiceNumber: string;
    date: string;
    total: number;
    amountPaid: number;
    paymentStatus: string;
    patientName: string;
  }>;
}

export interface RecordPaymentResponse extends IPCResponse {
  amountPaid?: number;
  paymentStatus?: string;
}
