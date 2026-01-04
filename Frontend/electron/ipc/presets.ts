import { ipcMain } from 'electron';
import { getPrismaClient } from '../database/prisma';
import { logError, logInfo, logSuccess } from '../utils/errorLogger';
import axios from '../services/http';
import { getBackendUrl } from '../config/backend';

export function registerPresetHandlers() {
    const prisma = getPrismaClient();
    const backendUrl = getBackendUrl();
    const syncTimeoutMs = 20000;

    // Load treatment presets
    ipcMain.handle('load-treatment-presets', async () => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            const presets = await prisma.treatmentPreset.findMany({
                orderBy: { name: 'asc' }
            });

            return { success: true, presets };
        } catch (error) {
            return { success: false, error: String(error), presets: [] };
        }
    });

    // Sync presets from cloud to local database
    ipcMain.handle('sync-presets-from-cloud', async () => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            const backendUrl = getBackendUrl();
            console.log(`📋 Syncing presets from: ${backendUrl}/api/presets`);

            // Fetch presets from cloud
            const response = await axios.get(`${backendUrl}/api/presets`, {
                timeout: syncTimeoutMs
            });

            if (!response.data.success || !Array.isArray(response.data.presets)) {
                throw new Error('Invalid response from server');
            }

            const cloudPresets = response.data.presets;
            console.log(`📋 Received ${cloudPresets.length} presets from cloud`);
            
            const stats = {
                fetched: cloudPresets.length,
                created: 0,
                updated: 0,
                unchanged: 0
            };

            // Merge cloud presets with local database
            for (const cloudPreset of cloudPresets) {
                // Check if preset exists locally by name (presets don't have cloudId field)
                const localPreset = await prisma.treatmentPreset.findFirst({
                    where: {
                        name: cloudPreset.name
                    }
                });

                if (localPreset) {
                    // Update if different
                    const needsUpdate =
                        localPreset.defaultSessions !== cloudPreset.defaultSessions ||
                        localPreset.pricePerSession !== cloudPreset.pricePerSession;

                    if (needsUpdate) {
                        await prisma.treatmentPreset.update({
                            where: { id: localPreset.id },
                            data: {
                                defaultSessions: cloudPreset.defaultSessions,
                                pricePerSession: cloudPreset.pricePerSession
                            }
                        });
                        stats.updated++;
                        logInfo('Preset sync', `Updated: ${cloudPreset.name}`);
                    } else {
                        stats.unchanged++;
                    }
                } else {
                    // Create new preset
                    await prisma.treatmentPreset.create({
                        data: {
                            name: cloudPreset.name,
                            defaultSessions: cloudPreset.defaultSessions,
                            pricePerSession: cloudPreset.pricePerSession
                        }
                    });
                    stats.created++;
                    logInfo('Preset sync', `Created: ${cloudPreset.name}`);
                }
            }

            logSuccess('Preset sync', `${stats.created} created, ${stats.updated} updated`);
            return { success: true, stats };
        } catch (error) {
            logError('Preset sync', error);
            return {
                success: false,
                error: `Sync failed against ${backendUrl}: ${error instanceof Error ? error.message : String(error)}`,
                stats: { fetched: 0, created: 0, updated: 0, unchanged: 0 }
            };
        }
    });

    ipcMain.handle('add-treatment-preset', async (_event, presetData: any) => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            // Create locally first
            const preset = await prisma.treatmentPreset.create({
                data: {
                    name: presetData.name,
                    defaultSessions: presetData.defaultSessions,
                    pricePerSession: presetData.pricePerSession
                }
            });

            // Sync to cloud in background
            try {
                await axios.post(`${backendUrl}/api/presets/sync`, {
                    presets: [{
                        name: preset.name,
                        defaultSessions: preset.defaultSessions,
                        pricePerSession: preset.pricePerSession
                    }]
                }, {
                    timeout: 5000
                });
                logInfo('Cloud sync', `Preset uploaded: ${preset.name}`);
            } catch (syncError) {
                console.warn('⚠️ Failed to sync preset to cloud (will retry later):', syncError);
            }

            return { success: true, preset };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('update-treatment-preset', async (_event, { id, ...presetData }: any) => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            // Update locally first
            const preset = await prisma.treatmentPreset.update({
                where: { id },
                data: {
                    name: presetData.name,
                    defaultSessions: presetData.defaultSessions,
                    pricePerSession: presetData.pricePerSession
                }
            });

            // Sync to cloud in background
            try {
                // Use sync endpoint which matches by NAME
                await axios.post(`${backendUrl}/api/presets/sync`, {
                    presets: [{
                        name: preset.name,
                        defaultSessions: preset.defaultSessions,
                        pricePerSession: preset.pricePerSession
                    }]
                }, {
                    timeout: 5000
                });
                logInfo('Cloud sync', `Preset updated: ${preset.name}`);
            } catch (syncError) {
                console.warn('⚠️ Failed to update preset in cloud (will retry later):', syncError);
            }

            return { success: true, preset };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('delete-treatment-preset', async (_event, id: number) => {
        try {
            if (!prisma) {
                throw new Error('Prisma not initialized');
            }

            // Delete only from local database
            // NOTE: Presets are cloud-managed, so local deletions do NOT sync to cloud
            // The preset will be re-synced from cloud on the next sync
            await prisma.treatmentPreset.delete({
                where: { id }
            });

            console.log(`✅ Deleted preset ${id} from local database (cloud unchanged)`);
            return { success: true };
        } catch (error) {
            console.error('Failed to delete preset', error);
            return { success: false, error: String(error) };
        }
    });
}
