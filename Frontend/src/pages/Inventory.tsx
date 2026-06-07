import { useState, useEffect } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { BoxIcon, PlusIcon, EditIcon } from '@/components/icons';
import { ipcRenderer } from '@/lib/ipc';
import { useUI } from '@/context/UIContext';
import { format } from 'date-fns';
import type { InventoryItem, InventoryTransaction } from '@/types/inventory.types';

export default function Inventory() {
  const { showToast } = useUI();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  
  // Modal state
  const [isItemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'PURCHASE' | 'SALE'>('PURCHASE');
  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');

  // Form states
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [costPrice, setCostPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);

  const [quantity, setQuantity] = useState(1);
  const [pricePerUnit, setPricePerUnit] = useState(0);
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    try {
      const itemsRes = await ipcRenderer.invoke('get-inventory-items');
      if (itemsRes.success) setItems(itemsRes.items);
      
      const transRes = await ipcRenderer.invoke('get-inventory-transactions');
      if (transRes.success) setTransactions(transRes.transactions);
    } catch (e) {
      showToast('error', 'Failed to load inventory data');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openItemModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setItemName(item.name);
      setItemDesc(item.description || '');
      setCostPrice(item.costPrice);
      setSellingPrice(item.sellingPrice);
    } else {
      setEditingItem(null);
      setItemName('');
      setItemDesc('');
      setCostPrice(0);
      setSellingPrice(0);
    }
    setItemModalOpen(true);
  };

  const saveItem = async () => {
    try {
      if (editingItem) {
        await ipcRenderer.invoke('update-inventory-item', editingItem.id, { name: itemName, description: itemDesc, costPrice, sellingPrice });
        showToast('success', 'Item updated successfully');
      } else {
        await ipcRenderer.invoke('add-inventory-item', { name: itemName, description: itemDesc, costPrice, sellingPrice });
        showToast('success', 'Item added successfully');
      }
      setItemModalOpen(false);
      loadData();
    } catch (e) {
      showToast('error', 'Failed to save item');
    }
  };

  const openTransactionModal = (type: 'PURCHASE' | 'SALE', itemId?: number) => {
    setTransactionType(type);
    setSelectedItemId(itemId || (items.length > 0 ? items[0].id : ''));
    setQuantity(1);
    
    if (itemId) {
      const it = items.find(i => i.id === itemId);
      setPricePerUnit(type === 'PURCHASE' ? (it?.costPrice || 0) : (it?.sellingPrice || 0));
    } else if (items.length > 0) {
      setPricePerUnit(type === 'PURCHASE' ? items[0].costPrice : items[0].sellingPrice);
    } else {
      setPricePerUnit(0);
    }
    
    setNotes('');
    setTransactionModalOpen(true);
  };

  const handleItemIdChange = (id: number) => {
    setSelectedItemId(id);
    const it = items.find(i => i.id === id);
    if (it) {
      setPricePerUnit(transactionType === 'PURCHASE' ? it.costPrice : it.sellingPrice);
    }
  };

  const saveTransaction = async () => {
    if (!selectedItemId) return;
    try {
      const channel = transactionType === 'PURCHASE' ? 'record-purchase' : 'record-sale';
      const res = await ipcRenderer.invoke(channel, selectedItemId, quantity, pricePerUnit, notes);
      
      if (res.success) {
        showToast('success', `${transactionType === 'PURCHASE' ? 'Purchase' : 'Sale'} recorded successfully`);
        setTransactionModalOpen(false);
        loadData();
      } else {
        showToast('error', res.error || `Failed to record ${transactionType.toLowerCase()}`);
      }
    } catch (e) {
      showToast('error', `Error recording ${transactionType.toLowerCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 px-6 pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Inventory Management"
          icon={<div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><BoxIcon /></div>}
        />

        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Stock Overview
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Transaction History
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-bold text-slate-800">Products & Supplies</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => openTransactionModal('SALE')}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  Record Sale
                </button>
                <button
                  onClick={() => openTransactionModal('PURCHASE')}
                  className="px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
                >
                  Record Purchase
                </button>
                <button
                  onClick={() => openItemModal()}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
                >
                  <PlusIcon width={16} height={16} /> Add Product
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Item Name</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Stock</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Cost Price</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Selling Price</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400">No inventory items found. Add a product to get started.</td>
                    </tr>
                  ) : items.map(item => (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-800">{item.name}</div>
                        {item.description && <div className="text-xs text-slate-500">{item.description}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${item.stock <= 5 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                          {item.stock} in stock
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">₹{item.costPrice.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-emerald-600">₹{item.sellingPrice.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => openItemModal(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                          <EditIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Item</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Qty</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Price/Unit</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">No transactions recorded yet.</td>
                    </tr>
                  ) : transactions.map(t => (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(t.date), 'MMM dd, yyyy HH:mm')}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${
                          t.type === 'PURCHASE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{t.item?.name ?? 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">{t.quantity}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">₹{t.pricePerUnit.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-slate-800">₹{t.totalAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">{editingItem ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setItemModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                <input type="text" value={itemDesc} onChange={e => setItemDesc(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cost Price (₹)</label>
                  <input type="number" value={costPrice} onChange={e => setCostPrice(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (₹)</label>
                  <input type="number" value={sellingPrice} onChange={e => setSellingPrice(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setItemModalOpen(false)} className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-200">Cancel</button>
              <button onClick={saveItem} disabled={!itemName} className="px-4 py-2 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Record {transactionType === 'PURCHASE' ? 'Purchase (Restock)' : 'Sale (Outflow)'}</h3>
              <button onClick={() => setTransactionModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                <select value={selectedItemId} onChange={e => handleItemIdChange(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500">
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                  <input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price per Unit (₹)</label>
                  <input type="number" value={pricePerUnit} onChange={e => setPricePerUnit(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Total Amount</span>
                <span className="font-bold text-lg text-slate-800">₹{(quantity * pricePerUnit).toLocaleString()}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setTransactionModalOpen(false)} className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-200">Cancel</button>
              <button onClick={saveTransaction} disabled={!selectedItemId || quantity < 1} className={`px-4 py-2 rounded-lg font-medium text-white ${transactionType === 'PURCHASE' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}>
                Record {transactionType}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
