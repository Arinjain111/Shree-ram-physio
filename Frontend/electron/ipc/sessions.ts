import { ipcMain } from 'electron';
import { getPrismaClient } from '../database/prisma';
import { logger as log } from '../utils/logger';
import { clearCache } from '../utils/readCache';

export function registerSessionHandlers() {
  const prisma = getPrismaClient();

  ipcMain.handle('get-treatment-sessions', async (_event, treatmentId: number) => {
    try {
      if (!prisma) throw new Error('Prisma not initialized');

      const sessions = await prisma.treatmentSession.findMany({
        where: { treatmentId },
        orderBy: { sessionNumber: 'asc' }
      });

      return {
        success: true,
        sessions: sessions.map(s => ({
          id: s.id,
          treatmentId: s.treatmentId,
          sessionNumber: s.sessionNumber,
          date: s.date ? s.date.toISOString().split('T')[0] : null,
          attended: s.attended,
          painBefore: s.painBefore,
          painAfter: s.painAfter,
          notes: s.notes,
          exercisesPerformed: s.exercisesPerformed,
          progress: s.progress,
          cancelled: s.cancelled,
          rescheduledDate: s.rescheduledDate ? s.rescheduledDate.toISOString().split('T')[0] : null,
          syncStatus: s.syncStatus,
          cloudId: s.cloudId,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString()
        }))
      };
    } catch (error) {
      log.error('sessions', 'Failed to fetch treatment sessions', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('initialize-treatment-sessions', async (_event, treatmentId: number, sessionCount: number) => {
    try {
      if (!prisma) throw new Error('Prisma not initialized');

      const existing = await prisma.treatmentSession.count({
        where: { treatmentId }
      });

      const toCreate = Math.max(0, sessionCount - existing);
      for (let i = existing + 1; i <= existing + toCreate; i++) {
        await prisma.treatmentSession.create({
          data: {
            treatmentId,
            sessionNumber: i,
            attended: 0,
            painBefore: null,
            painAfter: null,
            notes: '',
            exercisesPerformed: '',
            cancelled: 0,
            syncStatus: 'PENDING'
          }
        });
      }

      await prisma.treatment.update({
        where: { id: treatmentId },
        data: { syncStatus: 'PENDING' }
      });

      const sessions = await prisma.treatmentSession.findMany({
        where: { treatmentId },
        orderBy: { sessionNumber: 'asc' }
      });

      return {
        success: true,
        sessions: sessions.map(s => ({
          id: s.id,
          treatmentId: s.treatmentId,
          sessionNumber: s.sessionNumber,
          date: s.date ? s.date.toISOString().split('T')[0] : null,
          attended: s.attended,
          painBefore: s.painBefore,
          painAfter: s.painAfter,
          notes: s.notes,
          exercisesPerformed: s.exercisesPerformed,
          progress: s.progress,
          cancelled: s.cancelled,
          rescheduledDate: s.rescheduledDate ? s.rescheduledDate.toISOString().split('T')[0] : null,
          syncStatus: s.syncStatus,
          cloudId: s.cloudId,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString()
        }))
      };
    } catch (error) {
      log.error('sessions', 'Failed to initialize treatment sessions', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('update-treatment-session', async (_event, sessionId: number, data: {
    attended?: number;
    painBefore?: number | null;
    painAfter?: number | null;
    notes?: string;
    exercisesPerformed?: string;
    progress?: string | null;
    cancelled?: number;
    rescheduledDate?: string | null;
    date?: string | null;
  }) => {
    try {
      if (!prisma) throw new Error('Prisma not initialized');

      const updateData: any = { syncStatus: 'PENDING' };

      if (data.attended !== undefined) updateData.attended = data.attended;
      if (data.painBefore !== undefined) updateData.painBefore = data.painBefore;
      if (data.painAfter !== undefined) updateData.painAfter = data.painAfter;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.exercisesPerformed !== undefined) updateData.exercisesPerformed = data.exercisesPerformed;
      if (data.progress !== undefined) updateData.progress = data.progress;
      if (data.cancelled !== undefined) updateData.cancelled = data.cancelled;
      if (data.rescheduledDate !== undefined) {
        updateData.rescheduledDate = data.rescheduledDate ? new Date(data.rescheduledDate) : null;
      }
      if (data.date !== undefined) {
        updateData.date = data.date ? new Date(data.date) : null;
      }

      const session = await prisma.treatmentSession.update({
        where: { id: sessionId },
        data: updateData
      });

      await prisma.treatment.update({
        where: { id: session.treatmentId },
        data: { syncStatus: 'PENDING' }
      });

      clearCache('invoices');
      return { success: true };
    } catch (error) {
      log.error('sessions', 'Failed to update treatment session', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-pain-trend', async (_event, treatmentId: number) => {
    try {
      if (!prisma) throw new Error('Prisma not initialized');

      const sessions = await prisma.treatmentSession.findMany({
        where: {
          treatmentId,
          attended: 1,
          painBefore: { not: null },
          painAfter: { not: null }
        },
        orderBy: { sessionNumber: 'asc' }
      });

      return {
        success: true,
        trend: sessions.map(s => ({
          sessionNumber: s.sessionNumber,
          date: s.date ? s.date.toISOString().split('T')[0] : null,
          painBefore: s.painBefore!,
          painAfter: s.painAfter!,
          painDelta: (s.painBefore ?? 0) - (s.painAfter ?? 0)
        }))
      };
    } catch (error) {
      log.error('sessions', 'Failed to fetch pain trend', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('get-patient-sessions-summary', async (_event, patientId: number) => {
    try {
      if (!prisma) throw new Error('Prisma not initialized');

      const invoices = await prisma.invoice.findMany({
        where: { patientId },
        include: {
          treatments: {
            include: {
              treatmentSessions: {
                orderBy: { sessionNumber: 'asc' }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const allSessions: any[] = [];
      for (const inv of invoices) {
        for (const treatment of inv.treatments) {
          const attended = treatment.treatmentSessions.filter(s => s.attended === 1).length;
          const cancelled = treatment.treatmentSessions.filter(s => s.cancelled === 1).length;
          const pending = treatment.treatmentSessions.filter(s => s.attended === 0 && s.cancelled === 0).length;
          allSessions.push({
            treatmentId: treatment.id,
            treatmentName: treatment.name,
            invoiceNumber: inv.invoiceNumber,
            totalSessions: treatment.sessions,
            attendedCount: attended,
            cancelledCount: cancelled,
            pendingCount: pending,
            sessions: treatment.treatmentSessions.map(s => ({
              id: s.id,
              sessionNumber: s.sessionNumber,
              date: s.date ? s.date.toISOString().split('T')[0] : null,
              attended: s.attended,
              painBefore: s.painBefore,
              painAfter: s.painAfter,
              notes: s.notes,
              exercisesPerformed: s.exercisesPerformed,
              progress: s.progress,
              cancelled: s.cancelled,
              rescheduledDate: s.rescheduledDate ? s.rescheduledDate.toISOString().split('T')[0] : null,
              syncStatus: s.syncStatus
            }))
          });
        }
      }

      return { success: true, treatments: allSessions };
    } catch (error) {
      log.error('sessions', 'Failed to fetch patient sessions summary', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('add-holiday-leave', async (_event, data: { treatmentId: number; date: string; type: string; notes?: string }) => {
    try {
      if (!prisma) throw new Error('Prisma not initialized');

      const treatment = await prisma.treatment.findUnique({
        where: { id: data.treatmentId },
        include: { treatmentSessions: { orderBy: { sessionNumber: 'desc' }, take: 1 } }
      });
      if (!treatment) return { success: false, error: 'Treatment not found' };

      const maxSession = treatment.treatmentSessions.length > 0
        ? treatment.treatmentSessions[0].sessionNumber
        : treatment.sessions;

      const nextNumber = maxSession + 1;

      const session = await prisma.treatmentSession.create({
        data: {
          treatmentId: data.treatmentId,
          sessionNumber: nextNumber,
          date: new Date(data.date),
          attended: 0,
          cancelled: 1,
          notes: `[${data.type.toUpperCase()}]${data.notes ? ' ' + data.notes : ''}`,
          syncStatus: 'PENDING'
        }
      });

      await prisma.treatment.update({
        where: { id: data.treatmentId },
        data: { syncStatus: 'PENDING' }
      });

      return { success: true, sessionId: session.id };
    } catch (error) {
      log.error('sessions', 'Failed to add holiday/leave', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('delete-treatment-session', async (_event, sessionId: number) => {
    try {
      if (!prisma) throw new Error('Prisma not initialized');

      const session = await prisma.treatmentSession.findUnique({ where: { id: sessionId } });
      if (!session) return { success: false, error: 'Session not found' };

      await prisma.treatmentSession.delete({ where: { id: sessionId } });

      await prisma.treatment.update({
        where: { id: session.treatmentId },
        data: { syncStatus: 'PENDING' }
      });

      clearCache('invoices');
      return { success: true };
    } catch (error) {
      log.error('sessions', 'Failed to delete treatment session', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('reset-treatment-session', async (_event, sessionId: number) => {
    try {
      if (!prisma) throw new Error('Prisma not initialized');

      const session = await prisma.treatmentSession.findUnique({ where: { id: sessionId } });
      if (!session) return { success: false, error: 'Session not found' };

      await prisma.treatmentSession.update({
        where: { id: sessionId },
        data: {
          attended: 0,
          cancelled: 0,
          painBefore: null,
          painAfter: null,
          exercisesPerformed: '',
          notes: '',
          progress: null,
          rescheduledDate: null,
          syncStatus: 'PENDING',
        }
      });

      await prisma.treatment.update({
        where: { id: session.treatmentId },
        data: { syncStatus: 'PENDING' }
      });

      clearCache('invoices');
      return { success: true };
    } catch (error) {
      log.error('sessions', 'Failed to reset treatment session', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('mark-session-attended', async (_event, sessionId: number, painBefore: number | null, painAfter: number | null) => {
    try {
      if (!prisma) throw new Error('Prisma not initialized');

      const session = await prisma.treatmentSession.findUnique({ where: { id: sessionId } });
      if (!session) return { success: false, error: 'Session not found' };

      await prisma.treatmentSession.update({
        where: { id: sessionId },
        data: {
          attended: 1,
          cancelled: 0,
          painBefore: painBefore ?? null,
          painAfter: painAfter ?? null,
          date: session.date ?? new Date(),
          syncStatus: 'PENDING',
        }
      });

      await prisma.treatment.update({
        where: { id: session.treatmentId },
        data: { syncStatus: 'PENDING' }
      });

      clearCache('invoices');
      return { success: true };
    } catch (error) {
      log.error('sessions', 'Failed to mark session attended', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: String(error) };
    }
  });
}
