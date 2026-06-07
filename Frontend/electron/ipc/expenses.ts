import { ipcMain } from 'electron';
import { getPrismaClient } from '../database/prisma';
import { logger as log } from '../utils/logger';
import { getCached, setCache, clearCache } from '../utils/readCache';

let AddExpenseSchema: any;
let validateData: any;

async function ensureSchemas() {
  if (!validateData) {
    const mod = await import('../../src/schemas/validation.schema');
    AddExpenseSchema = mod.AddExpenseSchema;
    validateData = mod.validateData;
  }
}

export function registerExpenseHandlers() {
  const prisma = getPrismaClient();
  ensureSchemas().catch((e) => log.error('expense', 'Failed to load expense validation', { error: e instanceof Error ? e.message : String(e) }));

  ipcMain.handle('add-expense', async (_, data: unknown) => {
    try {
      await ensureSchemas();
      const validation = validateData(AddExpenseSchema, data);
      if (!validation.success) return { success: false, error: validation.errors.join(', ') };
      const { category, amount, date, notes } = validation.data;
      const expense = await prisma.expense.create({ data: { category, amount, date: date || new Date(), notes } });
      clearCache('expenses');
      return { success: true, expense };
    } catch (error) {
      log.error('expense', 'Failed to add expense', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: 'Failed to add expense' };
    }
  });

  ipcMain.handle('get-expenses', async () => {
    try {
      const cached = getCached('expenses');
      if (cached) return cached;
      const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' } });
      const result = { success: true as const, expenses };
      setCache('expenses', result);
      return result;
    } catch (error) {
      log.error('expense', 'Failed to fetch expenses', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: 'Failed to fetch expenses' };
    }
  });

  ipcMain.handle('delete-expense', async (_, id: number) => {
    try {
      await prisma.expense.delete({ where: { id } });
      clearCache('expenses');
      return { success: true };
    } catch (error) {
      log.error('expense', 'Failed to delete expense', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: 'Failed to delete expense' };
    }
  });
}
