import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

type ClinicalCategory = 'diagnosis' | 'exercise';

function parseCategory(input: unknown): ClinicalCategory {
  return input === 'exercise' ? 'exercise' : 'diagnosis';
}

export const getAllPresets = async (req: Request, res: Response) => {
  const category = parseCategory(req.query.category);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;

  const presets = await prisma.clinicalPreset.findMany({
    where: { category },
    orderBy: { frequency: 'desc' },
    ...(page !== undefined && pageSize !== undefined
      ? { skip: (page - 1) * pageSize, take: pageSize }
      : {}),
  });

  const total = await prisma.clinicalPreset.count({ where: { category } });

  res.json({
    success: true,
    presets,
    pagination: page !== undefined && pageSize !== undefined
      ? { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
      : undefined,
  });
};

export const getAllShortcuts = async (_req: Request, res: Response) => {
  const shortcuts = await prisma.diagnosisShortcut.findMany({
    orderBy: { shortcut: 'asc' },
  });

  res.json({
    success: true,
    shortcuts,
  });
};

export const syncPresets = async (req: Request, res: Response) => {
  const { presets } = req.body;

  if (!Array.isArray(presets)) {
    throw new ApiError(400, 'presets array is required', { code: 'INVALID_PAYLOAD' });
  }

  const results = { created: 0, updated: 0, failed: 0 };

  for (const preset of presets) {
    try {
      const category = parseCategory(preset.category);
      const existing = await prisma.clinicalPreset.findFirst({
        where: { name: preset.name, category },
      });

      if (existing) {
        await prisma.clinicalPreset.update({
          where: { id: existing.id },
          data: { frequency: preset.frequency ?? existing.frequency },
        });
        results.updated++;
      } else {
        await prisma.clinicalPreset.create({
          data: {
            name: preset.name,
            category,
            frequency: preset.frequency ?? 0,
          },
        });
        results.created++;
      }
    } catch (error) {
      logger.error('clinical', 'Error syncing clinical preset', { preset: preset?.name, error: error instanceof Error ? error.message : String(error) });
      results.failed++;
    }
  }

  res.json({ success: true, results });
};

export const incrementFrequency = async (req: Request, res: Response) => {
  const { name, category } = req.body;

  if (!name || typeof name !== 'string') {
    throw new ApiError(400, 'name is required', { code: 'NAME_REQUIRED' });
  }

  const cat = parseCategory(category);

  const existing = await prisma.clinicalPreset.findFirst({
    where: { name, category: cat },
  });

  if (existing) {
    await prisma.clinicalPreset.update({
      where: { id: existing.id },
      data: { frequency: { increment: 1 } },
    });
  } else {
    await prisma.clinicalPreset.create({
      data: { name, category: cat, frequency: 1 },
    });
  }

  res.json({ success: true });
};
