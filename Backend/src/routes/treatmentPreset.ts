import { Router } from 'express';
import {
  getAllPresets,
  getPresetById,
  createPreset,
  updatePreset,
  deletePreset,
  syncPresets
} from '../controllers/treatmentPreset';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/presets - Get all presets
router.get('/', asyncHandler(getAllPresets));

// GET /api/presets/:id - Get preset by ID
router.get('/:id', asyncHandler(getPresetById));

// POST /api/presets - Create new preset
router.post('/', asyncHandler(createPreset));

// POST /api/presets/sync - Bulk sync presets
router.post('/sync', asyncHandler(syncPresets));

// PUT /api/presets/:id - Update preset
router.put('/:id', asyncHandler(updatePreset));

// DELETE /api/presets/:id - Delete preset
router.delete('/:id', asyncHandler(deletePreset));

export default router;
