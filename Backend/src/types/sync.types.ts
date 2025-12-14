/**
 * Sync-related type definitions for backend synchronization operations.
 */

/**
 * Synced entity response for each synchronized item
 */
export interface SyncedEntity {
  localId: number;
  cloudId: string;
  updated_at: string;
}

/**
 * Conflict information when invoice numbers collide
 */
export interface SyncConflict {
  originalNumber: string;
  newNumber: string;
  reason: string;
}

/**
 * Sync statistics returned after sync operation
 */
export interface SyncStats {
  created: number;
  updated: number;
  failed: number;
}

export type SyncStatusType = 'SYNCED' | 'PENDING' | 'CONFLICT';
