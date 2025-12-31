import { Router } from 'express';
import { syncData, getSyncStatus } from '../controllers/syncController';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// POST /api/sync - Sync data between local and cloud
router.post('/', asyncHandler(syncData));

// GET /api/sync/status - Check if updates are available (Cached)
router.get('/status', asyncHandler(getSyncStatus as any));

export default router;
