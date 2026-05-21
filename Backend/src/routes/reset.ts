import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import prisma from '../lib/prisma';

const router = Router();

// Get database statistics
router.get('/stats', asyncHandler(async (_req, res) => {
  const [patients, invoices, treatments, treatmentPresets] = await Promise.all([
    prisma.patient.count(),
    prisma.invoice.count(),
    prisma.treatment.count(),
    prisma.treatmentPreset.count(),
  ]);

  res.json({
    success: true,
    stats: { patients, invoices, treatments, treatmentPresets },
  });
}));

// NOTE: Database reset endpoint has been removed for security reasons.
// If you need to reset the database, do it manually via Prisma CLI or direct database access.

export default router;
