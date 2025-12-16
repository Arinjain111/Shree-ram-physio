import { Router } from 'express';
import { resetDatabase, getDatabaseStats } from '../controllers/resetController';

const router = Router();

// Get database statistics
router.get('/stats', getDatabaseStats);

// Reset database (DANGEROUS - requires confirmation)
router.post('/reset', resetDatabase);

export default router;
