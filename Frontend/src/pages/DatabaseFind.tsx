import { useState, useEffect, useMemo } from 'react';
import { useUI } from '@/context/UIContext';
import { useInvoicePrinter } from '@/hooks/useInvoicePrinter';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import PageHeader from '@/components/layout/PageHeader';
import { SearchIcon, RefreshIcon } from '@/components/icons';
import { PatientDetailModal } from '@/components/database/PatientDetailModal';
import type { DatabaseInvoice } from '@/types/database.types';
import type { InvoiceData } from '@/schemas/validation.schema';

const { ipcRenderer } = window.require('electron');

// Helper for colors
const COLORS = [
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
];

export const getSyncStatusBadge = (status?: string) => {
    if (!status) return null;
    const statusConfig: any = {
      SYNCED: { color: 'bg-emerald-500', text: '✓ Synced', textColor: 'text-white' },
      PENDING: { color: 'bg-amber-500', text: '⏳ Pending', textColor: 'text-white' },
      CONFLICT: { color: 'bg-rose-500', text: '⚠ Conflict', textColor: 'text-white' }
    };
    const config = statusConfig[status] || { color: 'bg-slate-500', text: status, textColor: 'text-white' };
    return (
      <span className={`${config.color} ${config.textColor} px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm`}>
        {config.text}
      </span>
    );
};

const DatabaseFind = () => {
  const { showToast, showModal } = useUI();
  const { handleError } = useErrorHandler();
  const { isSyncing, syncMessage, lastSyncTime, dbStats, syncNow } = useSyncManager();
  const { printInvoice } = useInvoicePrinter();

  const [invoices, setInvoices] = useState<DatabaseInvoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<DatabaseInvoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<DatabaseInvoice[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [showManageOptions, setShowManageOptions] = useState(false);

  const handleReset = (type: 'local' | 'cloud' | 'all') => {
      const confirmTitle = type === 'all' ? 'Reset Everywhere' : `Reset ${type.charAt(0).toUpperCase() + type.slice(1)} Database`;
      const confirmMsg = type === 'all' 
          ? 'Are you sure you want to PERMANENTLY DELETE ALL DATA from BOTH local and cloud databases?\nThis cannot be undone.'
          : `Are you sure you want to reset the ${type} database?\nThis will delete all data in ${type}.`;
      
      showModal({
          type: 'danger',
          title: confirmTitle,
          message: confirmMsg,
          confirmText: 'Yes, Delete',
          cancelText: 'Cancel',
          onConfirm: async () => {
              const cmd = type === 'local' ? 'reset-local-database' 
                        : type === 'cloud' ? 'reset-cloud-database' 
                        : 'reset-all-databases';

              try {
                  showToast('info', `Resetting ${type} database...`);
                  const result = await ipcRenderer.invoke(cmd);
                  if (result.success) {
                      showToast('success', `${type.toUpperCase()} database reset successfully`);
                      // Force reload
                      const reloadResult = await ipcRenderer.invoke('load-invoices');
                      if (reloadResult.success) {
                          setInvoices(reloadResult.invoices);
                          setFilteredInvoices(reloadResult.invoices);
                      }
                      window.dispatchEvent(new CustomEvent('invoices-updated')); 
                  } else {
                      showModal({
                          title: 'Reset Failed',
                          message: result.error,
                          type: 'danger',
                          confirmText: 'Close'
                      });
                  }
              } catch (error) {
                  handleError(error, 'Reset failed');
              } finally {
                  setShowManageOptions(false);
              }
          }
      });
  };

  // New hooks replace manual ipc listeners and sync state management
  // We still need to load invoices locally
  const loadInvoices = async () => {
    try {
      const result = await ipcRenderer.invoke('load-invoices');
      if (result.success) {
        setInvoices(result.invoices);
        setFilteredInvoices(result.invoices); // Initialize with all
      }
    } catch (error) {
      handleError(error, 'Error loading invoices');
    }
  };

  const handleSyncNow = async () => {
    const ok = await syncNow();
    if (ok) {
      await loadInvoices();
      showToast('success', 'Data synced successfully');
    }
  };

  useEffect(() => {
    loadInvoices();
    // Listen for updates from other parts of the app
    const handleInvoicesUpdated = () => loadInvoices();
    window.addEventListener('invoices-updated', handleInvoicesUpdated);
    return () => window.removeEventListener('invoices-updated', handleInvoicesUpdated);
  }, []);

  // Debounce Search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Filter
  useEffect(() => {
    if (debouncedSearchQuery.trim() === '') {
      setFilteredInvoices(invoices);
    } else {
      const query = debouncedSearchQuery.toLowerCase();
      const filtered = invoices.filter(inv =>
        inv.patient.firstName.toLowerCase().includes(query) ||
        inv.patient.lastName.toLowerCase().includes(query) ||
        inv.patient.age.toString().includes(query) ||
        (inv.patient.phone && inv.patient.phone.includes(query)) ||
        inv.invoiceNumber.toLowerCase().includes(query)
      );
      setFilteredInvoices(filtered);
    }
    setVisibleCount(20);
  }, [debouncedSearchQuery, invoices]);

  // Memoized Group By
  const patientGroups = useMemo(() => {
    const grouped = new Map<string, DatabaseInvoice[]>();
    filteredInvoices.forEach(inv => {
      const name = `${inv.patient.firstName} ${inv.patient.lastName}`;
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name)!.push(inv);
    });
    return Array.from(grouped.entries());
  }, [filteredInvoices]);

  const visiblePatientGroups = patientGroups.slice(0, visibleCount);

  const handlePrintInvoice = async (invoice: DatabaseInvoice) => {
    // Map DatabaseInvoice to InvoiceData structure expected by printer
    const invoiceData: InvoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date,
      patient: {
        firstName: invoice.patient.firstName,
        lastName: invoice.patient.lastName,
        age: invoice.patient.age,
        gender: invoice.patient.gender,
        phone: invoice.patient.phone || '0000000000', // Provide default valid phone if missing
        uhid: invoice.patient.uhid
      },
      treatments: invoice.treatments.map(t => ({
        name: t.name,
        sessions: t.sessions,
        startDate: t.startDate,
        endDate: t.endDate,
        amount: t.amount,
        duration: '', // Required by schema
      })),
      diagnosis: invoice.diagnosis || '',
      notes: invoice.notes || '',
      paymentMethod: invoice.paymentMethod,
      total: invoice.total.toString(),
      timestamp: new Date().toISOString()
    };

    await printInvoice(invoiceData);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 px-6 pb-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <PageHeader 
          title="Patient Database"
          icon={<div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><SearchIcon /></div>}
          actions={
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                  {/* Manage Data Dropdown */}
                  <div className="relative">
                      <button 
                          onClick={() => setShowManageOptions(!showManageOptions)}
                          className="px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
                      >
                          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          <span>Manage Data</span>
                      </button>
                      
                      {showManageOptions && (
                          <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-1">
                              <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Sync Actions</div>
                              <button 
                                  onClick={async () => {
                                      try {
                                          showToast('info', 'Resetting sync timestamp...');
                                          const result = await ipcRenderer.invoke('reset-sync-timestamp');
                                          if (result.success) {
                                              showToast('success', 'Next sync will fetch ALL cloud data');
                                              await handleSyncNow();
                                          } else {
                                              showToast('error', result.error || 'Failed to reset sync timestamp');
                                          }
                                      } catch (error) {
                                          handleError(error, 'Reset sync failed');
                                      } finally {
                                          setShowManageOptions(false);
                                      }
                                  }} 
                                  className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex items-center gap-2"
                              >
                                  <span>🔄 Force Full Sync</span>
                              </button>
                              <div className="h-px bg-slate-100 my-1"></div>
                              <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Reset Actions</div>
                              <button 
                                  onClick={() => handleReset('local')} 
                                  className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors flex items-center gap-2"
                              >
                                  <span>💻 Reset Local DB</span>
                              </button>
                              <button 
                                  onClick={() => handleReset('cloud')} 
                                  className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors flex items-center gap-2"
                              >
                                  <span>☁️ Reset Cloud DB</span>
                              </button>
                              <div className="h-px bg-slate-100 my-1"></div>
                              <button 
                                  onClick={() => handleReset('all')} 
                                  className="text-left px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2"
                              >
                                  <span>⚠ Reset Everything</span>
                              </button>
                          </div>
                      )}
                  </div>

                  <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className={`px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-sm ${
                  isSyncing
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md active:scale-95'
                }`}
              >
                {isSyncing ? (
                  <>
                     <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                     </svg>
                     <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshIcon className="w-4 h-4" />
                    <span>Sync Now</span>
                  </>
                )}
              </button>
              </div>
              {(syncMessage || lastSyncTime) && (
                <div className="mt-2 text-right">
                  {syncMessage ? (
                    <p className={`text-xs font-medium ${syncMessage.includes('failed') ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {syncMessage}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium">
                      Last synced: {new Date(lastSyncTime!).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          }
        />

        {/* Stats Panel (Simplified) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">Database Overview</h3>
                </div>
                {dbStats && (
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-lg">
                        <div className="text-2xl font-bold text-indigo-600">{dbStats.patients}</div>
                        <div className="text-xs text-slate-600 font-medium">Patients</div>
                    </div>
                    <div className="flex items-center gap-3 bg-purple-50 px-4 py-2 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{dbStats.invoices}</div>
                        <div className="text-xs text-slate-600 font-medium">Invoices</div>
                    </div>
                  </div>
                )}
             </div>
        </div>

        {/* Search */}
        <div className="relative max-w-2xl mx-auto">
           <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <SearchIcon className="h-5 w-5 text-slate-400" />
           </div>
           <input
             type="text"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             placeholder="Search patients by name, phone, or UHID..."
             className="w-full pl-11 pr-4 py-4 bg-white border-0 rounded-2xl shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all text-slate-600 placeholder:text-slate-400"
           />
           {searchQuery && (
             <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600">
               <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
           )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {visiblePatientGroups.length === 0 && searchQuery && (
               <div className="col-span-full text-center py-20">
                   <h3 className="text-lg text-slate-500">No patients found matching "{searchQuery}"</h3>
               </div>
           )}

           {visiblePatientGroups.map(([name, patientInvoices], index) => {
             const latest = patientInvoices[0];
             const colorTheme = COLORS[index % COLORS.length];
             const totalPaid = patientInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
             
             return (
               <div
                 key={name}
                 onClick={() => setSelectedPatient(patientInvoices)}
                 className={`group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border border-slate-100 hover:-translate-y-1`}
               >
                 {/* Decorative Header */}
                 <div className={`h-24 ${colorTheme.bg} relative overflow-hidden`}>
                   <div className="absolute inset-0 opacity-30">
                     <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                       <path d="M0 100 C 20 0 50 0 100 100 Z" fill="currentColor" className="text-white" />
                     </svg>
                   </div>
                   <div className="absolute top-4 right-4">
                     {getSyncStatusBadge(latest.patient.syncStatus)}
                   </div>
                 </div>

                 {/* Content */}
                 <div className="px-5 pb-5">
                   <div className="relative -mt-10 mb-3">
                     <div className={`w-20 h-20 rounded-2xl ${colorTheme.bg} ${colorTheme.border} border-4 border-white shadow-md flex items-center justify-center text-2xl font-bold ${colorTheme.text}`}>
                       {name.charAt(0)}
                     </div>
                   </div>

                   <div className="flex items-center justify-between mb-1">
                     <h3 className="text-lg font-bold text-slate-800 truncate pr-2">{name}</h3>
                     <span className="px-2 py-0.5 rounded text-[10px] bg-slate-50 text-slate-600 font-bold uppercase">{latest.patient.gender}</span>
                   </div>
                   
                   <p className="text-sm text-slate-500 mb-4">{latest.patient.phone || 'No Phone'}</p>

                   <div className="flex items-center justify-between text-sm p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-slate-500">Total Paid</span>
                      <span className="font-bold text-emerald-600">₹{totalPaid}</span>
                   </div>
                 </div>
               </div>
             );
           })}
        </div>
        
        {visiblePatientGroups.length < patientGroups.length && (
            <div className="flex justify-center mt-8 pb-8">
                <button onClick={() => setVisibleCount(p => p + 20)} className="px-6 py-2.5 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 font-semibold">
                    Load More Patients
                </button>
            </div>
        )}

        {/* Modal */}
        <PatientDetailModal 
            invoices={selectedPatient} 
            onClose={() => setSelectedPatient(null)} 
            onPrintInvoice={handlePrintInvoice}
        />

      </div>
    </div>
  );
};

export default DatabaseFind;
