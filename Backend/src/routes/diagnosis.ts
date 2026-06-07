import { Router } from 'express';
import {
  getAllPresets,
  getAllShortcuts,
  syncPresets,
  incrementFrequency,
} from '../controllers/diagnosisController';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/presets', asyncHandler(getAllPresets));
router.get('/shortcuts', asyncHandler(getAllShortcuts));
router.post('/presets/sync', asyncHandler(syncPresets));
router.post('/presets/increment', asyncHandler(incrementFrequency));

export default router;
