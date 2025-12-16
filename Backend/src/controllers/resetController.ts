import { Request, Response } from 'express';
import prisma from '../lib/prisma';

/**
 * Reset all database tables (DANGEROUS - use with caution)
 * Deletes all patients, invoices, treatments, and treatment presets
 */
export const resetDatabase = async (req: Request, res: Response) => {
  try {
    console.log('⚠️  Database reset requested');
    
    // Delete in order to respect foreign key constraints
    await prisma.$transaction(async (tx) => {
      // Delete treatments first (depends on invoices and treatment presets)
      const deletedTreatments = await tx.treatment.deleteMany();
      console.log(`   Deleted ${deletedTreatments.count} treatments`);
      
      // Delete invoices (depends on patients)
      const deletedInvoices = await tx.invoice.deleteMany();
      console.log(`   Deleted ${deletedInvoices.count} invoices`);
      
      // Delete patients
      const deletedPatients = await tx.patient.deleteMany();
      console.log(`   Deleted ${deletedPatients.count} patients`);
      
      // Delete treatment presets (can be done last)
      const deletedPresets = await tx.treatmentPreset.deleteMany();
      console.log(`   Deleted ${deletedPresets.count} treatment presets`);
    });

    console.log('✅ Database reset completed successfully');

    res.json({
      success: true,
      message: 'Database reset successfully',
      deletedCounts: {
        patients: await prisma.patient.count(),
        invoices: await prisma.invoice.count(),
        treatments: await prisma.treatment.count(),
        treatmentPresets: await prisma.treatmentPreset.count()
      }
    });
  } catch (error: any) {
    console.error('❌ Database reset failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Database reset failed'
    });
  }
};

/**
 * Get database statistics
 */
export const getDatabaseStats = async (req: Request, res: Response) => {
  try {
    const [patients, invoices, treatments, treatmentPresets] = await Promise.all([
      prisma.patient.count(),
      prisma.invoice.count(),
      prisma.treatment.count(),
      prisma.treatmentPreset.count()
    ]);

    res.json({
      success: true,
      stats: {
        patients,
        invoices,
        treatments,
        treatmentPresets
      }
    });
  } catch (error: any) {
    console.error('❌ Failed to get database stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get database statistics'
    });
  }
};
