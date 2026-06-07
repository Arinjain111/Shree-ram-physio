import { ipcMain } from 'electron';
import { getPrismaClient } from '../database/prisma';
import { getBackendUrl } from '../config/backend';
import axios from '../services/http';
import { logError, logSuccess } from '../utils/errorLogger';
import { logger } from '../utils/logger';
import { predictor } from '../services/diagnosisNGram';
import {
  loadDiagnosisData,
  searchDiagnoses,
  resolveShortcuts,
  getRecentDiagnoses,
  incrementDiagnosisFrequency,
  addCustomDiagnosis,
  reloadDiagnosisData,
} from '../services/diagnosisSearch';

export function registerDiagnosisHandlers() {
  const backendUrl = getBackendUrl();
  loadDiagnosisData().catch((e) => logger.error('diagnosis', 'Initial diagnosis load failed', { error: e instanceof Error ? e.message : String(e) }));

  ipcMain.handle('get-diagnosis-suggestions', async (_event, query: string, limit: number = 20) => {
    try {
      const shortcut = resolveShortcuts(query);
      if (shortcut) {
        return { success: true, suggestions: [{ name: shortcut, frequency: 0, score: 0 }], resolvedShortcut: shortcut };
      }

      const suggestions = searchDiagnoses(query, limit);
      return { success: true, suggestions };
    } catch (error) {
      return { success: false, error: String(error), suggestions: [] };
    }
  });

  ipcMain.handle('get-next-word-predictions', async (_event, textBefore: string, limit: number = 10) => {
    try {
      const words = predictor.predict(textBefore, limit);
      return { success: true, suggestions: words.map(w => ({ name: w, score: 0 })) };
    } catch (error) {
      return { success: false, error: String(error), suggestions: [] };
    }
  });

  ipcMain.handle('get-recent-diagnoses', async (_event, limit: number = 10) => {
    try {
      const diagnoses = getRecentDiagnoses(limit);
      return { success: true, diagnoses };
    } catch (error) {
      return { success: false, error: String(error), diagnoses: [] };
    }
  });

  ipcMain.handle('increment-diagnosis-frequency', async (_event, name: string) => {
    try {
      await incrementDiagnosisFrequency(name);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('add-custom-diagnosis', async (_event, name: string) => {
    try {
      await addCustomDiagnosis(name);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('load-diagnosis-presets', async () => {
    try {
      const prisma = getPrismaClient();
      if (!prisma) throw new Error('Prisma not initialized');
      const presets = await prisma.diagnosisPreset.findMany({ orderBy: { name: 'asc' } });
      return { success: true, presets };
    } catch (error) {
      return { success: false, error: String(error), presets: [] };
    }
  });

  ipcMain.handle('delete-diagnosis-preset', async (_event, id: number) => {
    try {
      const prisma = getPrismaClient();
      if (!prisma) throw new Error('Prisma not initialized');
      await prisma.diagnosisPreset.delete({ where: { id } });
      await reloadDiagnosisData();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('sync-diagnosis-presets-from-cloud', async () => {
    try {
      const prisma = getPrismaClient();
      if (!prisma) throw new Error('Prisma not initialized');

      logger.info('diagnosis', 'Syncing diagnosis presets from cloud', { url: `${backendUrl}/api/diagnosis/presets` });
      const response = await axios.get(`${backendUrl}/api/diagnosis/presets`, { timeout: 20000 });

      if (!response.data.success || !Array.isArray(response.data.presets)) {
        throw new Error('Invalid response from server');
      }

      const cloudPresets = response.data.presets;
      logger.debug('diagnosis', 'Received diagnosis presets from cloud', { count: cloudPresets.length });

      const stats = { fetched: cloudPresets.length, created: 0, updated: 0, unchanged: 0 };

      for (const cloudPreset of cloudPresets) {
        const localPreset = await prisma.diagnosisPreset.findFirst({
          where: { name: cloudPreset.name }
        });

        if (localPreset) {
          if (localPreset.frequency !== cloudPreset.frequency) {
            await prisma.diagnosisPreset.update({
              where: { id: localPreset.id },
              data: { frequency: cloudPreset.frequency }
            });
            stats.updated++;
          } else {
            stats.unchanged++;
          }
        } else {
          await prisma.diagnosisPreset.create({
            data: {
              name: cloudPreset.name,
              frequency: cloudPreset.frequency ?? 0,
              syncStatus: 'SYNCED'
            }
          });
          stats.created++;
        }
      }

      await reloadDiagnosisData();
      logSuccess('Diagnosis preset sync', `${stats.created} created, ${stats.updated} updated`);
      return { success: true, stats };
    } catch (error) {
      logError('Diagnosis preset sync', error);
      return {
        success: false,
        error: `Sync failed against ${backendUrl}: ${error instanceof Error ? error.message : String(error)}`,
        stats: { fetched: 0, created: 0, updated: 0, unchanged: 0 }
      };
    }
  });
}
