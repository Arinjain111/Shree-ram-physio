import { useState, useEffect, useMemo, useRef } from 'react';
import { useUI } from '@/context/UIContext';
import { useInvoicePrinter } from '@/hooks/useInvoicePrinter';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import PageHeader from '@/components/layout/PageHeader';
import { SearchIcon, RefreshIcon } from '@/components/icons';
import { PatientDetailPane } from '@/components/database/PatientDetailPane';
import Pagination from '@/components/ui/Pagination';
import type { DatabaseInvoice } from '@/types/database.types';
import type { InvoiceData } from '@/schemas/validation.schema';
import { ipcRenderer } from '@/lib/ipc';

// Helper for colors
const COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const SyncStatusDot = ({ status }: { status?: string }) => {
    if (!status) return null;
    const isSynced = status === 'SYNCED';
    const isConflict = status === 'CONFLICT';
    const colorClass = isSynced ? 'bg-emerald-500' : isConflict ? 'bg-rose-500' : 'bg-amber-500';
    return (
        <span className={`w-2.5 h-2.5 rounded-full ${colorClass} shadow-xs border border-white shrink-0`} title={status}></span>
    );
};

type SortOption = 'Name A-Z' | 'Name Z-A' | 'Recent' | 'Highest Paid';
type SyncFilterOption = 'All' | 'Synced' | 'Pending';

const DatabaseFind = () => {
  const { showToast } = useUI();
  const { handleError } = useErrorHandler();
  const { isSyncing, syncMessage, syncNow } = useSyncManager();
  const { printInvoice } = useInvoicePrinter();

  const [invoices, setInvoices] = useState<DatabaseInvoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<DatabaseInvoice[] | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const [showManageOptions, setShowManageOptions] = useState(false);
  const manageRef = useRef<HTMLDivElement>(null);

  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // New States
  const [sortOption, setSortOption] = useState<SortOption>('Name A-Z');
  const [alphabetFilter, setAlphabetFilter] = useState<string | null>(null);
  const [syncFilter, setSyncFilter] = useState<SyncFilterOption>('All');

  // Close dropdowns on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (manageRef.current && !manageRef.current.contains(e.target as Node)) setShowManageOptions(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterOptions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadInvoices = async () => {
    try {
      const result = await ipcRenderer.invoke('load-invoices');
      if (result.success) setInvoices(result.invoices);
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

    if (alphabetFilter) {
      result = result.filter(([name]) => name.toUpperCase().startsWith(alphabetFilter));
    }

    if (syncFilter !== 'All') {
      result = result.filter(([, invs]) => {
        if (syncFilter === 'Pending') {
          return invs.some(inv => inv.syncStatus !== 'SYNCED');
        } else if (syncFilter === 'Synced') {
          return invs.every(inv => inv.syncStatus === 'SYNCED');
        }
        return true;
      });
    }

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
  }, [allPatientGroups, debouncedSearchQuery, alphabetFilter, sortOption, syncFilter]);

  const totalPages = Math.max(1, Math.ceil(processedGroups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedGroups = processedGroups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [debouncedSearchQuery, alphabetFilter, sortOption, syncFilter]);

  // Update selected patient references if underlying data changes
  useEffect(() => {
      if (selectedPatient && invoices.length > 0) {
          const name = `${selectedPatient[0].patient.firstName} ${selectedPatient[0].patient.lastName}`;
          const updated = allPatientGroups.find(([n]) => n === name);
          if (updated) setSelectedPatient(updated[1]);
          else setSelectedPatient(null);
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
        discount: String(invoice.discount ?? 0),
        discountType: (invoice.discountType as 'amount' | 'percentage') || 'amount',
        timestamp: new Date().toISOString()
      };
      const success = await printInvoice(invoiceData);
      if (success) showToast('success', 'Invoice printed successfully');
    } catch (error) {
      handleError(error, 'Failed to print invoice');
    }
  };

  return (
    <div className="w-full min-h-fit bg-slate-50/50 flex flex-col -mx-6 px-6">
        <PageHeader 
          breadcrumb="Database"
          title="Patient Database"
          icon={<div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><SearchIcon /></div>}
          actions={
            <div className="flex items-center gap-2">
                {/* Manage Sync Settings Dropdown */}
                <div className="relative" ref={manageRef}>
                    <button 
                        onClick={() => setShowManageOptions(!showManageOptions)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Manage Data Sync"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
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
                                className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <RefreshIcon className="w-4 h-4" />
                                <span>Force Full Sync</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Cloud Sync Status/Button */}
                <button
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    isSyncing
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100'
                    }`}
                >
                {isSyncing ? (
                    <>
                        <RefreshIcon className="w-4 h-4 animate-spin" />
                        <span>Syncing...</span>
                    </>
                ) : (
                    <>
                        {syncMessage && syncMessage.includes('failed') ? (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                        ) : (
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        )}
                        <span>Cloud Sync</span>
                    </>
                )}
                </button>
            </div>
          }
        />

        {/* Layout: Sidebar (Master) + Main Canvas (Detail) */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 mt-4">
            
            {/* Sidebar: Patient Master List */}
            <div className="w-full lg:w-96 flex flex-col shrink-0 h-[calc(100vh-160px)]">
                
                {/* Search & Filter Header */}
                <div className="mb-4 flex gap-2">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search patients..."
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm text-slate-700"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>
                    
                    {/* Unified Filter/Sort Dropdown */}
                    <div className="relative" ref={filterRef}>
                        <button 
                            onClick={() => setShowFilterOptions(!showFilterOptions)}
                            className={`p-2.5 border rounded-xl flex items-center justify-center transition-colors shadow-xs ${showFilterOptions || alphabetFilter ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            title="Filter & Sort"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            {(alphabetFilter || syncFilter !== 'All') && <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white"></span>}
                        </button>
                        
                        {showFilterOptions && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 flex flex-col gap-4">
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sync Status</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['All', 'Synced', 'Pending'] as SyncFilterOption[]).map(opt => (
                                            <button 
                                                key={opt}
                                                onClick={() => setSyncFilter(opt)}
                                                className={`py-1.5 px-2 text-xs rounded-lg border text-center transition-all ${syncFilter === opt ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100 my-1"></div>

                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sort By</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['Name A-Z', 'Name Z-A', 'Recent', 'Highest Paid'] as SortOption[]).map(opt => (
                                            <button 
                                                key={opt}
                                                onClick={() => setSortOption(opt)}
                                                className={`py-1.5 px-2 text-sm rounded-lg border text-center transition-all ${sortOption === opt ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'}`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alphabet Filter</h4>
                                        {alphabetFilter && (
                                            <button onClick={() => setAlphabetFilter(null)} className="text-[10px] text-indigo-600 font-semibold hover:underline">Clear</button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {ALPHABET.map(letter => (
                                            <button
                                                key={letter}
                                                onClick={() => setAlphabetFilter(letter)}
                                                className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium transition-all ${
                                                    alphabetFilter === letter ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {letter}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Patient List */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
                    {paginatedGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-6">
                            <SearchIcon className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="text-slate-500 font-medium">No patients found</p>
                            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
                        </div>
                    ) : (
                        paginatedGroups.map(([name, patientInvoices], index) => {
                            const latest = patientInvoices[0];
                            const colorTheme = COLORS[index % COLORS.length];
                            const totalPaid = patientInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
                            const isSelected = selectedPatient && selectedPatient[0]?.patient.id === latest.patient.id;

                            return (
                                <button
                                    key={name}
                                    onClick={() => setSelectedPatient(patientInvoices)}
                                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all border ${
                                        isSelected 
                                            ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-50' 
                                            : 'bg-white/50 border-transparent hover:bg-white hover:border-slate-200 hover:shadow-xs'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-bold ${colorTheme.bg} ${colorTheme.text}`}>
                                        {name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <h4 className={`font-bold text-sm truncate pr-2 ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{name}</h4>
                                            {latest.patient.syncStatus !== 'SYNCED' && <SyncStatusDot status={latest.patient.syncStatus} />}
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <div className="text-slate-500 truncate">
                                                Last visit: {new Date(latest.date).toLocaleDateString()}
                                            </div>
                                            <span className="font-semibold text-slate-600 pl-2">₹{totalPaid}</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
                
                {/* Pagination */}
                {processedGroups.length > PAGE_SIZE && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <Pagination page={safePage} totalPages={totalPages} total={processedGroups.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
                    </div>
                )}
            </div>

            {/* Main Canvas: Detail View */}
            <div className="flex-1 flex flex-col h-[calc(100vh-160px)]">
                <PatientDetailPane invoices={selectedPatient} onPrintInvoice={handlePrintInvoice} />
            </div>
            
        </div>
    </div>
  );
};

export default DatabaseFind;
