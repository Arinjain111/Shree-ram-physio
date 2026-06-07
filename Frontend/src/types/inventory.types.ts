export interface InventoryItem {
  id: number;
  name: string;
  description: string | null;
  stock: number;
  costPrice: number;
  sellingPrice: number;
  cloudId?: number | null;
  syncStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  lastSyncAt?: string | null;
}

export interface InventoryTransaction {
  id: number;
  itemId: number;
  type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT';
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  date: string;
  notes: string | null;
  item?: InventoryItem;
}
