import { ipcMain } from 'electron';
import { getPrismaClient } from '../database/prisma';
import { logger as log } from '../utils/logger';
import { getCached, setCache, clearCache } from '../utils/readCache';

let AddInventoryItemSchema: any;
let UpdateInventoryItemSchema: any;
let RecordPurchaseSchema: any;
let RecordSaleSchema: any;
let DeleteInventoryItemSchema: any;
let UndoInventoryTransactionSchema: any;
let AdjustStockSchema: any;
let validateData: any;

async function ensureSchemas() {
  if (!validateData) {
    const mod = await import('../../src/schemas/validation.schema');
    AddInventoryItemSchema = mod.AddInventoryItemSchema;
    UpdateInventoryItemSchema = mod.UpdateInventoryItemSchema;
    RecordPurchaseSchema = mod.RecordPurchaseSchema;
    RecordSaleSchema = mod.RecordSaleSchema;
    DeleteInventoryItemSchema = mod.DeleteInventoryItemSchema;
    UndoInventoryTransactionSchema = mod.UndoInventoryTransactionSchema;
    AdjustStockSchema = mod.AdjustStockSchema;
    validateData = mod.validateData;
  }
}

export function registerInventoryHandlers() {
  const prisma = getPrismaClient();
  ensureSchemas().catch((e) => log.error('inventory', 'Failed to load inventory validation schemas', { error: e instanceof Error ? e.message : String(e) }));

  ipcMain.handle('get-inventory-items', async () => {
    try {
      const cached = getCached('inventory-items');
      if (cached) return cached;
      const items = await prisma.inventoryItem.findMany({
        orderBy: { name: 'asc' }
      });
      const result = { success: true as const, items };
      setCache('inventory-items', result);
      return result;
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
      clearCache('inventory');
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
      clearCache('inventory');
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

      clearCache('inventory');
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

      clearCache('inventory');
      return { success: true, ...result };
    } catch (error) {
      log.error('inventory', 'Failed to record sale', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to record sale' };
    }
  });

  ipcMain.handle('get-inventory-transactions', async (_, limit: unknown = 100) => {
    try {
      const take = typeof limit === 'number' && limit > 0 ? Math.min(Number(limit), 5000) : 100;
      const cacheKey = `inv-txns:${take}`;
      const cached = getCached(cacheKey);
      if (cached) return cached;
      const transactions = await prisma.inventoryTransaction.findMany({
        orderBy: { date: 'desc' },
        take,
        include: { item: true }
      });
      const result = { success: true as const, transactions };
      setCache(cacheKey, result);
      return result;
    } catch (error) {
      log.error('inventory', 'Failed to fetch inventory transactions', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: 'Failed to fetch inventory transactions' };
    }
  });

  ipcMain.handle('delete-inventory-item', async (_, id: unknown) => {
    try {
      await ensureSchemas();
      const validation = validateData(DeleteInventoryItemSchema, { id });
      if (!validation.success) {
        return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
      }
      const { id: itemId } = validation.data;
      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
      if (!item) {
        return { success: false, error: 'Item not found' };
      }
      await prisma.inventoryItem.delete({ where: { id: itemId } });
      clearCache('inventory');
      return { success: true };
    } catch (error) {
      log.error('inventory', 'Failed to delete inventory item', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: 'Failed to delete inventory item' };
    }
  });

  ipcMain.handle('undo-inventory-transaction', async (_, id: unknown) => {
    try {
      await ensureSchemas();
      const validation = validateData(UndoInventoryTransactionSchema, { id });
      if (!validation.success) {
        return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
      }
      const { id: txnId } = validation.data;
      const transaction = await prisma.inventoryTransaction.findUnique({ where: { id: txnId } });
      if (!transaction) {
        return { success: false, error: 'Transaction not found' };
      }

      await prisma.$transaction(async (tx) => {
        if (transaction.type === 'PURCHASE') {
          const item = await tx.inventoryItem.findUnique({ where: { id: transaction.itemId } });
          if (!item) {
            throw new Error('Associated item not found');
          }
          if (item.stock < transaction.quantity) {
            throw new Error(`Cannot undo purchase: only ${item.stock} in stock (need to reverse ${transaction.quantity})`);
          }
          await tx.inventoryItem.update({
            where: { id: transaction.itemId },
            data: { stock: { decrement: transaction.quantity } }
          });
        } else if (transaction.type === 'SALE') {
          await tx.inventoryItem.update({
            where: { id: transaction.itemId },
            data: { stock: { increment: transaction.quantity } }
          });
        }

        await tx.inventoryTransaction.delete({ where: { id: txnId } });
      });

      clearCache('inventory');
      return { success: true };
    } catch (error) {
      log.error('inventory', 'Failed to undo inventory transaction', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to undo transaction' };
    }
  });

  ipcMain.handle('adjust-stock', async (_, itemId: unknown, adjustment: unknown, reason?: unknown) => {
    try {
      await ensureSchemas();
      const validation = validateData(AdjustStockSchema, { itemId, adjustment, reason });
      if (!validation.success) {
        return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
      }
      const { itemId: id, adjustment: adj, reason: r } = validation.data;
      const result = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findUnique({ where: { id } });
        if (!item) {
          throw new Error('Item not found');
        }
        const newStock = item.stock + adj;
        if (newStock < 0) {
          throw new Error(`Cannot reduce stock below 0 (current: ${item.stock}, adjustment: ${adj})`);
        }
        const updatedItem = await tx.inventoryItem.update({
          where: { id },
          data: { stock: newStock }
        });
        const transaction = await tx.inventoryTransaction.create({
          data: {
            itemId: id,
            type: 'ADJUSTMENT',
            quantity: Math.abs(adj),
            pricePerUnit: 0,
            totalAmount: 0,
            notes: r || (adj > 0 ? `Stock increased by ${adj}` : `Stock decreased by ${Math.abs(adj)}`)
          }
        });
        return { item: updatedItem, transaction };
      });
      clearCache('inventory');
      return { success: true, ...result };
    } catch (error) {
      log.error('inventory', 'Failed to adjust stock', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to adjust stock' };
    }
  });
}
