import { useState, useEffect, useRef } from 'react';
import { useUI } from '@/context/UIContext';
import { useLogger } from '@/utils/logger';
import PageHeader from '@/components/layout/PageHeader';
import type { TreatmentPreset } from '@/types/treatmentPreset.types';
import type { DiagnosisPreset } from '@/types/diagnosisPreset.types';
import { handleFrontendError } from '@/services/errorHandler';
import { PlusIcon, EditIcon, TrashIcon, SaveIcon, XIcon, ClipboardListIcon, SettingsIcon } from '@/components/icons';
import { ipcRenderer } from '@/lib/ipc';

type Tab = 'treatment' | 'diagnosis';

const TreatmentSettings = () => {
  const { showToast, showModal } = useUI();
  const [activeTab, setActiveTab] = useState<Tab>('treatment');

  // Treatment preset state
  const [presets, setPresets] = useState<TreatmentPreset[]>([]);
  const [isAddingTreatment, setIsAddingTreatment] = useState(false);
  const [editingTreatmentId, setEditingTreatmentId] = useState<number | null>(null);
  const [treatmentForm, setTreatmentForm] = useState<Omit<TreatmentPreset, 'id'>>({
    name: '',
    defaultSessions: 1,
    pricePerSession: 0,
  });

  // Diagnosis preset state
  const [diagnosisPresets, setDiagnosisPresets] = useState<DiagnosisPreset[]>([]);
  const [isAddingDiagnosis, setIsAddingDiagnosis] = useState(false);
  const [newDiagnosisName, setNewDiagnosisName] = useState('');
  const log = useLogger();

  const syncAttempted = useRef(false);

  useEffect(() => {
    if (activeTab === 'treatment') {
      loadPresets();
    } else {
      loadDiagnosisPresets();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'treatment' && !syncAttempted.current) {
      syncAttempted.current = true;
      syncPresetsFromCloud();
    }
  }, [activeTab]);

  // ─── Treatment Presets ───────────────────────────────────────

  const loadPresets = async () => {
    try {
      const result = await ipcRenderer.invoke('load-treatment-presets');
      if (result.success) {
        setPresets(result.presets || []);
      }
    } catch (error) {
      log.error('settings', 'Error loading treatment presets', { error: error instanceof Error ? error.message : String(error) });
      handleFrontendError(error, showToast, 'Error loading treatment presets');
    }
  };

  const syncPresetsFromCloud = async () => {
    try {
      showToast('info', 'Syncing presets from cloud...');
      const result = await ipcRenderer.invoke('sync-presets-from-cloud');
      if (result.success) {
        await loadPresets();
        const { created, updated, fetched } = result.stats;
        if (fetched === 0) {
          showToast('info', 'Server has no presets — add them locally, or set AZURE_BACKEND_URL to sync from production');
        } else if (created > 0 || updated > 0) {
          showToast('success', `Synced: ${created} new, ${updated} updated`);
        } else {
          showToast('info', 'All presets are up to date');
        }
      } else {
        const errorMsg = result.error?.split('\n')[0] || 'Sync failed';
        showToast('error', errorMsg);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showToast('error', msg.split('\n')[0] || msg.substring(0, 100));
    }
  };

  const handleSaveTreatment = async () => {
    try {
      if (editingTreatmentId !== null) {
        const result = await ipcRenderer.invoke('update-treatment-preset', {
          id: editingTreatmentId,
          ...treatmentForm,
        });
        if (result.success) {
          loadPresets();
          resetTreatmentForm();
          showToast('success', 'Preset updated successfully');
        } else {
          showToast('error', 'Error updating preset: ' + result.error);
        }
      } else {
        const result = await ipcRenderer.invoke('add-treatment-preset', treatmentForm);
        if (result.success) {
          loadPresets();
          resetTreatmentForm();
          showToast('success', 'Preset added successfully');
        } else {
          showToast('error', 'Error adding preset: ' + result.error);
        }
      }
    } catch (error: any) {
      handleFrontendError(error, showToast, 'Failed to save preset');
    }
  };

  const handleEditTreatment = (preset: TreatmentPreset) => {
    setTreatmentForm({
      name: preset.name,
      defaultSessions: preset.defaultSessions,
      pricePerSession: preset.pricePerSession,
    });
    setEditingTreatmentId(preset.id || null);
    setIsAddingTreatment(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTreatment = async (id: number) => {
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

  const resetTreatmentForm = () => {
    setTreatmentForm({ name: '', defaultSessions: 1, pricePerSession: 0 });
    setEditingTreatmentId(null);
    setIsAddingTreatment(false);
  };

  // ─── Diagnosis Presets ───────────────────────────────────────

  const loadDiagnosisPresets = async () => {
    try {
      const result = await ipcRenderer.invoke('load-diagnosis-presets');
      if (result.success) {
        setDiagnosisPresets(result.presets || []);
      }
    } catch (error) {
      log.error('settings', 'Error loading diagnosis presets', { error: error instanceof Error ? error.message : String(error) });
      handleFrontendError(error, showToast, 'Error loading diagnosis presets');
    }
  };

  const handleAddDiagnosis = async () => {
    const name = newDiagnosisName.trim();
    if (!name) {
      showToast('warning', 'Please enter a diagnosis name');
      return;
    }
    try {
      const result = await ipcRenderer.invoke('add-custom-diagnosis', name);
      if (result.success) {
        setNewDiagnosisName('');
        setIsAddingDiagnosis(false);
        await loadDiagnosisPresets();
        showToast('success', 'Diagnosis preset added');
      } else {
        showToast('error', 'Error adding diagnosis: ' + result.error);
      }
    } catch (error: any) {
      handleFrontendError(error, showToast, 'Failed to add diagnosis');
    }
  };

  const handleDeleteDiagnosis = async (id: number, name: string) => {
    showModal({
      title: 'Delete Diagnosis Preset',
      message: `Are you sure you want to delete "${name}"?`,
      type: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const result = await ipcRenderer.invoke('delete-diagnosis-preset', id);
          if (result.success) {
            await loadDiagnosisPresets();
            showToast('success', 'Diagnosis preset deleted');
          } else {
            showToast('error', 'Error deleting diagnosis: ' + result.error);
          }
        } catch (error: any) {
          handleFrontendError(error, showToast, 'Failed to delete diagnosis');
        }
      }
    });
  };

  // ─── Shared ──────────────────────────────────────────────────

  const tabClass = (tab: Tab) =>
    `flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
      activeTab === tab
        ? 'bg-white text-teal-700 shadow-sm border border-slate-200'
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 px-6">
      <div className="max-w-6xl mx-auto">

        <PageHeader
          title={activeTab === 'treatment' ? 'Treatment Presets' : 'Diagnosis Presets'}
          icon={
            <div className={`p-2 rounded-lg ${activeTab === 'treatment' ? 'bg-teal-100 text-teal-700' : 'bg-purple-100 text-purple-700'}`}>
              {activeTab === 'treatment' ? <SettingsIcon /> : <ClipboardListIcon />}
            </div>
          }
          description={
            <p className="text-slate-500 text-sm">
              {activeTab === 'treatment'
                ? 'Manage your standard treatment plans, session counts, and pricing.'
                : 'Manage diagnosis shortcuts and frequently used diagnoses.'}
            </p>
          }
          actions={
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('treatment')}
                className={tabClass('treatment')}
              >
                <SettingsIcon />
                <span>Treatment</span>
              </button>
              <button
                onClick={() => setActiveTab('diagnosis')}
                className={tabClass('diagnosis')}
              >
                <ClipboardListIcon />
                <span>Diagnosis</span>
              </button>
            </div>
          }
        />

        {/* ════════════════ TREATMENT TAB ════════════════ */}
        {activeTab === 'treatment' && (
          <>
            {/* Sync + Add buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={syncPresetsFromCloud}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                Sync from Cloud
              </button>
              {!isAddingTreatment && (
                <button
                  onClick={() => setIsAddingTreatment(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <PlusIcon />
                  Add Treatment
                </button>
              )}
            </div>

            {/* Treatment Add/Edit Form */}
            {isAddingTreatment && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    {editingTreatmentId !== null ? <EditIcon /> : <PlusIcon />}
                    {editingTreatmentId !== null ? 'Edit Treatment Preset' : 'Add New Treatment Preset'}
                  </h2>
                  <button onClick={resetTreatmentForm} className="text-slate-400 hover:text-slate-600 transition-colors"><XIcon /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Treatment Name <span className="text-red-500">*</span></label>
                    <input type="text" value={treatmentForm.name} onChange={(e) => setTreatmentForm({ ...treatmentForm, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="e.g., Ultrasound Therapy" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Default Sessions <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={treatmentForm.defaultSessions} onChange={(e) => setTreatmentForm({ ...treatmentForm, defaultSessions: parseInt(e.target.value) || 1 })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="e.g., 10" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Price Per Session (₹) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</span>
                      <input type="number" min="0" step="0.01" value={treatmentForm.pricePerSession === 0 ? '' : treatmentForm.pricePerSession}
                        onChange={(e) => { const v = e.target.value; setTreatmentForm({ ...treatmentForm, pricePerSession: v === '' ? 0 : parseFloat(v) }); }}
                        className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="500" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                  <button onClick={resetTreatmentForm} className="px-5 py-2.5 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors">Cancel</button>
                  <button onClick={handleSaveTreatment} className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium shadow-sm transition-all transform active:scale-95"><SaveIcon />{editingTreatmentId !== null ? 'Update Preset' : 'Save Preset'}</button>
                </div>
              </div>
            )}

            {/* Treatment Presets Table */}
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
                            <div className="p-4 bg-slate-50 rounded-full mb-3"><SettingsIcon /></div>
                            <p className="text-lg font-medium text-slate-600">No presets found</p>
                            <p className="text-sm">Add your first treatment preset to get started.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      presets.map((preset) => (
                        <tr key={preset.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4"><div className="font-semibold text-slate-800">{preset.name}</div></td>
                          <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{preset.defaultSessions} sessions</span></td>
                          <td className="px-6 py-4 text-slate-600 font-medium">₹{preset.pricePerSession.toFixed(2)}</td>
                          <td className="px-6 py-4"><span className="font-bold text-teal-700">₹{(preset.defaultSessions * preset.pricePerSession).toFixed(2)}</span></td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditTreatment(preset)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><EditIcon /></button>
                              <button onClick={() => handleDeleteTreatment(preset.id!)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><TrashIcon /></button>
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
          </>
        )}

        {/* ════════════════ DIAGNOSIS TAB ════════════════ */}
        {activeTab === 'diagnosis' && (
          <>
            {/* Action buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={async () => {
                  showToast('info', 'Syncing diagnosis presets from cloud...');
                  const result = await ipcRenderer.invoke('sync-diagnosis-presets-from-cloud');
                  if (result.success) {
                    await loadDiagnosisPresets();
                    const { created, updated, fetched } = result.stats;
                    if (fetched === 0) {
                      showToast('info', 'Server has no diagnosis presets');
                    } else if (created > 0 || updated > 0) {
                      showToast('success', `Synced: ${created} new, ${updated} updated`);
                    } else {
                      showToast('info', 'All diagnosis presets are up to date');
                    }
                  } else {
                    showToast('error', result.error?.split('\n')[0] || 'Sync failed');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                Sync from Cloud
              </button>
              {!isAddingDiagnosis && (
                <button
                  onClick={() => setIsAddingDiagnosis(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <PlusIcon />
                  Add Diagnosis
                </button>
              )}
            </div>

            {/* Add Diagnosis Form */}
            {isAddingDiagnosis && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2"><PlusIcon /> Add New Diagnosis Preset</h2>
                  <button onClick={() => { setIsAddingDiagnosis(false); setNewDiagnosisName(''); }} className="text-slate-400 hover:text-slate-600 transition-colors"><XIcon /></button>
                </div>
                <div className="max-w-md space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Diagnosis Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newDiagnosisName}
                    onChange={(e) => setNewDiagnosisName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddDiagnosis(); }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                    placeholder="e.g., Lumbar Spondylosis"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                  <button onClick={() => { setIsAddingDiagnosis(false); setNewDiagnosisName(''); }} className="px-5 py-2.5 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors">Cancel</button>
                  <button onClick={handleAddDiagnosis} className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-sm transition-all transform active:scale-95"><SaveIcon /> Save Diagnosis</button>
                </div>
              </div>
            )}

            {/* Diagnosis Presets List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Diagnosis Name</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Times Used</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {diagnosisPresets.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <div className="p-4 bg-slate-50 rounded-full mb-3"><ClipboardListIcon /></div>
                            <p className="text-lg font-medium text-slate-600">No diagnosis presets found</p>
                            <p className="text-sm">Add your first diagnosis preset to get started.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      diagnosisPresets.map((dp) => (
                        <tr key={dp.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4"><div className="font-semibold text-slate-800">{dp.name}</div></td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                              {dp.frequency} time{dp.frequency !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleDeleteDiagnosis(dp.id, dp.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><TrashIcon /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
                <span>Showing {diagnosisPresets.length} diagnosis presets</span>
                <span>Auto-saved to database</span>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default TreatmentSettings;
