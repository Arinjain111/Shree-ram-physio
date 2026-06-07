import { ipcMain } from 'electron';
import { getPrismaClient } from '../database/prisma';
import { logger as log } from '../utils/logger';

let AddInventoryItemSchema: any;
let UpdateInventoryItemSchema: any;
let RecordPurchaseSchema: any;
let RecordSaleSchema: any;
let validateData: any;

async function ensureSchemas() {
  if (!validateData) {
    const mod = await import('../../src/schemas/validation.schema');
    AddInventoryItemSchema = mod.AddInventoryItemSchema;
    UpdateInventoryItemSchema = mod.UpdateInventoryItemSchema;
    RecordPurchaseSchema = mod.RecordPurchaseSchema;
    RecordSaleSchema = mod.RecordSaleSchema;
    validateData = mod.validateData;
  }
}

export function registerInventoryHandlers() {
  const prisma = getPrismaClient();
  ensureSchemas().catch((e) => log.error('inventory', 'Failed to load inventory validation schemas', { error: e instanceof Error ? e.message : String(e) }));

  ipcMain.handle('get-inventory-items', async () => {
    try {
      const items = await prisma.inventoryItem.findMany({
        orderBy: { name: 'asc' }
      });
      return { success: true, items };
    } catch (error) {
      log.error('inventory', 'Failed to fetch inventory items', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: 'Failed to fetch inventory items' };
    }
  });

  ipcMain.handle('add-inventory-item', async (_, data: unknown) => {
    try {
      await ensureSchemas();
      const validation = validateData(AddInventoryItemSchema, data);
      if (!validation.success) {
        return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
      }
      const { name, description, costPrice, sellingPrice } = validation.data;
      const item = await prisma.inventoryItem.create({
        data: {
          name,
          description,
          costPrice,
          sellingPrice,
          stock: 0,
        }
      });
      return { success: true, item };
    } catch (error) {
      log.error('inventory', 'Failed to add inventory item', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: 'Failed to add inventory item' };
    }
  });

  ipcMain.handle('update-inventory-item', async (_, id: unknown, data: unknown) => {
    try {
      await ensureSchemas();
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        return { success: false, error: 'Invalid item ID' };
      }
      const validation = validateData(UpdateInventoryItemSchema, data);
      if (!validation.success) {
        return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
      }
      const { name, description, costPrice, sellingPrice } = validation.data;
      const item = await prisma.inventoryItem.update({
        where: { id },
        data: {
          name,
          description,
          costPrice,
          sellingPrice,
        }
      });
      return { success: true, item };
    } catch (error) {
      log.error('inventory', 'Failed to update inventory item', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: 'Failed to update inventory item' };
    }
  });

  ipcMain.handle('record-purchase', async (_, itemId: unknown, quantity: unknown, pricePerUnit: unknown, notes?: unknown) => {
    try {
      await ensureSchemas();
      const validation = validateData(RecordPurchaseSchema, { itemId, quantity, pricePerUnit, notes });
      if (!validation.success) {
        return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
      }
      const { itemId: id, quantity: qty, pricePerUnit: ppu, notes: n } = validation.data;
      const result = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.update({
          where: { id },
          data: { stock: { increment: qty } }
        });

        const transaction = await tx.inventoryTransaction.create({
          data: {
            itemId: id,
            type: 'PURCHASE',
            quantity: qty,
            pricePerUnit: ppu,
            totalAmount: qty * ppu,
            notes: n
          }
        });

        return { item, transaction };
      });

      return { success: true, ...result };
    } catch (error) {
      log.error('inventory', 'Failed to record purchase', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: 'Failed to record purchase' };
    }
  });

  ipcMain.handle('record-sale', async (_, itemId: unknown, quantity: unknown, pricePerUnit: unknown, notes?: unknown) => {
    try {
      await ensureSchemas();
      const validation = validateData(RecordSaleSchema, { itemId, quantity, pricePerUnit, notes });
      if (!validation.success) {
        return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
      }
      const { itemId: id, quantity: qty, pricePerUnit: ppu, notes: n } = validation.data;
      const result = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findUnique({ where: { id } });
        if (!item || item.stock < qty) {
          throw new Error(`Only ${item?.stock ?? 0} in stock (requested ${qty})`);
        }

        const updatedItem = await tx.inventoryItem.update({
          where: { id },
          data: { stock: { decrement: qty } }
        });

        const transaction = await tx.inventoryTransaction.create({
          data: {
            itemId: id,
            type: 'SALE',
            quantity: qty,
            pricePerUnit: ppu,
            totalAmount: qty * ppu,
            notes: n
          }
        });

        return { item: updatedItem, transaction };
      });

      return { success: true, ...result };
    } catch (error) {
      log.error('inventory', 'Failed to record sale', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to record sale' };
    }
  });

  ipcMain.handle('get-inventory-transactions', async (_, limit: unknown = 100) => {
    try {
      const take = typeof limit === 'number' && limit > 0 ? Math.min(Number(limit), 5000) : 100;
      const transactions = await prisma.inventoryTransaction.findMany({
        orderBy: { date: 'desc' },
        take,
        include: {
          item: true
        }
      });
      return { success: true, transactions };
    } catch (error) {
      log.error('inventory', 'Failed to fetch inventory transactions', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: 'Failed to fetch inventory transactions' };
    }
  });
}
