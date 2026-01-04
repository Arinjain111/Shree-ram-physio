"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaSyncEngine = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../database/prisma");
const electron_1 = require("electron");
class PrismaSyncEngine {
    constructor(backendUrl) {
        this.syncInterval = null;
        this.isSyncing = false;
        this.prisma = (0, prisma_1.getPrismaClient)();
        this.backendUrl = backendUrl;
    }
    /**
     * Send notification to renderer process
     */
    notifyRenderer(channel, data) {
        const windows = electron_1.BrowserWindow.getAllWindows();
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
    startAutoSync(intervalMs = 5 * 60 * 1000) {
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
    resetAutoSyncTimer(intervalMs = 5 * 60 * 1000) {
        console.log('Resetting auto-sync timer...');
        this.stopAutoSync();
        this.startAutoSync(intervalMs);
    }
    /**
     * Smart Polling: Check if sync is needed
     */
    async shouldSync() {
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
            const statusResponse = await axios_1.default.get(`${this.backendUrl}/api/sync/status`, { timeout: 5000 });
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
        }
        catch (error) {
            console.warn('⚠️ Status check failed, falling back to safe full sync:', error);
            return { shouldSync: true, message: 'Status check failed' };
        }
    }
    /**
     * Perform a full bidirectional sync
     */
    async performSync(force = false) {
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
            let check = { shouldSync: true, message: 'Forced sync' };
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
            console.log('🔄 Starting full sync...');
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
            console.log(`📊 Local DB empty: ${pendingPatients.length === 0 && pendingInvoices.length === 0 && pendingTreatments.length === 0 ? 'YES - should fetch ALL from cloud' : 'NO'}`);
            // === PREPARE DATA FOR UPLOAD ===
            // ALWAYS use lastSyncTime: null to fetch ALL cloud data (cloud is source of truth)
            const syncPayload = {
                lastSyncTime: null, // Always fetch ALL from cloud, not just recent updates
                patients: pendingPatients.map(p => ({
                    id: p.id,
                    cloudId: p.cloudId,
                    firstName: p.firstName,
                    lastName: p.lastName,
                    age: p.age,
                    gender: p.gender,
                    phone: p.phone,
                    uhid: p.uhid,
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
            console.log(`📅 Full sync mode: Fetching ALL cloud data + uploading pending local changes`);
            const response = await axios_1.default.post(`${this.backendUrl}/api/sync`, syncPayload, {
                timeout: 30000,
                headers: { 'Content-Type': 'application/json' }
            });
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
                    await this.prisma.patient.update({
                        where: { id: patient.localId },
                        data: {
                            cloudId: patient.cloudId,
                            syncStatus: 'SYNCED',
                            lastSyncAt: new Date()
                        }
                    });
                }
            }
            // Update invoices with cloud IDs
            for (const invoice of synced.invoices) {
                if (invoice.localId && invoice.cloudId) {
                    const updateData = {
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
            }
            else {
                console.log('📦 Update details:', {
                    patients: updates.patients?.map((p) => `${p.firstName} ${p.lastName} (ID: ${p.id})`),
                    invoices: updates.invoices?.map((i) => `Invoice ${i.invoiceNumber} (ID: ${i.id})`),
                    treatments: updates.treatments?.map((t) => `${t.name} (ID: ${t.id})`)
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
                }
                else {
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
                }
                else {
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
                }
                else {
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
            }
            else {
                // Safe to cleanup - all local changes have been synced
                const cloudPatientIds = (updates.patients || []).map((p) => p.id);
                const cloudInvoiceIds = (updates.invoices || []).map((i) => i.id);
                const cloudTreatmentIds = (updates.treatments || []).map((t) => t.id);
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
            let presetStats = { fetched: 0, created: 0, updated: 0, unchanged: 0 };
            try {
                console.log(`📋 Fetching treatment presets from ${this.backendUrl}/api/presets`);
                const presetsResponse = await axios_1.default.get(`${this.backendUrl}/api/presets`, {
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
                            const needsUpdate = localPreset.defaultSessions !== cloudPreset.defaultSessions ||
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
                            }
                            else {
                                presetStats.unchanged++;
                            }
                        }
                        else {
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
            }
            catch (presetError) {
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
        }
        catch (error) {
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
        }
        finally {
            this.isSyncing = false;
        }
    }
    /**
     * Check if backend is reachable
     */
    async checkConnectivity() {
        try {
            await axios_1.default.get(`${this.backendUrl}/health`, { timeout: 5000 });
            return true;
        }
        catch {
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
exports.PrismaSyncEngine = PrismaSyncEngine;
