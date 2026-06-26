import { ipcMain } from 'electron';
import { getPrismaClient } from '../database/prisma';
import { getBackendUrl } from '../config/backend';
import axios from '../services/http';
import { logError, logSuccess } from '../utils/errorLogger';
import { logger } from '../utils/logger';
import { predictor } from '../services/diagnosisNGram';
import {
  loadClinicalData,
  searchClinical,
  resolveShortcuts,
  getRecentClinical,
  incrementClinicalFrequency,
  addCustomClinical,
  reloadClinicalData,
  type ClinicalCategory,
} from '../services/clinicalSearch';

const VALID_CATEGORIES: ClinicalCategory[] = ['diagnosis', 'exercise'];

function parseCategory(value: unknown): ClinicalCategory {
  return value === 'exercise' ? 'exercise' : 'diagnosis';
}

export function registerClinicalHandlers() {
  const backendUrl = getBackendUrl();
  loadClinicalData().catch((e) => logger.error('clinical', 'Initial clinical load failed', { error: e instanceof Error ? e.message : String(e) }));

  ipcMain.handle('get-clinical-suggestions', async (_event, category: unknown, query: string, limit: number = 20) => {
    try {
      const cat = parseCategory(category);
      if (cat === 'diagnosis') {
        const shortcut = resolveShortcuts(query);
        if (shortcut) {
          return { success: true, suggestions: [{ id: 0, name: shortcut, category: cat, frequency: 0, score: 0 }], resolvedShortcut: shortcut };
        }
      }
      const suggestions = searchClinical(cat, query, limit);
      return { success: true, suggestions };
    } catch (error) {
      return { success: false, error: String(error), suggestions: [] };
    }
  });

  ipcMain.handle('get-next-clinical-predictions', async (_event, textBefore: string, limit: number = 10) => {
    try {
      const words = predictor.predict(textBefore, limit);
      return { success: true, suggestions: words.map(w => ({ name: w, score: 0 })) };
    } catch (error) {
      return { success: false, error: String(error), suggestions: [] };
    }
  });

  ipcMain.handle('get-recent-clinical', async (_event, category: unknown, limit: number = 10) => {
    try {
      const cat = parseCategory(category);
      const items = getRecentClinical(cat, limit);
      return { success: true, items };
    } catch (error) {
      return { success: false, error: String(error), items: [] };
    }
  });

  ipcMain.handle('increment-clinical-frequency', async (_event, category: unknown, name: string) => {
    try {
      const cat = parseCategory(category);
      await incrementClinicalFrequency(cat, name);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('add-custom-clinical', async (_event, category: unknown, name: string) => {
    try {
      const cat = parseCategory(category);
      await addCustomClinical(cat, name);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('load-clinical-presets', async (_event, category?: unknown) => {
    try {
      const prisma = getPrismaClient();
      if (!prisma) throw new Error('Prisma not initialized');
      const where = category && VALID_CATEGORIES.includes(category as ClinicalCategory)
        ? { category: category as ClinicalCategory }
        : undefined;
      const presets = await prisma.clinicalPreset.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      return { success: true, presets };
    } catch (error) {
      return { success: false, error: String(error), presets: [] };
    }
  });

  ipcMain.handle('delete-clinical-preset', async (_event, id: number) => {
    try {
      const prisma = getPrismaClient();
      if (!prisma) throw new Error('Prisma not initialized');
      await prisma.clinicalPreset.delete({ where: { id } });
      await reloadClinicalData();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('sync-clinical-presets-from-cloud', async () => {
    try {
      const prisma = getPrismaClient();
      if (!prisma) throw new Error('Prisma not initialized');

      const categories: ClinicalCategory[] = ['diagnosis', 'exercise'];
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalUnchanged = 0;
      let totalFetched = 0;

      for (const category of categories) {
        logger.info('clinical', 'Syncing clinical presets from cloud', { category, url: `${backendUrl}/api/clinical/presets?category=${category}` });
        const response = await axios.get(`${backendUrl}/api/clinical/presets`, {
          params: { category },
          timeout: 20000,
        });

        if (!response.data.success || !Array.isArray(response.data.presets)) {
          throw new Error(`Invalid response from server for ${category}`);
        }

        const cloudPresets = response.data.presets;
        totalFetched += cloudPresets.length;
        logger.debug('clinical', 'Received clinical presets from cloud', { category, count: cloudPresets.length });

        for (const cloudPreset of cloudPresets) {
          const localPreset = await prisma.clinicalPreset.findFirst({
            where: { name: cloudPreset.name, category },
          });

          if (localPreset) {
            if (localPreset.frequency !== cloudPreset.frequency) {
              await prisma.clinicalPreset.update({
                where: { id: localPreset.id },
                data: { frequency: cloudPreset.frequency },
              });
              totalUpdated++;
            } else {
              totalUnchanged++;
            }
          } else {
            await prisma.clinicalPreset.create({
              data: {
                name: cloudPreset.name,
                category,
                frequency: cloudPreset.frequency ?? 0,
                syncStatus: 'SYNCED',
              },
            });
            totalCreated++;
          }
        }
      }

      await reloadClinicalData();
      logSuccess('Clinical preset sync', `${totalCreated} created, ${totalUpdated} updated`);
      return {
        success: true,
        stats: { fetched: totalFetched, created: totalCreated, updated: totalUpdated, unchanged: totalUnchanged },
      };
    } catch (error) {
      logError('Clinical preset sync', error);
      return {
        success: false,
        error: `Sync failed against ${backendUrl}: ${error instanceof Error ? error.message : String(error)}`,
        stats: { fetched: 0, created: 0, updated: 0, unchanged: 0 },
      };
    }
  });
}
