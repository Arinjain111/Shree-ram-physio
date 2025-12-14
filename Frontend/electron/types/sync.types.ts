/**
 * Sync-related type definitions for Electron main process.
 */

import type { Patient, Invoice, Treatment } from '../database/schema';

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
