import { ipcMain } from 'electron';
import { getPrismaClient } from '../database/prisma';
import { PrismaSyncEngine } from '../sync/prismaSyncEngine';
import { getBackendUrl } from '../config/backend';
import { logError } from '../utils/errorLogger';
import axios from '../services/http';

export function registerSyncHandlers(syncEngine: PrismaSyncEngine | null) {
    const prisma = getPrismaClient();

    ipcMain.handle('sync-now', async () => {
        try {
            if (!syncEngine) {
                throw new Error('Sync engine not initialized');
            }

            const result = await syncEngine.performSync(true);

            // Reset auto-sync timer after manual sync (restart 5-minute countdown)
            if (result.success) {
                syncEngine.resetAutoSyncTimer(5 * 60 * 1000); // 5 minutes
            }

            return { success: true, result };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('force-sync-push', async () => {
        try {
            if (!prisma) throw new Error('Prisma not initialized');

            console.log('⚠️ Forcing all local records to PENDING...');

            const p = await prisma.patient.updateMany({
                where: { cloudId: null },
                data: { syncStatus: 'PENDING' }
            });
            const i = await prisma.invoice.updateMany({
                where: { cloudId: null },
                data: { syncStatus: 'PENDING' }
            });
            const t = await prisma.treatment.updateMany({
                where: { cloudId: null },
                data: { syncStatus: 'PENDING' }
            });

            console.log(`Updated status to PENDING: ${p.count} patients, ${i.count} invoices, ${t.count} treatments`);

            // Trigger sync immediately
            if (syncEngine) {
                return syncEngine.performSync(true);
            }
            return { success: true, message: `Ready to sync: ${p.count} patients, ${i.count} invoices` };

        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('get-sync-status', async () => {
        try {
            if (!syncEngine) {
                throw new Error('Sync engine not initialized');
            }

            const status = await syncEngine.getSyncStatus();
            return { success: true, status };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('reset-local-database', async () => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            console.log('⚠️  Resetting local database...');

            // Delete all records in transaction
            await prisma.$transaction(async (tx) => {
                const deletedTreatments = await tx.treatment.deleteMany();
                console.log(`   Deleted ${deletedTreatments.count} treatments`);

                const deletedInvoices = await tx.invoice.deleteMany();
                console.log(`   Deleted ${deletedInvoices.count} invoices`);

                const deletedPatients = await tx.patient.deleteMany();
                console.log(`   Deleted ${deletedPatients.count} patients`);

                const deletedPresets = await tx.treatmentPreset.deleteMany();
                console.log(`   Deleted ${deletedPresets.count} treatment presets`);
            });

            console.log('✅ Local database reset successfully');
            return { success: true, message: 'Local database reset successfully' };
        } catch (error) {
            logError('Reset local database', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('reset-sync-timestamp', async () => {
        try {
            if (!syncEngine) {
                throw new Error('Sync engine not initialized');
            }

            console.log('🔄 Resetting sync timestamp to force full sync...');
            
            // Reset the lastSyncTime to null to trigger a full sync
            await syncEngine.resetSyncTimestamp();

            console.log('✅ Sync timestamp reset - next sync will fetch ALL cloud data');
            return { success: true, message: 'Sync timestamp reset successfully' };
        } catch (error) {
            logError('Reset sync timestamp', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('reset-cloud-database', async () => {
        try {
            const backendUrl = getBackendUrl();

            console.log(`⚠️  Resetting cloud database via backend: ${backendUrl}`);

            const response = await axios.post(`${backendUrl}/api/database/reset`, {}, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success) {
                console.log('✅ Cloud database reset successfully');
                return { success: true, message: 'Cloud database reset successfully' };
            } else {
                throw new Error(response.data.error || 'Failed to reset cloud database');
            }
        } catch (error: any) {
            console.error('Cloud database reset error:', error.response?.data || error.message);
            logError('Reset cloud database', error);
            return {
                success: false,
                error: error.response?.data?.error || error.message || String(error)
            };
        }
    });

    ipcMain.handle('reset-all-databases', async () => {
        try {
            console.log('⚠️  Resetting both local and cloud databases...');

            // IMPORTANT: Stop auto-sync during reset to prevent data from syncing back
            if (syncEngine) {
                console.log('   ⏸️  Pausing auto-sync during reset...');
                syncEngine.stopAutoSync();
            }

            // Step 1: Reset CLOUD database FIRST (so it doesn't sync back)
            const backendUrl = getBackendUrl();

            console.log(`   1️⃣ Resetting cloud database via: ${backendUrl}`);
            try {
                const cloudResponse = await axios.post(`${backendUrl}/api/database/reset`, {}, {
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!cloudResponse.data.success) {
                    throw new Error(cloudResponse.data.error || 'Failed to reset cloud database');
                }
                console.log('   ✅ Cloud database reset successfully');
            } catch (cloudError: any) {
                console.error('   ❌ Cloud database reset failed:', cloudError.response?.data || cloudError.message);
                throw new Error(`Cloud reset failed: ${cloudError.response?.data?.error || cloudError.message}`);
            }

            // Step 2: Reset LOCAL database
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            console.log('   2️⃣ Resetting local database...');
            await prisma.$transaction(async (tx) => {
                const deletedTreatments = await tx.treatment.deleteMany();
                console.log(`      ✓ Deleted ${deletedTreatments.count} local treatments`);

                const deletedInvoices = await tx.invoice.deleteMany();
                console.log(`      ✓ Deleted ${deletedInvoices.count} local invoices`);

                const deletedPatients = await tx.patient.deleteMany();
                console.log(`      ✓ Deleted ${deletedPatients.count} local patients`);

                const deletedPresets = await tx.treatmentPreset.deleteMany();
                console.log(`      ✓ Deleted ${deletedPresets.count} local treatment presets`);
            });
            console.log('   ✅ Local database reset successfully');

            // Step 3: Wait a moment to ensure everything is committed
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Step 4: Resume auto-sync
            if (syncEngine) {
                console.log('   ▶️  Resuming auto-sync...');
                syncEngine.startAutoSync(30 * 60 * 1000); // 30 minutes
            }

            console.log('✅ All databases reset successfully');
            return {
                success: true,
                message: 'All databases (local and cloud) reset successfully'
            };
        } catch (error: any) {
            // Resume auto-sync even if reset failed
            if (syncEngine) {
                syncEngine.startAutoSync(30 * 60 * 1000);
            }

            console.error('❌ Reset all databases failed:', error);
            logError('Reset all databases', error);
            return {
                success: false,
                error: error.response?.data?.error || error.message || String(error)
            };
        }
    });

    ipcMain.handle('get-database-stats', async () => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            const [patients, invoices, treatments, treatmentPresets] = await Promise.all([
                prisma.patient.count(),
                prisma.invoice.count(),
                prisma.treatment.count(),
                prisma.treatmentPreset.count()
            ]);

            console.log(`📊 Database stats: ${patients} patients, ${invoices} invoices, ${treatments} treatments, ${treatmentPresets} presets`);

            return {
                success: true,
                stats: {
                    patients,
                    invoices,
                    treatments,
                    treatmentPresets
                }
            };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });
}
