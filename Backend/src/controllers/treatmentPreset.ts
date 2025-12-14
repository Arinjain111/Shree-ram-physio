import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/errorHandler';

// Get all treatment presets
export const getAllPresets = async (_req: Request, res: Response) => {
  const presets = await prisma.treatmentPreset.findMany({
    orderBy: {
      name: 'asc',
    },
  });

  res.json({
    success: true,
    presets,
  });
};

// Get preset by ID
export const getPresetById = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Preset ID is required', { code: 'PRESET_ID_REQUIRED' });
  }

  const presetId = parseInt(id, 10);
  if (Number.isNaN(presetId)) {
    throw new ApiError(400, 'Invalid preset ID', { code: 'INVALID_PRESET_ID' });
  }

  const preset = await prisma.treatmentPreset.findUnique({
    where: { id: presetId },
  });

  if (!preset) {
    throw new ApiError(404, 'Preset not found', { code: 'PRESET_NOT_FOUND' });
  }

  res.json({
    success: true,
    preset,
  });
};

// Create new preset
export const createPreset = async (req: Request, res: Response) => {
  const { name, defaultSessions, pricePerSession } = req.body;

  if (!name || defaultSessions === undefined || pricePerSession === undefined) {
    throw new ApiError(400, 'Name, defaultSessions, and pricePerSession are required', { code: 'MISSING_REQUIRED_FIELDS' });
  }

  const sessionsValue = Number(defaultSessions);
  const priceValue = Number(pricePerSession);

  if (!Number.isFinite(sessionsValue) || sessionsValue < 1) {
    throw new ApiError(400, 'Default sessions must be at least 1', { code: 'INVALID_SESSIONS' });
  }

  if (!Number.isFinite(priceValue) || priceValue < 0) {
    throw new ApiError(400, 'Price per session cannot be negative', { code: 'INVALID_PRICE' });
  }

  const preset = await prisma.treatmentPreset.create({
    data: {
      name,
      defaultSessions: sessionsValue,
      pricePerSession: priceValue,
    },
  });

  res.status(201).json({
    success: true,
    preset,
  });
};

// Update preset
export const updatePreset = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, defaultSessions, pricePerSession } = req.body;

  if (!id) {
    throw new ApiError(400, 'Preset ID is required', { code: 'PRESET_ID_REQUIRED' });
  }

  const presetId = parseInt(id, 10);
  if (Number.isNaN(presetId)) {
    throw new ApiError(400, 'Invalid preset ID', { code: 'INVALID_PRESET_ID' });
  }

  // Check if preset exists
  const existingPreset = await prisma.treatmentPreset.findUnique({
    where: { id: presetId },
  });

  if (!existingPreset) {
    throw new ApiError(404, 'Preset not found', { code: 'PRESET_NOT_FOUND' });
  }

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;

  if (defaultSessions !== undefined) {
    const sessionsValue = Number(defaultSessions);
    if (!Number.isFinite(sessionsValue) || sessionsValue < 1) {
      throw new ApiError(400, 'Default sessions must be at least 1', { code: 'INVALID_SESSIONS' });
    }
    updateData.defaultSessions = sessionsValue;
  }

  if (pricePerSession !== undefined) {
    const priceValue = Number(pricePerSession);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      throw new ApiError(400, 'Price per session cannot be negative', { code: 'INVALID_PRICE' });
    }
    updateData.pricePerSession = priceValue;
  }

  const preset = await prisma.treatmentPreset.update({
    where: { id: presetId },
    data: updateData,
  });

  res.json({
    success: true,
    preset,
  });
};

// Delete preset
export const deletePreset = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Preset ID is required', { code: 'PRESET_ID_REQUIRED' });
  }

  const presetId = parseInt(id, 10);
  if (Number.isNaN(presetId)) {
    throw new ApiError(400, 'Invalid preset ID');
  }

  // Check if preset exists
  const existingPreset = await prisma.treatmentPreset.findUnique({
    where: { id: presetId },
  });

  if (!existingPreset) {
    throw new ApiError(404, 'Preset not found', { code: 'PRESET_NOT_FOUND' });
  }

  await prisma.treatmentPreset.delete({
    where: { id: presetId },
  });

  res.json({
    success: true,
    message: 'Preset deleted successfully',
  });
};

// Bulk sync presets (for initial sync from client)
export const syncPresets = async (req: Request, res: Response) => {
  const { presets } = req.body;

  if (!Array.isArray(presets)) {
    throw new ApiError(400, 'Failed to sync presets: format invalid', { code: 'INVALID_FORMAT' });
  }

  const results = {
    created: 0,
    updated: 0,
    failed: 0,
  };

  for (const preset of presets) {
    try {
      if (preset.id) {
        // Try to update existing preset
        const existing = await prisma.treatmentPreset.findUnique({
          where: { id: preset.id },
        });

        if (existing) {
          await prisma.treatmentPreset.update({
            where: { id: preset.id },
            data: {
              name: preset.name,
              defaultSessions: preset.defaultSessions,
              pricePerSession: preset.pricePerSession,
            },
          });
          results.updated++;
        } else {
          // Create if not exists
          await prisma.treatmentPreset.create({
            data: {
              name: preset.name,
              defaultSessions: preset.defaultSessions,
              pricePerSession: preset.pricePerSession,
            },
          });
          results.created++;
        }
      } else {
        // Create new preset
        await prisma.treatmentPreset.create({
          data: {
            name: preset.name,
            defaultSessions: preset.defaultSessions,
            pricePerSession: preset.pricePerSession,
          },
        });
        results.created++;
      }
    } catch (error) {
      console.error('Error syncing preset:', preset, error);
      results.failed++;
    }
  }

  res.json({
    success: true,
    results,
  });
};
