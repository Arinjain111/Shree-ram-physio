import { useState, useEffect, useRef } from 'react';
import { useUI } from '@/context/UIContext';
import PageHeader from '@/components/layout/PageHeader';
import type { TreatmentPreset } from '@/types/treatmentPreset.types';
import { handleFrontendError } from '@/services/errorHandler';
import { PlusIcon, EditIcon, TrashIcon, SaveIcon, XIcon, SettingsIcon } from '@/components/icons';

const { ipcRenderer } = window.require('electron');

const TreatmentSettings = () => {
  const { showToast, showModal } = useUI();
  const [presets, setPresets] = useState<TreatmentPreset[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<TreatmentPreset, 'id'>>({
    name: '',
    defaultSessions: 1,
    pricePerSession: 0,
  });

  const syncAttempted = useRef(false);

  useEffect(() => {
    loadPresets();
    
    // Prevent double sync in Strict Mode
    if (!syncAttempted.current) {
      syncAttempted.current = true;
      syncPresetsFromCloud(); // Sync from cloud on mount
    }
  }, []);

  const loadPresets = async () => {
    try {
      const result = await ipcRenderer.invoke('load-treatment-presets');
      if (result.success) {
        setPresets(result.presets || []);
      }
    } catch (error) {
      console.error('Error loading treatment presets:', error);
      handleFrontendError(error, showToast, 'Error loading treatment presets');
    }
  };

  const syncPresetsFromCloud = async () => {
    try {
      showToast('info', 'Syncing presets from cloud...');
      const result = await ipcRenderer.invoke('sync-presets-from-cloud');
      if (result.success) {
        console.log('✅ Presets synced from cloud:', result.stats);
        // Reload presets after sync
        await loadPresets();
        const { created, updated, fetched } = result.stats;
        if (fetched === 0) {
          showToast('warning', 'No presets received from cloud — check backend URL or network');
        } else if (created > 0 || updated > 0) {
          showToast('success', `Synced: ${created} new, ${updated} updated`);
        } else {
          showToast('info', 'All presets are up to date');
        }
      } else {
        const errorMsg = result.error?.split('\n')[0] || 'Sync failed'; // Get first line only
        console.warn('⚠️ Preset sync failed:', errorMsg);
        showToast('error', errorMsg);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const shortMsg = msg.split('\n')[0] || msg.substring(0, 100); // First line or first 100 chars
      console.error('❌ Sync error:', shortMsg);
      showToast('error', shortMsg);
    }
  };

  const handleSave = async () => {
    try {
      if (editingId !== null) {
        // Update existing preset
        const result = await ipcRenderer.invoke('update-treatment-preset', {
          id: editingId,
          ...formData,
        });
        if (result.success) {
          loadPresets();
          resetForm();
          showToast('success', 'Preset updated successfully');
        } else {
          showToast('error', 'Error updating preset: ' + result.error);
        }
      } else {
        // Add new preset
        const result = await ipcRenderer.invoke('add-treatment-preset', formData);
        if (result.success) {
          loadPresets();
          resetForm();
          showToast('success', 'Preset added successfully');
        } else {
          showToast('error', 'Error adding preset: ' + result.error);
        }
      }
    } catch (error: any) {
      handleFrontendError(error, showToast, 'Failed to save preset');
    }
  };

  const handleEdit = (preset: TreatmentPreset) => {
    setFormData({
      name: preset.name,
      defaultSessions: preset.defaultSessions,
      pricePerSession: preset.pricePerSession,
    });
    setEditingId(preset.id || null);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    showModal({
      title: 'Delete Preset',
      message: 'Are you sure you want to delete this treatment preset?',
      type: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const result = await ipcRenderer.invoke('delete-treatment-preset', id);
          if (result.success) {
            loadPresets();
            showToast('success', 'Preset deleted successfully');
          } else {
            showToast('error', 'Error deleting preset: ' + result.error);
          }
        } catch (error: any) {
          handleFrontendError(error, showToast, 'Failed to delete preset');
        }
      }
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      defaultSessions: 1,
      pricePerSession: 0,
    });
    setEditingId(null);
    setIsAdding(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <PageHeader 
          title="Treatment Presets"
          icon={
            <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
              <SettingsIcon />
            </div>
          }
          description={
            <p className="text-slate-500 text-sm">
              Manage your standard treatment plans, session counts, and pricing.
            </p>
          }
          actions={
            <div className="flex gap-3">
              <button
                onClick={syncPresetsFromCloud}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                title="Sync presets from cloud"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                Sync from Cloud
              </button>
              {!isAdding && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm font-medium"
                >
                  <PlusIcon />
                  Add New Preset
                </button>
              )}
            </div>
          }
        />

        {/* Add/Edit Form Card */}
        {isAdding && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                {editingId !== null ? <EditIcon /> : <PlusIcon />}
                {editingId !== null ? 'Edit Treatment Preset' : 'Add New Treatment Preset'}
              </h2>
              <button 
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XIcon />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Treatment Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  placeholder="e.g., Ultrasound Therapy"
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Default Sessions <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.defaultSessions}
                  onChange={(e) => setFormData({ ...formData, defaultSessions: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                  placeholder="e.g., 10"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Price Per Session (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.pricePerSession === 0 ? '' : formData.pricePerSession}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, pricePerSession: val === '' ? 0 : parseFloat(val) });
                    }}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                    placeholder="500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
              <button
                onClick={resetForm}
                className="px-5 py-2.5 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium shadow-sm transition-all transform active:scale-95"
              >
                <SaveIcon />
                {editingId !== null ? 'Update Preset' : 'Save Preset'}
              </button>
            </div>
          </div>
        )}

        {/* Presets List Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Treatment Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Sessions</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Price/Session</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Total Value</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {presets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <div className="p-4 bg-slate-50 rounded-full mb-3">
                          <SettingsIcon />
                        </div>
                        <p className="text-lg font-medium text-slate-600">No presets found</p>
                        <p className="text-sm">Add your first treatment preset to get started.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  presets.map((preset) => (
                    <tr key={preset.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{preset.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {preset.defaultSessions} sessions
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        ₹{preset.pricePerSession.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-teal-700">
                          ₹{(preset.defaultSessions * preset.pricePerSession).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(preset)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => handleDelete(preset.id!)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
            <span>Showing {presets.length} presets</span>
            <span>Auto-saved to database</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreatmentSettings;
