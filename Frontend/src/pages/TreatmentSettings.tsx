import { useState, useEffect } from 'react';
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
  const [treatmentSearch, setTreatmentSearch] = useState('');

  // Diagnosis preset state
  const [diagnosisPresets, setDiagnosisPresets] = useState<DiagnosisPreset[]>([]);
  const [isAddingDiagnosis, setIsAddingDiagnosis] = useState(false);
  const [newDiagnosisName, setNewDiagnosisName] = useState('');
  const [diagnosisSearch, setDiagnosisSearch] = useState('');
  const log = useLogger();

  useEffect(() => {
    if (activeTab === 'treatment') {
      loadPresets();
    } else {
      loadDiagnosisPresets();
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

  const syncAllPresetsFromCloud = async () => {
    try {
      showToast('info', 'Syncing all presets from cloud...');
      
      const treatmentResult = await ipcRenderer.invoke('sync-presets-from-cloud');
      const diagnosisResult = await ipcRenderer.invoke('sync-diagnosis-presets-from-cloud');
      
      await loadPresets();
      await loadDiagnosisPresets();
      
      const treatmentStats = treatmentResult.success ? treatmentResult.stats : { created: 0, updated: 0, fetched: 0 };
      const diagnosisStats = diagnosisResult.success ? diagnosisResult.stats : { created: 0, updated: 0, fetched: 0 };
      
      const totalCreated = treatmentStats.created + diagnosisStats.created;
      const totalUpdated = treatmentStats.updated + diagnosisStats.updated;
      const totalFetched = treatmentStats.fetched + diagnosisStats.fetched;
      
      if (totalFetched === 0) {
        showToast('info', 'Server has no presets');
      } else if (totalCreated > 0 || totalUpdated > 0) {
        showToast('success', `Synced: ${totalCreated} new, ${totalUpdated} updated`);
      } else {
        showToast('info', 'All presets are up to date');
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
    // Note: Scroll behavior changed since we use internal scrolling canvas
    document.getElementById('presets-canvas-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
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

  // ─── Render ──────────────────────────────────────────────────

  const categories = [
    { id: 'treatment', label: 'Treatment Presets', icon: <SettingsIcon />, color: 'text-teal-600', bg: 'bg-teal-50' },
    { id: 'diagnosis', label: 'Diagnosis Presets', icon: <ClipboardListIcon />, color: 'text-purple-600', bg: 'bg-purple-50' },
  ] as const;

  return (
    <div className="w-full min-h-fit bg-slate-50/50 flex flex-col -mx-6 px-6">
      <PageHeader 
        breadcrumb="Config"
        title="Presets Manager"
        icon={<div className="p-2 bg-slate-100 text-slate-700 rounded-lg"><ClipboardListIcon /></div>}
        actions={
          <button
            onClick={syncAllPresetsFromCloud}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors shadow-xs font-medium text-sm"
            title="Sync all presets from cloud"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            Sync from Cloud
          </button>
        }
      />

      <div className="flex-1 flex flex-col lg:flex-row gap-6 mt-4">
        
        {/* Sidebar: Categories Master List */}
        <div className="w-full lg:w-80 flex flex-col shrink-0 h-[calc(100vh-160px)]">
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {categories.map((cat) => {
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id as Tab)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl transition-all border ${
                    isActive 
                      ? 'bg-white border-teal-200 shadow-md ring-1 ring-teal-50' 
                      : 'bg-white/40 border-transparent hover:bg-white hover:border-slate-200 hover:shadow-xs'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-xs ${isActive ? cat.bg : 'bg-slate-50'} ${isActive ? cat.color : 'text-slate-500'}`}>
                    {cat.icon}
                  </div>
                  <div>
                    <h4 className={`font-medium text-sm tracking-wide ${isActive ? 'text-teal-900' : 'text-slate-700'}`}>{cat.label}</h4>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Canvas: Detail View */}
        <div className="flex-1 flex flex-col h-[calc(100vh-160px)] bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
          
          {/* Canvas Header */}
          <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-8 shrink-0 relative">
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
              {categories.find(c => c.id === activeTab)?.label}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === 'treatment' && "Manage your standard treatment plans, session counts, and pricing."}
              {activeTab === 'diagnosis' && "Manage diagnosis shortcuts and frequently used diagnoses."}
            </p>
          </div>

          {/* Canvas Body */}
          <div id="presets-canvas-scroll" className="overflow-y-auto p-8 flex-1 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8">
              
              {/* ════════════════ TREATMENT TAB ════════════════ */}
              {activeTab === 'treatment' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="flex gap-3 w-full sm:w-auto">
                      {!isAddingTreatment && (
                        <button
                          onClick={() => setIsAddingTreatment(true)}
                          className="flex items-center gap-2 px-6 py-2.5 bg-teal-50 text-teal-700 border border-teal-100 rounded-xl hover:bg-teal-100 transition-colors shadow-sm font-medium text-sm"
                        >
                          <PlusIcon />
                          Add Treatment
                        </button>
                      )}
                    </div>
                    <div className="w-full sm:w-64">
                      <input
                        type="text"
                        value={treatmentSearch}
                        onChange={(e) => setTreatmentSearch(e.target.value)}
                        placeholder="Search treatments..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-inner text-sm"
                      />
                    </div>
                  </div>

                  {/* Treatment Add/Edit Form */}
                  {isAddingTreatment && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
                      <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                          <span className="text-teal-600">{editingTreatmentId !== null ? <EditIcon /> : <PlusIcon />}</span>
                          {editingTreatmentId !== null ? 'Edit Treatment Preset' : 'Add New Treatment Preset'}
                        </h2>
                        <button onClick={resetTreatmentForm} className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 p-2 rounded-full hover:bg-slate-100"><XIcon /></button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">Treatment Name <span className="text-red-500">*</span></label>
                          <input type="text" value={treatmentForm.name} onChange={(e) => setTreatmentForm({ ...treatmentForm, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-inner" placeholder="e.g., Ultrasound Therapy" autoFocus />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">Default Sessions <span className="text-red-500">*</span></label>
                          <input type="number" min="1" value={treatmentForm.defaultSessions} onChange={(e) => setTreatmentForm({ ...treatmentForm, defaultSessions: parseInt(e.target.value) || 1 })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-inner" placeholder="e.g., 10" />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">Price Per Session (₹) <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                            <input type="number" min="0" step="0.01" value={treatmentForm.pricePerSession === 0 ? '' : treatmentForm.pricePerSession}
                              onChange={(e) => { const v = e.target.value; setTreatmentForm({ ...treatmentForm, pricePerSession: v === '' ? 0 : parseFloat(v) }); }}
                              className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-inner" placeholder="500" />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-50">
                        <button onClick={resetTreatmentForm} className="px-5 py-2.5 text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-medium transition-colors shadow-sm">Cancel</button>
                        <button onClick={handleSaveTreatment} className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-medium shadow-sm transition-all transform active:scale-95"><SaveIcon />{editingTreatmentId !== null ? 'Update Preset' : 'Save Preset'}</button>
                      </div>
                    </div>
                  )}

                  {/* Treatment Presets Table */}
                  <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Treatment Name</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Sessions</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Price/Session</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Value</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {presets.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-16 text-center">
                                <div className="flex flex-col items-center justify-center text-slate-400">
                                  <div className="p-5 bg-slate-50 rounded-full mb-4 shadow-inner"><SettingsIcon /></div>
                                  <p className="text-lg font-semibold text-slate-600 mb-1">No presets found</p>
                                  <p className="text-sm font-medium">Add your first treatment preset to get started.</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            presets
                              .filter((preset) =>
                                preset.name.toLowerCase().includes(treatmentSearch.toLowerCase())
                              )
                              .map((preset) => (
                                <tr key={preset.id} className="hover:bg-slate-50/50 transition-colors group">
                                  <td className="px-6 py-4"><div className="font-medium text-slate-800">{preset.name}</div></td>
                                  <td className="px-6 py-4"><span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100">{preset.defaultSessions} sessions</span></td>
                                  <td className="px-6 py-4 text-slate-600 font-medium">₹{preset.pricePerSession.toFixed(2)}</td>
                                  <td className="px-6 py-4"><span className="font-semibold text-emerald-600">₹{(preset.defaultSessions * preset.pricePerSession).toFixed(2)}</span></td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => handleEditTreatment(preset)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><EditIcon /></button>
                                      <button onClick={() => handleDeleteTreatment(preset.id!)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><TrashIcon /></button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ════════════════ DIAGNOSIS TAB ════════════════ */}
              {activeTab === 'diagnosis' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="flex gap-3 w-full sm:w-auto">
                      {!isAddingDiagnosis && (
                        <button
                          onClick={() => setIsAddingDiagnosis(true)}
                          className="flex items-center gap-2 px-6 py-2.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-xl hover:bg-purple-100 transition-colors shadow-sm font-medium text-sm"
                        >
                          <PlusIcon />
                          Add Diagnosis
                        </button>
                      )}
                    </div>
                    <div className="w-full sm:w-64">
                      <input
                        type="text"
                        value={diagnosisSearch}
                        onChange={(e) => setDiagnosisSearch(e.target.value)}
                        placeholder="Search diagnoses..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all shadow-inner text-sm"
                      />
                    </div>
                  </div>

                  {/* Add Diagnosis Form */}
                  {isAddingDiagnosis && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
                      <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><span className="text-purple-600"><PlusIcon /></span> Add New Diagnosis Preset</h2>
                        <button onClick={() => { setIsAddingDiagnosis(false); setNewDiagnosisName(''); }} className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 p-2 rounded-full hover:bg-slate-100"><XIcon /></button>
                      </div>
                      <div className="max-w-md space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Diagnosis Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={newDiagnosisName}
                          onChange={(e) => setNewDiagnosisName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddDiagnosis(); }}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all shadow-inner"
                          placeholder="e.g., Lumbar Spondylosis"
                          autoFocus
                        />
                      </div>
                      <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-50">
                        <button onClick={() => { setIsAddingDiagnosis(false); setNewDiagnosisName(''); }} className="px-5 py-2.5 text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-medium transition-colors shadow-sm">Cancel</button>
                        <button onClick={handleAddDiagnosis} className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium shadow-sm transition-all transform active:scale-95"><SaveIcon /> Save Diagnosis</button>
                      </div>
                    </div>
                  )}

                  {/* Diagnosis Presets List */}
                  <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Diagnosis Name</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Times Used</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {diagnosisPresets.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-6 py-16 text-center">
                                <div className="flex flex-col items-center justify-center text-slate-400">
                                  <div className="p-5 bg-slate-50 rounded-full mb-4 shadow-inner"><ClipboardListIcon /></div>
                                  <p className="text-lg font-semibold text-slate-600 mb-1">No diagnosis presets found</p>
                                  <p className="text-sm font-medium">Add your first diagnosis preset to get started.</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            diagnosisPresets
                              .filter((dp) =>
                                dp.name.toLowerCase().includes(diagnosisSearch.toLowerCase())
                              )
                              .map((dp) => (
                                <tr key={dp.id} className="hover:bg-slate-50/50 transition-colors group">
                                  <td className="px-6 py-4"><div className="font-medium text-slate-800">{dp.name}</div></td>
                                  <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                      {dp.frequency} time{dp.frequency !== 1 ? 's' : ''}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => handleDeleteDiagnosis(dp.id, dp.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><TrashIcon /></button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreatmentSettings;
