import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma';
import { BrowserWindow } from 'electron';

export class PrismaSyncEngine {
  private prisma: PrismaClient;
  private backendUrl: string;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;

  constructor(backendUrl: string) {
    this.prisma = getPrismaClient();
    this.backendUrl = backendUrl;
  }

  /**
   * Send notification to renderer process
   */
  private notifyRenderer(channel: string, data: any) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send(channel, data);
    }
  }

  /**
   * Start automatic sync every 30 minutes (default)
   */
  /**
   * Start automatic sync every 5 minutes (default)
   */
  startAutoSync(intervalMs: number = 5 * 60 * 1000) {
    if (this.syncInterval) {
      console.log('Auto-sync already running');
      return;
    }

    console.log(`Starting auto-sync (every ${intervalMs / 60000} minutes)`);

    // Sync immediately on start
    this.performSync().catch(console.error);

    // Then sync at intervals
    this.syncInterval = setInterval(() => {
      this.performSync().catch(console.error);
    }, intervalMs);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto-sync stopped');
    }
  }

  /**
   * Reset auto-sync timer (useful after manual sync)
   */
  resetAutoSyncTimer(intervalMs: number = 5 * 60 * 1000) {
    console.log('Resetting auto-sync timer...');
    this.stopAutoSync();
    this.startAutoSync(intervalMs);
  }

  /**
   * Smart Polling: Check if sync is needed
   */
  private async shouldSync(): Promise<{ shouldSync: boolean; message?: string; lastSyncTime?: string }> {
    try {
      // Check for local pending changes
      const pendingCount = await this.prisma.$transaction([
        this.prisma.patient.count({ where: { syncStatus: 'PENDING' } }),
        this.prisma.invoice.count({ where: { syncStatus: 'PENDING' } }),
        this.prisma.treatment.count({ where: { syncStatus: 'PENDING' } })
      ]);
      const hasLocalChanges = pendingCount.some(count => count > 0);

      if (hasLocalChanges) {
        return { shouldSync: true, message: 'Local changes detected' };
      }

      // No local changes, check server status
      const lastSync = await this.prisma.syncLog.findFirst({
        where: { status: 'success' },
        orderBy: { createdAt: 'desc' }
      });

      if (!lastSync) {
        return { shouldSync: true, message: 'No previous sync found' };
      }

      // Start fetching server status
      const statusResponse = await axios.get(`${this.backendUrl}/api/sync/status`, { timeout: 5000 });

      if (statusResponse.data.success) {
        const serverLastModified = new Date(statusResponse.data.lastModified).getTime();
        const localLastSync = new Date(lastSync.createdAt).getTime();

        if (serverLastModified <= localLastSync) {
          return {
            shouldSync: false,
            message: 'Skipped (No updates)',
            lastSyncTime: lastSync.createdAt.toISOString()
          };
        }
        return { shouldSync: true, message: 'Server updates detected' };
      }

      // If status check fails but didn't throw, assume sync needed to be safe
      return { shouldSync: true, message: 'Status check inconclusive' };

    } catch (error) {
      console.warn('⚠️ Status check failed, falling back to safe full sync:', error);
      return { shouldSync: true, message: 'Status check failed' };
    }
  }

  /**
   * Perform a full bidirectional sync
   */
  async performSync(force: boolean = false): Promise<{ success: boolean; message: string; lastSyncTime?: string; errors?: string[]; stats?: any }> {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;

    try {
      // Check connectivity
      if (!await this.checkConnectivity()) {
        return { success: false, message: 'No internet connection' };
      }

      console.log('🔄 Checking sync status...');

      // Run Smart Polling Check (Skip if forced)
      let check: { shouldSync: boolean; message?: string; lastSyncTime?: string } = { shouldSync: true, message: 'Forced sync' };
      if (!force) {
        check = await this.shouldSync();
      }

      if (!check.shouldSync) {
        console.log(`✅ ${check.message}`);
        return {
          success: true,
          message: check.message || 'Skipped',
          lastSyncTime: check.lastSyncTime
        };
      }

      console.log(`⬇️ Proceeding to sync: ${check.message}`);
      console.log('🔄 Starting sync...');

      // Determine incremental sync cursor.
      // If there is no prior successful sync (or sync logs were reset), backend will return ALL records.
      const lastSuccessfulSync = await this.prisma.syncLog.findFirst({
        where: { status: 'success' },
        orderBy: { createdAt: 'desc' }
      });
      const lastSyncTime = lastSuccessfulSync?.createdAt?.toISOString() ?? null;

      // === FETCH PENDING DATA ===
      // We query full objects immediately for upload
      const pendingPatients = await this.prisma.patient.findMany({ where: { syncStatus: 'PENDING' } });
      const pendingInvoices = await this.prisma.invoice.findMany({
        where: { syncStatus: 'PENDING' },
        include: { patient: true }
      });
      const pendingTreatments = await this.prisma.treatment.findMany({
        where: { syncStatus: 'PENDING' },
        include: { invoice: true }
      });

      console.log(`🔎 Found pending items: ${pendingPatients.length} patients, ${pendingInvoices.length} invoices, ${pendingTreatments.length} treatments`);
      const [totalPatients, totalInvoices, totalTreatments] = await this.prisma.$transaction([
        this.prisma.patient.count(),
        this.prisma.invoice.count(),
        this.prisma.treatment.count()
      ]);
      const dbEmpty = totalPatients === 0 && totalInvoices === 0 && totalTreatments === 0;
      console.log(`📊 Local DB empty: ${dbEmpty ? 'YES' : 'NO'} (${totalPatients} patients, ${totalInvoices} invoices, ${totalTreatments} treatments)`);

      // === PREPARE DATA FOR UPLOAD ===
      // Use incremental cursor when available; backend returns only updates since lastSyncTime.
      const normalizeUhidForSync = (value: unknown): string | null => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed) return null;

        // Do NOT affect local DB; only avoid syncing values that are very likely auto-generated.
        // (UUIDs / long random tokens). If the user entered UHID, it will typically be shorter.
        const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
        const longHex = /^[0-9a-f]{24,}$/i.test(trimmed);
        const longToken = /^[A-Za-z0-9_-]{24,}$/.test(trimmed);
        if (uuidLike || longHex || longToken) return null;

        return trimmed;
      };

      const patientsWithFilteredUhid = new Set<number>();

      const syncPayload = {
        lastSyncTime,
        patients: pendingPatients.map(p => ({
          id: p.id,
          cloudId: p.cloudId,
          firstName: p.firstName,
          lastName: p.lastName,
          age: p.age,
          gender: p.gender,
          phone: p.phone,
          uhid: (() => {
            const sanitized = normalizeUhidForSync((p as any).uhid);
            if (sanitized === null && (p as any).uhid && p.id) {
              patientsWithFilteredUhid.add(p.id);
            }
            return sanitized;
          })(),
          updatedAt: p.updatedAt.toISOString()
        })),
        invoices: pendingInvoices.map(inv => ({
          id: inv.id,
          cloudId: inv.cloudId,
          invoiceNumber: inv.invoiceNumber,
          patientId: inv.patientId,
          patientCloudId: inv.patient.cloudId,
          date: inv.date,
          diagnosis: inv.diagnosis || '',
          notes: inv.notes || '',
          paymentMethod: inv.paymentMethod || 'Cash',
          total: inv.total,
          updatedAt: inv.updatedAt.toISOString()
        })),
        treatments: pendingTreatments.map(t => ({
          id: t.id,
          cloudId: t.cloudId,
          invoiceId: t.invoiceId,
          invoiceCloudId: t.invoice.cloudId,
          name: t.name,
          duration: t.duration || '',
          sessions: t.sessions,
          startDate: t.startDate,
          endDate: t.endDate,
          amount: t.amount,
          updatedAt: t.updatedAt.toISOString()
        }))
      };

      console.log(`📤 Uploading: ${pendingPatients.length} patients, ${pendingInvoices.length} invoices, ${pendingTreatments.length} treatments`);
      console.log(`📡 Sync URL: ${this.backendUrl}/api/sync`);
      console.log(
        lastSyncTime
          ? `📅 Incremental sync: Fetching updates since ${lastSyncTime}`
          : '📅 Full sync: No previous sync found (or reset). Fetching ALL cloud data'
      );

      const response = await axios.post(
        `${this.backendUrl}/api/sync`,
        syncPayload,
        {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      console.log('📥 Backend response received:', {
        syncedCount: response.data.synced?.patients?.length + response.data.synced?.invoices?.length + response.data.synced?.treatments?.length || 0,
        updatesCount: (response.data.updates?.patients?.length || 0) + (response.data.updates?.invoices?.length || 0) + (response.data.updates?.treatments?.length || 0)
      });

      const { synced, updates } = response.data;
      
      console.log('📦 Raw backend response:', JSON.stringify({
        synced: {
          patients: synced?.patients?.length || 0,
          invoices: synced?.invoices?.length || 0,
          treatments: synced?.treatments?.length || 0
        },
        updates: {
          patients: updates?.patients?.length || 0,
          invoices: updates?.invoices?.length || 0,
          treatments: updates?.treatments?.length || 0
        }
      }, null, 2));

      // === UPDATE LOCAL DB WITH CLOUD IDs ===

      // Update patients with cloud IDs
      for (const patient of synced.patients) {
        if (patient.localId && patient.cloudId) {
          const shouldClearUhid = patientsWithFilteredUhid.has(patient.localId);
          await this.prisma.patient.update({
            where: { id: patient.localId },
            data: {
              cloudId: patient.cloudId,
              syncStatus: 'SYNCED',
              lastSyncAt: new Date(),
              ...(shouldClearUhid ? { uhid: null } : {})
            }
          });
        }
      }

      // Update invoices with cloud IDs
      for (const invoice of synced.invoices) {
        if (invoice.localId && invoice.cloudId) {
          const updateData: any = {
            cloudId: invoice.cloudId,
            syncStatus: 'SYNCED',
            lastSyncAt: new Date()
          };

          // ⚠️ CRITICAL: NEVER change invoice numbers after generation/printing!
          // Invoice numbers are immutable and sacred - user already printed them
          // If a conflict exists, backend keeps it as PENDING and returns conflict info
          // but we NEVER update the invoice number locally
          if (invoice.newNumber && invoice.newNumber !== invoice.originalNumber) {
            console.error(`❌ INVOICE NUMBER CHANGED - THIS SHOULD NOT HAPPEN!`);
            console.error(`   Original: ${invoice.originalNumber}, New: ${invoice.newNumber}`);
            console.error(`   User's printed invoice has ${invoice.originalNumber} but system shows ${invoice.newNumber}`);
            // Don't apply the change - keep original number
            // This is a safety guard in case backend tries to change numbers
          }

          await this.prisma.invoice.update({
            where: { id: invoice.localId },
            data: updateData
            // NOTE: invoiceNumber is NOT updated - it's immutable!
          });
        }
      }

      // Update treatments with cloud IDs
      for (const treatment of synced.treatments) {
        if (treatment.localId && treatment.cloudId) {
          await this.prisma.treatment.update({
            where: { id: treatment.localId },
            data: {
              cloudId: treatment.cloudId,
              syncStatus: 'SYNCED',
              lastSyncAt: new Date()
            }
          });
        }
      }

      // === APPLY CLOUD UPDATES ===
      console.log(`📥 Downloading updates: ${updates.patients?.length || 0} patients, ${updates.invoices?.length || 0} invoices, ${updates.treatments?.length || 0} treatments`);
      
      if ((updates.patients?.length || 0) === 0 && (updates.invoices?.length || 0) === 0 && (updates.treatments?.length || 0) === 0) {
        console.warn('⚠️ Backend returned ZERO updates - cloud database may be empty or sync endpoint not working');
      } else {
        console.log('📦 Update details:', {
          patients: updates.patients?.map((p: any) => `${p.firstName} ${p.lastName} (ID: ${p.id})`),
          invoices: updates.invoices?.map((i: any) => `Invoice ${i.invoiceNumber} (ID: ${i.id})`),
          treatments: updates.treatments?.map((t: any) => `${t.name} (ID: ${t.id})`)
        });
      }

      // Apply patient updates from cloud
      for (const cloudPatient of updates.patients || []) {
        const localPatient = await this.prisma.patient.findFirst({
          where: { cloudId: cloudPatient.id }
        });

        if (localPatient) {
          // Update existing
          await this.prisma.patient.update({
            where: { id: localPatient.id },
            data: {
              firstName: cloudPatient.firstName,
              lastName: cloudPatient.lastName,
              age: cloudPatient.age,
              gender: cloudPatient.gender,
              phone: cloudPatient.phone,
              uhid: cloudPatient.uhid,
              syncStatus: 'SYNCED',
              lastSyncAt: new Date()
            }
          });
        } else {
          // Create new from cloud
          console.log(`   ➕ Creating patient from cloud: ${cloudPatient.firstName} ${cloudPatient.lastName} (Cloud ID: ${cloudPatient.id})`);
          await this.prisma.patient.create({
            data: {
              cloudId: cloudPatient.id,
              firstName: cloudPatient.firstName,
              lastName: cloudPatient.lastName,
              age: cloudPatient.age,
              gender: cloudPatient.gender,
              phone: cloudPatient.phone,
              uhid: cloudPatient.uhid,
              syncStatus: 'SYNCED',
              lastSyncAt: new Date()
            }
          });
        }
      }

      // Apply invoice updates from cloud
      for (const cloudInvoice of updates.invoices || []) {
        // Find local patient by cloud ID
        const localPatient = await this.prisma.patient.findFirst({
          where: { cloudId: cloudInvoice.patientId }
        });

        if (!localPatient) {
          console.warn(`Patient with cloud ID ${cloudInvoice.patientId} not found locally`);
          continue;
        }

        const localInvoice = await this.prisma.invoice.findFirst({
          where: { cloudId: cloudInvoice.id }
        });

        if (localInvoice) {
          // Update existing
          await this.prisma.invoice.update({
            where: { id: localInvoice.id },
            data: {
              invoiceNumber: cloudInvoice.invoiceNumber,
              patientId: localPatient.id,
              date: cloudInvoice.date,
              diagnosis: cloudInvoice.diagnosis,
              total: cloudInvoice.total,
              syncStatus: 'SYNCED',
              lastSyncAt: new Date()
            }
          });
        } else {
          // Create new from cloud
          console.log(`   ➕ Creating invoice from cloud: ${cloudInvoice.invoiceNumber} (Cloud ID: ${cloudInvoice.id})`);
          await this.prisma.invoice.create({
            data: {
              cloudId: cloudInvoice.id,
              invoiceNumber: cloudInvoice.invoiceNumber,
              patientId: localPatient.id,
              date: cloudInvoice.date,
              diagnosis: cloudInvoice.diagnosis,
              total: cloudInvoice.total,
              syncStatus: 'SYNCED',
              lastSyncAt: new Date()
            }
          });
        }
      }

      // Apply treatment updates from cloud
      for (const cloudTreatment of updates.treatments || []) {
        // Find local invoice by cloud ID
        const localInvoice = await this.prisma.invoice.findFirst({
          where: { cloudId: cloudTreatment.invoiceId }
        });

        if (!localInvoice) {
          console.warn(`Invoice with cloud ID ${cloudTreatment.invoiceId} not found locally`);
          continue;
        }

        const localTreatment = await this.prisma.treatment.findFirst({
          where: { cloudId: cloudTreatment.id }
        });

        if (localTreatment) {
          // Update existing
          await this.prisma.treatment.update({
            where: { id: localTreatment.id },
            data: {
              invoiceId: localInvoice.id,
              name: cloudTreatment.name,
              sessions: cloudTreatment.sessions,
              startDate: cloudTreatment.startDate,
              endDate: cloudTreatment.endDate,
              amount: cloudTreatment.amount,
              syncStatus: 'SYNCED',
              lastSyncAt: new Date()
            }
          });
        } else {
          // Create new from cloud
          console.log(`   ➕ Creating treatment from cloud: ${cloudTreatment.name} (Cloud ID: ${cloudTreatment.id})`);
          await this.prisma.treatment.create({
            data: {
              cloudId: cloudTreatment.id,
              invoiceId: localInvoice.id,
              name: cloudTreatment.name,
              sessions: cloudTreatment.sessions,
              startDate: cloudTreatment.startDate,
              endDate: cloudTreatment.endDate,
              amount: cloudTreatment.amount,
              syncStatus: 'SYNCED',
              lastSyncAt: new Date()
            }
          });
        }
      }

      // === CLEANUP: Remove local records not in cloud (cloud is source of truth) ===
      // ONLY cleanup if we successfully uploaded all pending changes
      // This prevents deleting local data that hasn't been synced yet
      const remainingPending = await this.prisma.$transaction([
        this.prisma.patient.count({ where: { syncStatus: 'PENDING' } }),
        this.prisma.invoice.count({ where: { syncStatus: 'PENDING' } }),
        this.prisma.treatment.count({ where: { syncStatus: 'PENDING' } })
      ]);
      const hasPendingData = remainingPending.some(count => count > 0);

      if (hasPendingData) {
        console.log('⚠️ Skipping cleanup: Still have pending local changes that need to be synced');
        console.log(`   Pending: ${remainingPending[0]} patients, ${remainingPending[1]} invoices, ${remainingPending[2]} treatments`);
      } else {
        // Safe to cleanup - all local changes have been synced
        const cloudPatientIds = (updates.patients || []).map((p: any) => p.id);
        const cloudInvoiceIds = (updates.invoices || []).map((i: any) => i.id);
        const cloudTreatmentIds = (updates.treatments || []).map((t: any) => t.id);

        // Delete local records that don't exist in cloud anymore
        // Only delete SYNCED records with cloudId (never delete pending or local-only)
        if (cloudPatientIds.length > 0) {
          const deletedPatients = await this.prisma.patient.deleteMany({
            where: {
              cloudId: { not: null, notIn: cloudPatientIds },
              syncStatus: 'SYNCED'
            }
          });
          if (deletedPatients.count > 0) {
            console.log(`   🗑️ Removed ${deletedPatients.count} patients that no longer exist in cloud`);
          }
        }

        if (cloudInvoiceIds.length > 0) {
          const deletedInvoices = await this.prisma.invoice.deleteMany({
            where: {
              cloudId: { not: null, notIn: cloudInvoiceIds },
              syncStatus: 'SYNCED'
            }
          });
          if (deletedInvoices.count > 0) {
            console.log(`   🗑️ Removed ${deletedInvoices.count} invoices that no longer exist in cloud`);
          }
        }

        if (cloudTreatmentIds.length > 0) {
          const deletedTreatments = await this.prisma.treatment.deleteMany({
            where: {
              cloudId: { not: null, notIn: cloudTreatmentIds },
              syncStatus: 'SYNCED'
            }
          });
          if (deletedTreatments.count > 0) {
            console.log(`   🗑️ Removed ${deletedTreatments.count} treatments that no longer exist in cloud`);
          }
        }
      }

      // === SYNC TREATMENT PRESETS ===
      let presetStats: { fetched: number; created: number; updated: number; unchanged: number; error?: string } = { fetched: 0, created: 0, updated: 0, unchanged: 0 };
      try {
        console.log(`📋 Fetching treatment presets from ${this.backendUrl}/api/presets`);
        const presetsResponse = await axios.get(`${this.backendUrl}/api/presets`, {
          timeout: 10000
        });

        if (presetsResponse.data.success && Array.isArray(presetsResponse.data.presets)) {
          const cloudPresets = presetsResponse.data.presets;
          presetStats.fetched = cloudPresets.length;
          console.log(`📋 Received ${cloudPresets.length} presets from cloud`);

          for (const cloudPreset of cloudPresets) {
            const localPreset = await this.prisma.treatmentPreset.findFirst({
              where: { name: cloudPreset.name }
            });

            if (localPreset) {
              const needsUpdate =
                localPreset.defaultSessions !== cloudPreset.defaultSessions ||
                localPreset.pricePerSession !== cloudPreset.pricePerSession;

              if (needsUpdate) {
                await this.prisma.treatmentPreset.update({
                  where: { id: localPreset.id },
                  data: {
                    defaultSessions: cloudPreset.defaultSessions,
                    pricePerSession: cloudPreset.pricePerSession
                  }
                });
                presetStats.updated++;
              } else {
                presetStats.unchanged++;
              }
            } else {
              await this.prisma.treatmentPreset.create({
                data: {
                  name: cloudPreset.name,
                  defaultSessions: cloudPreset.defaultSessions,
                  pricePerSession: cloudPreset.pricePerSession
                }
              });
              presetStats.created++;
            }
          }
          console.log(`📋 Presets synced: ${presetStats.created} created, ${presetStats.updated} updated`);
        }
      } catch (presetError) {
        console.warn('⚠️ Failed to sync presets:', presetError);
        presetStats.error = presetError instanceof Error ? presetError.message : String(presetError);
      }

      // Log successful sync
      await this.prisma.syncLog.create({
        data: {
          tableName: 'all',
          recordId: 0,
          operation: 'SYNC',
          status: 'success',
          syncedAt: new Date()
        }
      });

      const syncTime = new Date().toISOString();
      const totalDownloaded = (updates.patients?.length || 0) + (updates.invoices?.length || 0) + (updates.treatments?.length || 0);
      const totalUploaded = synced.patients.length + synced.invoices.length + synced.treatments.length;
      
      console.log('✅ Sync completed successfully');
      console.log(`   📤 Uploaded: ${totalUploaded} records (${synced.patients.length} patients, ${synced.invoices.length} invoices, ${synced.treatments.length} treatments)`);
      console.log(`   📥 Downloaded: ${totalDownloaded} records (${updates.patients?.length || 0} patients, ${updates.invoices?.length || 0} invoices, ${updates.treatments?.length || 0} treatments)`);

      // Notify renderer process about sync completion
      this.notifyRenderer('sync-completed', {
        timestamp: syncTime,
        synced: {
          patients: synced.patients.length,
          invoices: synced.invoices.length,
          treatments: synced.treatments.length,
          presets: presetStats
        },
        conflicts: response.data.conflicts || []
      });

      return {
        success: true,
        message: totalDownloaded > 0 
          ? `Downloaded ${totalDownloaded} records from cloud` 
          : totalUploaded > 0 
            ? `Uploaded ${totalUploaded} records to cloud`
            : 'All data is up to date',
        lastSyncTime: syncTime,
        stats: {
          uploaded: totalUploaded,
          downloaded: totalDownloaded,
          presets: presetStats
        },
        errors: presetStats.error ? [presetStats.error] : []
      };

    } catch (error) {
      console.error('❌ Sync failed:', error);

      // Log failed sync
      await this.prisma.syncLog.create({
        data: {
          tableName: 'all',
          recordId: 0,
          operation: 'SYNC',
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Check if backend is reachable
   */
  private async checkConnectivity(): Promise<boolean> {
    try {
      await axios.get(`${this.backendUrl}/health`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    const pendingCount = await this.prisma.$transaction([
      this.prisma.patient.count({ where: { syncStatus: 'PENDING' } }),
      this.prisma.invoice.count({ where: { syncStatus: 'PENDING' } }),
      this.prisma.treatment.count({ where: { syncStatus: 'PENDING' } })
    ]);

    const lastSync = await this.prisma.syncLog.findFirst({
      where: { status: 'success' },
      orderBy: { createdAt: 'desc' }
    });

    return {
      pendingChanges: pendingCount.reduce((a, b) => a + b, 0),
      lastSync: lastSync?.createdAt || null,
      lastSyncStatus: lastSync?.status || 'never',
      isSyncing: this.isSyncing
    };
  }

  /**
   * Reset sync timestamp to force a full sync from cloud
   */
  resetSyncTimestamp() {
    // Delete all sync logs to reset lastSyncTime to null
    return this.prisma.syncLog.deleteMany();
  }
}
