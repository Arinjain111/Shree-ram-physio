import axios, { AxiosInstance } from 'axios';
import type { Patient, Invoice, Treatment, SyncPayload, SyncResponse, SyncStatus } from '../types';

export class SyncEngine {
  private apiClient: AxiosInstance;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;

  constructor(private db: any, backendUrl: string = 'http://localhost:3000') {
    this.apiClient = axios.create({
      baseURL: backendUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Start automatic sync every 5 minutes
  startAutoSync(intervalMs: number = 5 * 60 * 1000) {
    console.log('Starting auto-sync...');
    
    // Initial sync
    this.performSync();
    
    // Periodic sync
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, intervalMs);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto-sync stopped');
    }
  }

  // Manual sync trigger
  async performSync(): Promise<{ success: boolean; message: string }> {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;
    console.log('Starting sync process...');

    try {
      // Check internet connectivity
      const isOnline = await this.checkConnectivity();
      if (!isOnline) {
        console.log('No internet connection. Sync skipped.');
        return { success: false, message: 'No internet connection' };
      }

      // 1. Collect pending changes from local DB
      const pendingData = this.collectPendingChanges();
      
      // 2. Send to cloud and get updates
      const response = await this.sendToCloud(pendingData);
      
      // 3. Update local database with cloud data
      this.applyCloudUpdates(response);
      
      console.log('Sync completed successfully');
      return { success: true, message: 'Sync completed' };

    } catch (error: any) {
      console.error('Sync failed:', error.message);
      return { success: false, message: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  private async checkConnectivity(): Promise<boolean> {
    try {
      await this.apiClient.get('/health', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private collectPendingChanges(): SyncPayload {
    const patients = this.db.getPendingRecords('patients');
    const invoices = this.db.getPendingRecords('invoices');
    const treatments = this.db.getPendingRecords('treatments');

    console.log(`Pending changes: ${patients.length} patients, ${invoices.length} invoices, ${treatments.length} treatments`);

    return { patients, invoices, treatments };
  }

  private async sendToCloud(payload: SyncPayload): Promise<SyncResponse> {
    try {
      const response = await this.apiClient.post<SyncResponse>('/api/sync', payload);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
      } else if (error.request) {
        throw new Error('No response from server. Check your internet connection.');
      } else {
        throw new Error(`Sync failed: ${error.message}`);
      }
    }
  }

  private applyCloudUpdates(response: SyncResponse) {
    // Mark locally synced records
    response.synced.patients.forEach(({ localId, cloudId, updated_at }) => {
      this.db.markAsSynced('patients', localId, cloudId);
      this.db.createSyncLog({
        entity_type: 'patient',
        entity_id: localId,
        action: 'CREATE',
        status: 'SUCCESS',
      });
    });

    response.synced.invoices.forEach(({ localId, cloudId, updated_at }) => {
      this.db.markAsSynced('invoices', localId, cloudId);
      this.db.createSyncLog({
        entity_type: 'invoice',
        entity_id: localId,
        action: 'CREATE',
        status: 'SUCCESS',
      });
    });

    response.synced.treatments.forEach(({ localId, cloudId, updated_at }) => {
      this.db.markAsSynced('treatments', localId, cloudId);
      this.db.createSyncLog({
        entity_type: 'treatment',
        entity_id: localId,
        action: 'CREATE',
        status: 'SUCCESS',
      });
    });

    // Apply updates from cloud
    response.updates.patients.forEach(patient => {
      if (patient.cloud_id) {
        this.db.updateFromCloud('patients', patient.cloud_id, patient);
      }
    });

    response.updates.invoices.forEach(invoice => {
      if (invoice.cloud_id) {
        this.db.updateFromCloud('invoices', invoice.cloud_id, invoice);
      }
    });

    response.updates.treatments.forEach(treatment => {
      if (treatment.cloud_id) {
        this.db.updateFromCloud('treatments', treatment.cloud_id, treatment);
      }
    });

    console.log('Cloud updates applied to local database');
  }

  // Get sync status
  getSyncStatus(): SyncStatus {
    const patients = this.db.getPendingRecords('patients');
    const invoices = this.db.getPendingRecords('invoices');
    const treatments = this.db.getPendingRecords('treatments');
    
    const pendingCount = patients.length + invoices.length + treatments.length;
    
    // Get last successful sync time
    const lastLog = this.db.db.prepare(`
      SELECT synced_at FROM sync_logs 
      WHERE status = 'SUCCESS' 
      ORDER BY synced_at DESC 
      LIMIT 1
    `).get();

    return {
      lastSync: lastLog?.synced_at || null,
      pendingCount,
    };
  }
}
