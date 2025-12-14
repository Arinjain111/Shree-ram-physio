/**
 * Sync-related type definitions for bidirectional data synchronization
 * between local Electron database and cloud backend.
 */

import type { Patient, DatabaseInvoice, Treatment } from './database.types';

// Re-export Invoice as alias for DatabaseInvoice for sync operations
export type Invoice = DatabaseInvoice;

export interface SyncPayload {
  patients: Patient[];
  invoices: Invoice[];
  treatments: Treatment[];
}

export interface SyncedEntity {
  localId: number;
  cloudId: string;
  updated_at: string;
}

export interface SyncResponse {
  success: boolean;
  synced: {
    patients: SyncedEntity[];
    invoices: SyncedEntity[];
    treatments: SyncedEntity[];
  };
  updates: {
    patients: Patient[];
    invoices: Invoice[];
    treatments: Treatment[];
  };
}

export interface SyncStatus {
  lastSync: string | null;
  pendingCount: number;
}

export interface SyncLog {
  id?: number;
  entity_type: 'patient' | 'invoice' | 'treatment';
  entity_id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  status: 'pending' | 'success' | 'failed';
  error_message?: string;
  created_at: string;
  synced_at?: string;
  sync_date?: string;
  sync_status?: string;
}

export type SyncStatusType = 'SYNCED' | 'PENDING' | 'CONFLICT';
