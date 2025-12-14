import { Router } from 'express';
import { syncData } from '../controllers/syncController';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// POST /api/sync - Sync data between local and cloud
router.post('/', asyncHandler(syncData));

export default router;
