import http from '../services/http';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../database/prisma';
import { BrowserWindow } from 'electron';
import { logger } from '../utils/logger';
import { clearAllCache } from '../utils/readCache';

export class PrismaSyncEngine {
  private prisma: PrismaClient;
  private backendUrl: string;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private pendingSync: boolean = false;

  // Azure App Service can cold-start; keep these >5s.
  private static readonly HEALTH_TIMEOUT_MS = 15_000;
  private static readonly STATUS_TIMEOUT_MS = 15_000;

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
   * Start automatic sync every 5 minutes (default)
   */
  startAutoSync(intervalMs: number = 5 * 60 * 1000) {
    if (this.syncInterval) {
      logger.debug('sync', 'Auto-sync already running');
      return;
    }

    logger.debug('sync', 'Auto-sync started', { intervalMinutes: intervalMs / 60000 });

    this.syncInterval = setInterval(() => {
      this.performSync().catch((err) => logger.error('sync', 'Interval sync failed', { error: String(err) }));
    }, intervalMs);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.debug('sync', 'Auto-sync stopped');
    }
  }

  /**
   * Reset auto-sync timer (useful after manual sync)
   */
  resetAutoSyncTimer(intervalMs: number = 5 * 60 * 1000) {
    logger.debug('sync', 'Resetting auto-sync timer');
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
        this.prisma.treatment.count({ where: { syncStatus: 'PENDING' } }),
        this.prisma.inventoryItem.count({ where: { syncStatus: 'PENDING' } }),
        this.prisma.inventoryTransaction.count({ where: { syncStatus: 'PENDING' } })
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
      const statusResponse = await http.get(`${this.backendUrl}/api/sync/status`, {
        timeout: PrismaSyncEngine.STATUS_TIMEOUT_MS
      });

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
      logger.warn('sync', 'Status check failed, falling back to safe full sync', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { shouldSync: true, message: 'Status check failed' };
    }
  }

  /**
   * Perform a full bidirectional sync
   */
  async performSync(force: boolean = false): Promise<{ success: boolean; message: string; lastSyncTime?: string; errors?: string[]; stats?: any }> {
    if (this.isSyncing) {
      if (!force) { this.pendingSync = true; }
      logger.debug('sync', 'Skipped — sync already in progress', { queued: !force });
      return { success: true, message: !force ? 'Sync queued' : 'Sync already in progress' };
    }

    this.isSyncing = true;

    try {
      // Check connectivity
      if (!await this.checkConnectivity()) {
        return { success: false, message: 'No internet connection' };
      }

      logger.debug('sync', 'Checking sync status');

      // Run Smart Polling Check (Skip if forced)
      let check: { shouldSync: boolean; message?: string; lastSyncTime?: string } = { shouldSync: true, message: 'Forced sync' };
      if (!force) {
        check = await this.shouldSync();
      }

      if (!check.shouldSync) {
        logger.debug('sync', `Skipping: ${check.message}`);
        return {
          success: true,
          message: check.message || 'Skipped',
          lastSyncTime: check.lastSyncTime
        };
      }

      logger.info('sync', 'Starting sync', { reason: check.message });

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
      const pendingInventoryItems = await this.prisma.inventoryItem.findMany({
        where: { syncStatus: 'PENDING' }
      });
      const pendingInventoryTxns = await this.prisma.inventoryTransaction.findMany({
        where: { syncStatus: 'PENDING' },
        include: { item: true }
      });

      logger.debug('sync', 'Pending items to upload', {
        patients: pendingPatients.length,
        invoices: pendingInvoices.length,
        treatments: pendingTreatments.length,
        inventoryItems: pendingInventoryItems.length,
        inventoryTransactions: pendingInventoryTxns.length,
      });
      const [totalPatients, totalInvoices, totalTreatments, totalInvItems, totalInvTxns] = await this.prisma.$transaction([
        this.prisma.patient.count(),
        this.prisma.invoice.count(),
        this.prisma.treatment.count(),
        this.prisma.inventoryItem.count(),
        this.prisma.inventoryTransaction.count()
      ]);
      const dbEmpty = totalPatients === 0 && totalInvoices === 0 && totalTreatments === 0 && totalInvItems === 0 && totalInvTxns === 0;
      logger.debug('sync', 'Local DB state', {
        empty: dbEmpty,
        totals: { patients: totalPatients, invoices: totalInvoices, treatments: totalTreatments },
      });

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

      const normalizePaymentMethodForSync = (value: unknown): 'Cash' | 'Card' | 'UPI' | 'Online' | 'Cheque' => {
        if (typeof value !== 'string') return 'Cash';
        const v = value.trim().toLowerCase();
        if (!v) return 'Cash';
        if (v === 'cash') return 'Cash';
        if (v === 'card' || v === 'debit' || v === 'credit') return 'Card';
        if (v === 'upi') return 'UPI';
        if (v === 'online' || v === 'netbanking' || v === 'bank') return 'Online';
        if (v === 'cheque' || v === 'check') return 'Cheque';
        return 'Cash';
      };

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
          paymentMethod: normalizePaymentMethodForSync(inv.paymentMethod),
          TransactionId: inv.TransactionId,
          total: inv.total,
          discount: inv.discount,
          discountType: inv.discountType,
          paymentStatus: inv.paymentStatus,
          amountPaid: inv.amountPaid,
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
        })),
        inventoryItems: pendingInventoryItems.map(it => ({
          id: it.id,
          cloudId: it.cloudId,
          name: it.name,
          description: it.description,
          stock: it.stock,
          costPrice: it.costPrice,
          sellingPrice: it.sellingPrice,
          updatedAt: it.updatedAt.toISOString()
        })),
        inventoryTransactions: pendingInventoryTxns.map(tx => ({
          id: tx.id,
          cloudId: tx.cloudId,
          itemCloudId: tx.item.cloudId,
          itemId: tx.itemId,
          type: tx.type,
          quantity: tx.quantity,
          pricePerUnit: tx.pricePerUnit,
          totalAmount: tx.totalAmount,
          date: tx.date instanceof Date ? tx.date.toISOString() : String(tx.date),
          notes: tx.notes,
          updatedAt: tx.updatedAt.toISOString()
        }))
      };

      const totalItems = pendingPatients.length + pendingInvoices.length + pendingTreatments.length + pendingInventoryItems.length + pendingInventoryTxns.length;
      // Calculate dynamic timeout: 30 seconds base + 500ms per item being synced. Max 5 minutes.
      const dynamicTimeout = Math.min(300000, Math.max(30000, 10000 + (totalItems * 500)));

      logger.debug('sync', 'Uploading payload', {
        url: `${this.backendUrl}/api/sync`,
        totalItems,
        timeoutMs: dynamicTimeout,
        mode: lastSyncTime ? 'incremental' : 'full',
      });

      const response = await http.post(
        `${this.backendUrl}/api/sync`,
        syncPayload,
        {
          timeout: dynamicTimeout,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const { synced, updates } = response.data;

      logger.debug('sync', 'Backend response received', {
        synced: {
          patients: synced?.patients?.length || 0,
          invoices: synced?.invoices?.length || 0,
          treatments: synced?.treatments?.length || 0,
        },
        updates: {
          patients: updates?.patients?.length || 0,
          invoices: updates?.invoices?.length || 0,
          treatments: updates?.treatments?.length || 0,
        },
      });

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
            logger.error('sync', 'Backend tried to change invoice number - refused', {
              originalNumber: invoice.originalNumber,
              attemptedNewNumber: invoice.newNumber,
            });
            // Don't apply the change - keep original number
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
      logger.debug('sync', 'Applying cloud updates', {
        patients: updates.patients?.length || 0,
        invoices: updates.invoices?.length || 0,
        treatments: updates.treatments?.length || 0,
      });

      if ((updates.patients?.length || 0) === 0 && (updates.invoices?.length || 0) === 0 && (updates.treatments?.length || 0) === 0) {
        logger.debug('sync', 'Backend returned zero updates — cloud may be empty or sync endpoint issue');
      }

      // Apply patient updates from cloud
      for (const cloudPatient of updates.patients || []) {
        // Three-way local match, mirrors the backend's dedup logic:
        //   1) match by cloudId                -> update in place
        //   2) match by (firstName+lastName+phone) with no cloudId yet
        //      (local row that was created offline and never got a cloudId)
        //                                       -> bind it to the cloudId and update
        //   3) no match                        -> create
        // The identity fallback prevents the sync loop where 11 duplicate local
        // patients (all NULL uhid) would each create a separate cloud row and then
        // come back as 11 separate cloud rows, each spawning another local row.
        let localPatient = await this.prisma.patient.findFirst({
          where: { cloudId: cloudPatient.id }
        });

        if (!localPatient) {
          const orphan = await this.prisma.patient.findFirst({
            where: {
              cloudId: null,
              firstName: cloudPatient.firstName,
              lastName: cloudPatient.lastName,
              phone: cloudPatient.phone,
            },
          });
          if (orphan) {
            localPatient = orphan;
            logger.debug('sync', 'Re-binding orphan local patient to cloud ID', {
              firstName: cloudPatient.firstName,
              lastName: cloudPatient.lastName,
              phone: cloudPatient.phone,
              cloudId: cloudPatient.id,
            });
          }
        }

        if (localPatient) {
          // Update existing
          await this.prisma.patient.update({
            where: { id: localPatient.id },
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
        } else {
          // Create new from cloud
          logger.debug('sync', `Creating patient from cloud: ${cloudPatient.firstName} ${cloudPatient.lastName}`, { cloudId: cloudPatient.id });
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
          logger.warn('sync', 'Patient with cloud ID not found locally, skipping invoice', { patientCloudId: cloudInvoice.patientId, invoiceNumber: cloudInvoice.invoiceNumber });
          continue;
        }

        // Two-step match: prefer cloudId (fast path), fall back to invoiceNumber
        // (recovers from prior syncs where the local invoice was created offline
        // and never received a cloudId). Without the invoiceNumber fallback the
        // create() call below would crash on the @unique constraint the moment
        // the local row was created with a null cloudId.
        let localInvoice = await this.prisma.invoice.findFirst({
          where: { cloudId: cloudInvoice.id }
        });

        if (!localInvoice) {
          localInvoice = await this.prisma.invoice.findFirst({
            where: { invoiceNumber: cloudInvoice.invoiceNumber }
          });
          if (localInvoice) {
            logger.debug('sync', `Re-binding local invoice to cloud ID`, { invoiceNumber: cloudInvoice.invoiceNumber, cloudId: cloudInvoice.id });
          }
        }

        const invoicePayload = {
          cloudId: cloudInvoice.id,
          invoiceNumber: cloudInvoice.invoiceNumber,
          patientId: localPatient.id,
          date: new Date(cloudInvoice.date),
          diagnosis: cloudInvoice.diagnosis,
          notes: cloudInvoice.notes || '',
          paymentMethod: normalizePaymentMethodForSync(cloudInvoice.paymentMethod),
          TransactionId: cloudInvoice.TransactionId,
          total: cloudInvoice.total,
          discount: cloudInvoice.discount,
          discountType: cloudInvoice.discountType,
          paymentStatus: cloudInvoice.paymentStatus,
          amountPaid: cloudInvoice.amountPaid,
          syncStatus: 'SYNCED',
          lastSyncAt: new Date()
        };

        if (localInvoice) {
          // Update existing
          await this.prisma.invoice.update({
            where: { id: localInvoice.id },
            data: invoicePayload
          });
        } else {
          // Create new from cloud
          logger.debug('sync', `Creating invoice from cloud`, { invoiceNumber: cloudInvoice.invoiceNumber, cloudId: cloudInvoice.id });
          await this.prisma.invoice.create({ data: invoicePayload });
        }
      }

      // Apply treatment updates from cloud
      for (const cloudTreatment of updates.treatments || []) {
        // Find local invoice by cloud ID
        const localInvoice = await this.prisma.invoice.findFirst({
          where: { cloudId: cloudTreatment.invoiceId }
        });

        if (!localInvoice) {
          logger.warn('sync', 'Invoice with cloud ID not found locally, skipping treatment', { invoiceCloudId: cloudTreatment.invoiceId, treatmentName: cloudTreatment.name });
          continue;
        }

        // Three-way local match, mirrors the backend's treatment dedup:
        //   1) match by cloudId                                            -> update in place
        //   2) match by (invoiceId+name+sessions+amount) with no cloudId yet
        //      (local row that was created offline and never got a cloudId)
        //                                                                     -> bind and update
        //   3) no match                                                      -> create
        let localTreatment = await this.prisma.treatment.findFirst({
          where: { cloudId: cloudTreatment.id }
        });

        if (!localTreatment) {
          const orphan = await this.prisma.treatment.findFirst({
            where: {
              cloudId: null,
              invoiceId: localInvoice.id,
              name: cloudTreatment.name,
              sessions: cloudTreatment.sessions,
              amount: cloudTreatment.amount,
            },
          });
          if (orphan) {
            localTreatment = orphan;
            logger.debug('sync', 'Re-binding orphan local treatment to cloud ID', {
              invoiceNumber: localInvoice.invoiceNumber,
              name: cloudTreatment.name,
              cloudId: cloudTreatment.id,
            });
          }
        }

        if (localTreatment) {
          // Update existing
          await this.prisma.treatment.update({
            where: { id: localTreatment.id },
            data: {
              cloudId: cloudTreatment.id,
              invoiceId: localInvoice.id,
              name: cloudTreatment.name,
              sessions: cloudTreatment.sessions,
              startDate: new Date(cloudTreatment.startDate),
              endDate: new Date(cloudTreatment.endDate),
              amount: cloudTreatment.amount,
              syncStatus: 'SYNCED',
              lastSyncAt: new Date()
            }
          });
        } else {
          // Create new from cloud
          logger.debug('sync', `Creating treatment from cloud`, { name: cloudTreatment.name, cloudId: cloudTreatment.id });
          await this.prisma.treatment.create({
            data: {
              cloudId: cloudTreatment.id,
              invoiceId: localInvoice.id,
              name: cloudTreatment.name,
              sessions: cloudTreatment.sessions,
              startDate: new Date(cloudTreatment.startDate),
              endDate: new Date(cloudTreatment.endDate),
              amount: cloudTreatment.amount,
              syncStatus: 'SYNCED',
              lastSyncAt: new Date()
            }
          });
        }
      }

      // === UPDATE LOCAL DB WITH INVENTORY CLOUD IDs ===

      // Update inventory items with cloud IDs
      if (synced.inventoryItems) {
        for (const item of synced.inventoryItems) {
          if (item.localId && item.cloudId) {
            await this.prisma.inventoryItem.update({
              where: { id: item.localId },
              data: {
                cloudId: item.cloudId,
                syncStatus: 'SYNCED',
                lastSyncAt: new Date()
              }
            });
          }
        }
      }

      // Update inventory transactions with cloud IDs
      if (synced.inventoryTransactions) {
        for (const txn of synced.inventoryTransactions) {
          if (txn.localId && txn.cloudId) {
            await this.prisma.inventoryTransaction.update({
              where: { id: txn.localId },
              data: {
                cloudId: txn.cloudId,
                syncStatus: 'SYNCED',
                lastSyncAt: new Date()
              }
            });
          }
        }
      }

      // === APPLY CLOUD INVENTORY UPDATES ===
      // Apply inventory item updates from cloud
      if (updates.inventoryItems) {
        for (const cloudItem of updates.inventoryItems) {
          let localItem = await this.prisma.inventoryItem.findFirst({
            where: { cloudId: cloudItem.id }
          });

          if (!localItem) {
            const orphan = await this.prisma.inventoryItem.findFirst({
              where: { cloudId: null, name: cloudItem.name }
            });
            if (orphan) {
              localItem = orphan;
            }
          }

          const itemPayload = {
            cloudId: cloudItem.id,
            name: cloudItem.name,
            description: cloudItem.description,
            stock: cloudItem.stock,
            costPrice: cloudItem.costPrice,
            sellingPrice: cloudItem.sellingPrice,
            syncStatus: 'SYNCED',
            lastSyncAt: new Date()
          };

          if (localItem) {
            await this.prisma.inventoryItem.update({
              where: { id: localItem.id },
              data: itemPayload
            });
          } else {
            await this.prisma.inventoryItem.create({ data: itemPayload });
          }
        }
      }

      // Apply inventory transaction updates from cloud
      if (updates.inventoryTransactions) {
        for (const cloudTxn of updates.inventoryTransactions) {
          const localItem = await this.prisma.inventoryItem.findFirst({
            where: { cloudId: cloudTxn.itemId }
          });
          if (!localItem) {
            logger.warn('sync', 'Inventory item with cloud ID not found locally, skipping transaction', { itemCloudId: cloudTxn.itemId });
            continue;
          }

          let localTxn = await this.prisma.inventoryTransaction.findFirst({
            where: { cloudId: cloudTxn.id }
          });

          const txnPayload = {
            cloudId: cloudTxn.id,
            itemId: localItem.id,
            type: cloudTxn.type,
            quantity: cloudTxn.quantity,
            pricePerUnit: cloudTxn.pricePerUnit,
            totalAmount: cloudTxn.totalAmount,
            date: cloudTxn.date instanceof Date ? cloudTxn.date : new Date(cloudTxn.date),
            notes: cloudTxn.notes,
            syncStatus: 'SYNCED',
            lastSyncAt: new Date()
          };

          if (localTxn) {
            await this.prisma.inventoryTransaction.update({
              where: { id: localTxn.id },
              data: txnPayload
            });
          } else {
            await this.prisma.inventoryTransaction.create({ data: txnPayload });
          }
        }
      }

      // === CLEANUP: Remove local records not in cloud (cloud is source of truth) ===
      // ONLY cleanup if we successfully uploaded all pending changes
      // This prevents deleting local data that hasn't been synced yet
      const remainingPending = await this.prisma.$transaction([
        this.prisma.patient.count({ where: { syncStatus: 'PENDING' } }),
        this.prisma.invoice.count({ where: { syncStatus: 'PENDING' } }),
        this.prisma.treatment.count({ where: { syncStatus: 'PENDING' } }),
        this.prisma.inventoryItem.count({ where: { syncStatus: 'PENDING' } }),
        this.prisma.inventoryTransaction.count({ where: { syncStatus: 'PENDING' } })
      ]);
      const hasPendingData = remainingPending.some(count => count > 0);

      if (hasPendingData) {
        logger.debug('sync', 'Skipping cleanup: pending local changes', {
          pending: {
            patients: remainingPending[0],
            invoices: remainingPending[1],
            treatments: remainingPending[2],
            inventoryItems: remainingPending[3],
            inventoryTransactions: remainingPending[4],
          },
        });
      } else if (!lastSyncTime) {
        // Safe to cleanup ONLY on full sync.
        // Incremental sync returns only *recently updated* cloud records, not a full snapshot.
        // If we cleanup during incremental sync, we'd incorrectly delete valid local records.
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
            logger.debug('sync', 'Removed patients that no longer exist in cloud', { count: deletedPatients.count });
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
            logger.debug('sync', 'Removed invoices that no longer exist in cloud', { count: deletedInvoices.count });
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
            logger.debug('sync', 'Removed treatments that no longer exist in cloud', { count: deletedTreatments.count });
          }
        }

        const cloudInvItemIds = (updates.inventoryItems || []).map((i: any) => i.id);
        if (cloudInvItemIds.length > 0) {
          const deletedItems = await this.prisma.inventoryItem.deleteMany({
            where: { cloudId: { not: null, notIn: cloudInvItemIds }, syncStatus: 'SYNCED' }
          });
          if (deletedItems.count > 0) {
            logger.debug('sync', 'Removed inventory items that no longer exist in cloud', { count: deletedItems.count });
          }
        }

        const cloudInvTxnIds = (updates.inventoryTransactions || []).map((t: any) => t.id);
        if (cloudInvTxnIds.length > 0) {
          const deletedTxns = await this.prisma.inventoryTransaction.deleteMany({
            where: { cloudId: { not: null, notIn: cloudInvTxnIds }, syncStatus: 'SYNCED' }
          });
          if (deletedTxns.count > 0) {
            logger.debug('sync', 'Removed inventory transactions that no longer exist in cloud', { count: deletedTxns.count });
          }
        }
      } else {
        logger.debug('sync', 'Skipping cleanup: incremental sync does not include full cloud snapshot');
      }

      // === SYNC TREATMENT PRESETS ===
      let presetStats: { fetched: number; created: number; updated: number; unchanged: number; error?: string } = { fetched: 0, created: 0, updated: 0, unchanged: 0 };
      try {
        logger.debug('sync', 'Fetching treatment presets', { url: `${this.backendUrl}/api/presets` });
        const presetsResponse = await http.get(`${this.backendUrl}/api/presets`, {
          timeout: 10000
        });

        if (presetsResponse.data.success && Array.isArray(presetsResponse.data.presets)) {
          const cloudPresets = presetsResponse.data.presets;
          presetStats.fetched = cloudPresets.length;
          logger.debug('sync', 'Received presets from cloud', { count: cloudPresets.length });

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
          logger.debug('sync', 'Presets synced', { created: presetStats.created, updated: presetStats.updated });
        }
      } catch (presetError) {
        logger.warn('sync', 'Failed to sync presets', { error: presetError instanceof Error ? presetError.message : String(presetError) });
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
      const totalDownloaded = (updates.patients?.length || 0) + (updates.invoices?.length || 0) + (updates.treatments?.length || 0)
        + (updates.inventoryItems?.length || 0) + (updates.inventoryTransactions?.length || 0);
      const totalUploaded = synced.patients.length + synced.invoices.length + synced.treatments.length
        + (synced.inventoryItems?.length || 0) + (synced.inventoryTransactions?.length || 0);

      clearAllCache();
      logger.info('sync', 'Sync completed', {
        uploaded: { total: totalUploaded, patients: synced.patients.length, invoices: synced.invoices.length, treatments: synced.treatments.length, inventoryItems: synced.inventoryItems?.length || 0, inventoryTransactions: synced.inventoryTransactions?.length || 0 },
        downloaded: { total: totalDownloaded, patients: updates.patients?.length || 0, invoices: updates.invoices?.length || 0, treatments: updates.treatments?.length || 0, inventoryItems: updates.inventoryItems?.length || 0, inventoryTransactions: updates.inventoryTransactions?.length || 0 },
      });

      // Notify renderer process about sync completion
      this.notifyRenderer('sync-completed', {
        timestamp: syncTime,
        synced: {
          patients: synced.patients.length,
          invoices: synced.invoices.length,
          treatments: synced.treatments.length,
          inventoryItems: synced.inventoryItems?.length || 0,
          inventoryTransactions: synced.inventoryTransactions?.length || 0,
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
      logger.error('sync', 'Sync failed', { error: error instanceof Error ? error.message : String(error) });

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
      if (this.pendingSync) {
        this.pendingSync = false;
        logger.debug('sync', 'Running queued sync');
        this.performSync().catch(() => {});
      }
    }
  }

  /**
   * Check if backend is reachable
   */
  private async checkConnectivity(): Promise<boolean> {
    try {
      await http.get(`${this.backendUrl}/health`, {
        timeout: PrismaSyncEngine.HEALTH_TIMEOUT_MS
      });
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
      this.prisma.treatment.count({ where: { syncStatus: 'PENDING' } }),
      this.prisma.inventoryItem.count({ where: { syncStatus: 'PENDING' } }),
      this.prisma.inventoryTransaction.count({ where: { syncStatus: 'PENDING' } })
    ]);

    const lastSync = await this.prisma.syncLog.findFirst({
      where: { status: 'success' },
      orderBy: { createdAt: 'desc' }
    });

    return {
      pendingChanges: pendingCount.reduce((a, b) => a + b, 0),
      patients: pendingCount[0],
      invoices: pendingCount[1],
      treatments: pendingCount[2],
      inventoryItems: pendingCount[3],
      inventoryTransactions: pendingCount[4],
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
