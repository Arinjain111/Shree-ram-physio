import { useState, useEffect, useMemo } from 'react';
import { useUI } from '@/context/UIContext';
import { useInvoicePrinter } from '@/hooks/useInvoicePrinter';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import PageHeader from '@/components/layout/PageHeader';
import { SearchIcon, RefreshIcon } from '@/components/icons';
import { PatientDetailPane } from '@/components/database/PatientDetailPane';
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

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const SyncStatusDot = ({ status }: { status?: string }) => {
    if (!status) return null;
    const config: any = {
      SYNCED: { bg: 'bg-emerald-500', title: 'Synced' },
      PENDING: { bg: 'bg-amber-500', title: 'Pending' },
      CONFLICT: { bg: 'bg-rose-500', title: 'Conflict' }
    };
    const c = config[status] || { bg: 'bg-slate-500', title: status };
    return (
        <div className="relative group inline-flex items-center justify-center">
            <span className={`w-3 h-3 rounded-full ${c.bg} shadow-sm border border-white block`}></span>
            <div className="absolute bottom-full mb-1 hidden group-hover:block whitespace-nowrap bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-10">
                {c.title}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
            </div>
        </div>
    );
};

type SortOption = 'Name A-Z' | 'Name Z-A' | 'Recent' | 'Highest Paid';

const DatabaseFind = () => {
  const { showToast, showModal } = useUI();
  const { handleError } = useErrorHandler();
  const { isSyncing, syncMessage, lastSyncTime, syncNow } = useSyncManager();
  const { printInvoice } = useInvoicePrinter();

  const [invoices, setInvoices] = useState<DatabaseInvoice[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<DatabaseInvoice[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [showManageOptions, setShowManageOptions] = useState(false);
  
  // New States
  const [sortOption, setSortOption] = useState<SortOption>('Name A-Z');
  const [alphabetFilter, setAlphabetFilter] = useState<string | null>(null);

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
                      const reloadResult = await ipcRenderer.invoke('load-invoices');
                      if (reloadResult.success) {
                          setInvoices(reloadResult.invoices);
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

  const loadInvoices = async () => {
    try {
      const result = await ipcRenderer.invoke('load-invoices');
      if (result.success) {
        setInvoices(result.invoices);
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
    const handleInvoicesUpdated = () => loadInvoices();
    window.addEventListener('invoices-updated', handleInvoicesUpdated);
    return () => window.removeEventListener('invoices-updated', handleInvoicesUpdated);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Group by Patient Name (Pre-computation)
  const allPatientGroups = useMemo(() => {
    const grouped = new Map<string, DatabaseInvoice[]>();
    invoices.forEach(inv => {
      const name = `${inv.patient.firstName} ${inv.patient.lastName}`;
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name)!.push(inv);
    });
    return Array.from(grouped.entries());
  }, [invoices]);

  // Filter & Sort Logic
  const processedGroups = useMemo(() => {
    let result = [...allPatientGroups];

    // 1. Search Filter
    if (debouncedSearchQuery.trim() !== '') {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter(([name, invs]) => {
        const p = invs[0].patient;
        return name.toLowerCase().includes(query) ||
               p.age.toString().includes(query) ||
               (p.phone && p.phone.includes(query)) ||
               invs.some(inv => inv.invoiceNumber.toLowerCase().includes(query));
      });
    }

    // 2. Alphabet Filter
    if (alphabetFilter) {
      result = result.filter(([name]) => name.toUpperCase().startsWith(alphabetFilter));
    }

    // 3. Sort
    result.sort((a, b) => {
        const [nameA, invsA] = a;
        const [nameB, invsB] = b;
        
        switch (sortOption) {
            case 'Name A-Z': return nameA.localeCompare(nameB);
            case 'Name Z-A': return nameB.localeCompare(nameA);
            case 'Highest Paid': {
                const totalA = invsA.reduce((sum, inv) => sum + (inv.total || 0), 0);
                const totalB = invsB.reduce((sum, inv) => sum + (inv.total || 0), 0);
                return totalB - totalA;
            }
            case 'Recent': {
                const dateA = Math.max(...invsA.map(inv => new Date(inv.date).getTime()));
                const dateB = Math.max(...invsB.map(inv => new Date(inv.date).getTime()));
                return dateB - dateA;
            }
            default: return 0;
        }
    });

    return result;
  }, [allPatientGroups, debouncedSearchQuery, alphabetFilter, sortOption]);

  const visiblePatientGroups = processedGroups.slice(0, visibleCount);

  // Update selected patient references if underlying data changes
  useEffect(() => {
      if (selectedPatient && invoices.length > 0) {
          const name = `${selectedPatient[0].patient.firstName} ${selectedPatient[0].patient.lastName}`;
          const updated = allPatientGroups.find(([n]) => n === name);
          if (updated) {
              setSelectedPatient(updated[1]);
          } else {
              setSelectedPatient(null);
          }
      }
  }, [invoices, allPatientGroups]);

  const handlePrintInvoice = async (invoice: DatabaseInvoice) => {
    try {
      const invoiceData: InvoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        patient: {
          firstName: invoice.patient.firstName,
          lastName: invoice.patient.lastName,
          age: invoice.patient.age,
          gender: invoice.patient.gender,
          phone: invoice.patient.phone || '0000000000',
          uhid: invoice.patient.uhid || ''
        },
        treatments: invoice.treatments.map(t => ({
          name: t.name,
          sessions: t.sessions,
          startDate: t.startDate,
          endDate: t.endDate,
          amount: t.amount,
          duration: '',
        })),
        diagnosis: invoice.diagnosis || '',
        notes: invoice.notes || '',
        paymentMethod: invoice.paymentMethod,
        total: invoice.total.toString(),
        timestamp: new Date().toISOString()
      };

      const success = await printInvoice(invoiceData);
      if (success) showToast('success', 'Invoice printed successfully');
    } catch (error) {
      handleError(error, 'Failed to print invoice');
    }
  };

  return (
    <div className="w-full mx-auto px-6 min-h-fit bg-slate-50/50 flex flex-col">
        {/* Header - Remains identical */}
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

        {/* Master-Detail Layout */}
        <div className="flex-1 flex gap-6 mt-4 min-h-[600px] max-h-[calc(100vh-140px)]">
            
            {/* Left Pane: Master List */}
            <div className="w-[45%] lg:w-[40%] flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                
                {/* Search & Filters */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3 shrink-0">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search patients..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-600"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">Sort:</span>
                            <select 
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value as SortOption)}
                                className="bg-transparent border-none text-indigo-600 font-bold p-0 pr-6 focus:ring-0 cursor-pointer"
                            >
                                <option value="Name A-Z">Name A-Z</option>
                                <option value="Name Z-A">Name Z-A</option>
                                <option value="Recent">Recent Activity</option>
                                <option value="Highest Paid">Highest Paid</option>
                            </select>
                        </div>
                        <div className="text-slate-400 font-medium text-xs flex gap-2">
                            <span>{processedGroups.length} Patients</span>
                            <span>&bull;</span>
                            <span>{invoices.length} Invoices</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Patient List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {visiblePatientGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                <p className="text-slate-400 font-medium">No patients found</p>
                            </div>
                        ) : (
                            visiblePatientGroups.map(([name, patientInvoices], index) => {
                                const latest = patientInvoices[0];
                                const colorTheme = COLORS[index % COLORS.length];
                                const totalPaid = patientInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
                                const isSelected = selectedPatient && selectedPatient[0]?.patient.id === latest.patient.id;

                                return (
                                    <div
                                        key={name}
                                        onClick={() => setSelectedPatient(patientInvoices)}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                                            isSelected 
                                                ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                                                : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-lg font-bold shadow-sm ${colorTheme.bg} ${colorTheme.text} ${isSelected ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}`}>
                                            {name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <h4 className="font-bold text-slate-800 text-sm truncate pr-2">{name}</h4>
                                                <SyncStatusDot status={latest.patient.syncStatus} />
                                            </div>
                                            <div className="flex justify-between items-center text-xs mt-1">
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <span>{latest.patient.phone || 'No Phone'}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span>{patientInvoices.length} Invoice{patientInvoices.length !== 1 ? 's' : ''}</span>
                                                </div>
                                                <span className="font-bold text-emerald-600">₹{totalPaid}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        {visiblePatientGroups.length < processedGroups.length && (
                            <button 
                                onClick={() => setVisibleCount(p => p + 20)} 
                                className="w-full py-2.5 mt-2 bg-slate-50 text-slate-600 font-medium rounded-xl hover:bg-slate-100 transition-colors text-sm"
                            >
                                Load More
                            </button>
                        )}
                    </div>

                    {/* Alphabet Jump List */}
                    <div className="w-8 shrink-0 bg-slate-50 border-l border-slate-100 flex flex-col items-center py-2 overflow-y-auto sm:hidden">
                        <button 
                            onClick={() => setAlphabetFilter(null)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-colors ${
                                alphabetFilter === null ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                            }`}
                            title="All"
                        >
                            #
                        </button>
                        {ALPHABET.map(letter => (
                            <button
                                key={letter}
                                onClick={() => setAlphabetFilter(letter)}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold my-px transition-colors ${
                                    alphabetFilter === letter ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                                }`}
                            >
                                {letter}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Pane: Detail View */}
            <div className="w-[55%] lg:w-[60%] flex flex-col">
                <PatientDetailPane 
                    invoices={selectedPatient}
                    onPrintInvoice={handlePrintInvoice}
                />
            </div>
            
        </div>
    </div>
  );
};

export default DatabaseFind;
