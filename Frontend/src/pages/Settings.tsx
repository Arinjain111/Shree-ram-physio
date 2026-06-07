import { useState, useEffect } from 'react';
import { useUI } from '@/context/UIContext';
import PageHeader from '@/components/layout/PageHeader';
import { handleFrontendError } from '@/services/errorHandler';
import { useAutoUpdater } from '@/hooks/useAutoUpdater';
import packageJson from '../../package.json';
import { ipcRenderer } from '@/lib/ipc';

type SettingCategory = 'invoice' | 'sync' | 'about';

// Icons
const SettingsIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const InvoiceIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const SyncIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 14a8 8 0 00-14.828-3M4 10a8 8 0 0014.828 3" /></svg>;
const AboutIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

const Settings = () => {
  const { showToast } = useUI();
  const [activeCategory, setActiveCategory] = useState<SettingCategory>('invoice');
  const [saveLocation, setSaveLocation] = useState('');
  const [autoSaveInvoicePdf, setAutoSaveInvoicePdf] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isFullSyncing, setIsFullSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ pendingChanges: number; lastSync: string | null; isSyncing: boolean } | null>(null);
  const { status, checkForUpdates } = useAutoUpdater();

  useEffect(() => { loadSettings(); }, []);

  const loadSyncStatus = async () => {
    try {
      const r = await ipcRenderer.invoke('get-sync-status');
      if (r?.success && r.status) setSyncStatus(r.status);
    } catch {}
  };

  useEffect(() => {
    loadSyncStatus();
    if (activeCategory !== 'sync') return;
    const interval = setInterval(loadSyncStatus, 10000);
    return () => clearInterval(interval);
  }, [activeCategory]);

  useEffect(() => {
    if (status === 'checking') showToast('info', 'Checking for updates, please wait...');
    else if (status === 'not-available') showToast('success', 'No updates found. You are on the latest version.');
    else if (status === 'available') showToast('info', 'Update found! Downloading in the background...');
    else if (status === 'downloaded') showToast('success', 'Update downloaded and ready to install.');
    else if (status === 'error') showToast('error', 'Failed to check for updates. Please try again.');
  }, [status, showToast]);

  const loadSettings = async () => {
    try {
      const settingsResult = await ipcRenderer.invoke('get-invoice-settings');
      if (settingsResult?.success) {
        setSaveLocation(settingsResult.invoiceSaveLocation);
        setAutoSaveInvoicePdf(Boolean(settingsResult.autoSaveInvoicePdf));
        return;
      }
      const result = await ipcRenderer.invoke('get-save-location');
      if (result?.success) setSaveLocation(result.location);
    } catch (error) {
      handleFrontendError(error, showToast, 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoSave = async (enabled: boolean) => {
    try {
      const result = await ipcRenderer.invoke('set-auto-save-invoice-pdf', enabled);
      if (result?.success) {
        setAutoSaveInvoicePdf(Boolean(result.autoSaveInvoicePdf));
        showToast('success', enabled ? 'Auto-save enabled' : 'Auto-save disabled');
      } else {
        showToast('error', 'Failed to update auto-save setting');
      }
    } catch (error) {
      handleFrontendError(error, showToast, 'Failed to update auto-save setting');
    }
  };

  const handleChooseLocation = async () => {
    try {
      const result = await ipcRenderer.invoke('choose-save-location');
      if (result.success) {
        setSaveLocation(result.location);
        showToast('success', `Save location updated`);
      }
    } catch (error) {
      handleFrontendError(error, showToast, 'Failed to change save location');
    }
  };

  const handleForceFullSync = async () => {
    setIsFullSyncing(true);
    try {
      showToast('info', 'Forcing full sync...');
      const reset = await ipcRenderer.invoke('reset-sync-timestamp');
      if (!reset?.success) {
        showToast('error', reset?.error || 'Failed to reset sync timestamp');
        return;
      }
      const sync = await ipcRenderer.invoke('sync-now');
      if (sync?.success) showToast('success', 'Full sync completed');
      else showToast('error', sync?.error || 'Full sync failed');
    } catch (error) {
      handleFrontendError(error, showToast, 'Failed to force full sync');
    } finally {
      setIsFullSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-fit bg-slate-50/50 flex flex-col -mx-6 px-6 pb-6">
        <PageHeader title="System Settings" icon={<div className="p-2 bg-slate-100 text-slate-700 rounded-lg"><SettingsIcon /></div>} />
        <div className="flex-1 flex items-center justify-center h-[calc(100vh-160px)]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  const categories = [
    { id: 'invoice', label: 'Invoice Preferences', icon: <InvoiceIcon />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'sync', label: 'Data Sync', icon: <SyncIcon />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'about', label: 'System & About', icon: <AboutIcon />, color: 'text-purple-600', bg: 'bg-purple-50' },
  ] as const;

  return (
    <div className="w-full min-h-fit bg-slate-50/50 flex flex-col -mx-6 px-6">
      <PageHeader 
        breadcrumb="Config"
        title="System Settings"
        icon={<div className="p-2 bg-slate-100 text-slate-700 rounded-lg"><SettingsIcon /></div>}
      />

      <div className="flex-1 flex flex-col lg:flex-row gap-6 mt-4">
        
        {/* Sidebar: Categories Master List */}
        <div className="w-full lg:w-80 flex flex-col shrink-0 h-[calc(100vh-160px)]">
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl transition-all border ${
                    isActive 
                      ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-50' 
                      : 'bg-white/40 border-transparent hover:bg-white hover:border-slate-200 hover:shadow-xs'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-xs ${isActive ? cat.bg : 'bg-slate-50'} ${isActive ? cat.color : 'text-slate-500'}`}>
                    {cat.icon}
                  </div>
                  <div>
                    <h4 className={`font-medium text-sm tracking-wide ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>{cat.label}</h4>
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
              {categories.find(c => c.id === activeCategory)?.label}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {activeCategory === 'invoice' && "Configure how invoices are generated and saved."}
              {activeCategory === 'sync' && "Manage cloud synchronization and data backup."}
              {activeCategory === 'about' && "Application version and update settings."}
            </p>
          </div>

          {/* Canvas Body */}
          <div className="overflow-y-auto p-8 flex-1 custom-scrollbar">
            <div className="max-w-2xl">
              
              {/* Category: INVOICE */}
              {activeCategory === 'invoice' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Auto Save Toggle */}
                  <div className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-slate-100 bg-white shadow-xs">
                    <div>
                      <h4 className="text-sm font-medium text-slate-800">Auto-save invoice PDF to PC</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        When disabled, printing will not automatically save a PDF file to the selected folder.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleAutoSave(!autoSaveInvoicePdf)}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors shadow-inner ${
                        autoSaveInvoicePdf ? 'bg-indigo-500' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${autoSaveInvoicePdf ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Save Location */}
                  <div className="p-5 rounded-2xl border border-slate-100 bg-white shadow-xs">
                    <h4 className="text-sm font-medium text-slate-800 mb-1">Invoice Save Location</h4>
                    <p className="text-xs text-slate-500 mb-4">
                      Choose where invoice PDFs will be automatically saved when printing.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className={`flex-1 px-4 py-3 border rounded-xl text-sm font-mono break-all ${
                        autoSaveInvoicePdf ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-50/50 border-slate-100 text-slate-400'
                      }`}>
                        {saveLocation || 'Not set'}
                      </div>
                      <button
                        onClick={handleChooseLocation}
                        disabled={!autoSaveInvoicePdf}
                        className={`px-5 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 shrink-0 ${
                          autoSaveInvoicePdf ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        }`}
                      >
                        Choose Folder
                      </button>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className={`rounded-2xl p-5 border ${
                    autoSaveInvoicePdf ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50/50 border-slate-100'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 ${autoSaveInvoicePdf ? 'text-blue-500' : 'text-slate-400'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div>
                        <h4 className={`text-sm font-medium mb-1 ${autoSaveInvoicePdf ? 'text-blue-900' : 'text-slate-700'}`}>
                          Auto-Save Details
                        </h4>
                        {autoSaveInvoicePdf ? (
                          <p className="text-xs text-blue-700 font-medium">
                            When you print an invoice, it will be automatically saved as a PDF to this location with the filename format:
                            <span className="font-mono bg-white px-2 py-0.5 rounded-md border border-blue-200 ml-1 shadow-sm">Invoice_[Number]_[Date].pdf</span>
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 font-medium">
                            Auto-save is disabled. Printing will not create a PDF file automatically on this PC.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Category: SYNC */}
              {activeCategory === 'sync' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Sync Workflow Indicator */}
                  <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-slate-800">Sync Status</h4>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${syncStatus?.isSyncing ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        <span className={`w-2 h-2 rounded-full ${syncStatus?.isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                        {syncStatus?.isSyncing ? 'Syncing...' : 'Idle'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-500">Pending Changes</p>
                        <p className="text-xl font-bold text-amber-600">{syncStatus?.pendingChanges ?? '---'}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-500">Last Sync</p>
                        <p className="text-sm font-semibold text-slate-700">{syncStatus?.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never'}</p>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500 mb-2">Sync Progress</p>
                      <div className="space-y-1.5">
                        {[
                          { label: 'Patients', key: 'patients' as const },
                          { label: 'Invoices', key: 'invoices' as const },
                          { label: 'Treatments', key: 'treatments' as const },
                          { label: 'Inventory Items', key: 'inventoryItems' as const },
                          { label: 'Inv. Transactions', key: 'inventoryTransactions' as const },
                        ].map(row => {
                          const count = (syncStatus as any)?.[row.key] ?? undefined;
                          return (
                            <div key={row.label} className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">{row.label}</span>
                              <span className={`font-medium ${count > 0 ? 'text-amber-600' : count === 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {count !== undefined ? (count > 0 ? `${count} pending` : 'Synced') : '---'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-xs">
                    <h4 className="text-sm font-medium text-slate-800 mb-2">Force Full Sync</h4>
                    <p className="text-xs text-slate-500 mb-6 max-w-md leading-relaxed">
                      If your local data feels out of sync with the cloud, or if you've reinstalled the application, you can force a full sync to download all data from the cloud database again. This may take a few minutes depending on your internet connection.
                    </p>
                    
                    <button
                      type="button"
                      onClick={handleForceFullSync}
                      disabled={isFullSyncing}
                      className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                        isFullSyncing
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 shadow-sm'
                      }`}
                    >
                      {isFullSyncing ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"></div>
                          Syncing...
                        </>
                      ) : (
                        'Force Full Sync'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Category: ABOUT */}
              {activeCategory === 'about' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-xs">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <span className="text-sm font-medium text-slate-500">Application Name</span>
                        <span className="text-sm font-medium text-slate-800 tracking-tight">Shri Ram Physio</span>
                      </div>
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <span className="text-sm font-medium text-slate-500">Version</span>
                        <span className="text-sm font-medium text-slate-800 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{packageJson.version}</span>
                      </div>
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <span className="text-sm font-medium text-slate-500">Developer</span>
                        <span className="text-sm font-medium text-slate-800">Shree Ram Physiotherapy</span>
                      </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end">
                      <button
                        onClick={checkForUpdates}
                        disabled={status === 'checking' || status === 'downloading'}
                        className="px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 border border-slate-200 shadow-xs"
                      >
                        {status === 'checking' && <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"></div>}
                        {status === 'checking' ? 'Checking for updates...' : 'Check for Updates'}
                      </button>
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

export default Settings;
