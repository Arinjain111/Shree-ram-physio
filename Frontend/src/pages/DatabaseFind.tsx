import { useState, useEffect } from 'react';
import { useInvoiceLayout } from '@/hooks/useInvoiceLayout';
import { useUI } from '@/context/UIContext';
import { generateInvoiceHTML } from '@/utils/invoiceGenerator';
import PageHeader from '@/components/layout/PageHeader';
import type { InvoiceData } from '@/schemas/validation.schema.ts';
import type { DatabaseInvoice } from '@/types/database.types';
import { handleFrontendError } from '@/services/errorHandler';
import { SearchIcon, RefreshIcon } from '@/components/icons';

const { ipcRenderer } = window.require('electron');

type Invoice = DatabaseInvoice;

const COLORS = [
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
];

const TreatmentCalendar = ({ treatments }: { treatments: Invoice['treatments'] }) => {
  const dates = treatments.flatMap(t => [new Date(t.startDate), new Date(t.endDate)]);
  if (dates.length === 0) return null;
  
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  
  const months = [];
  const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  
  while (current <= end) {
    months.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }

  const isDateInTreatment = (date: Date, treatment: any) => {
    const start = new Date(treatment.startDate);
    start.setHours(0,0,0,0);
    const end = new Date(treatment.endDate);
    end.setHours(23,59,59,999);
    return date >= start && date <= end;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {months.map(monthDate => (
          <div key={monthDate.toISOString()} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-semibold text-center text-slate-700">
              {monthDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
            </div>
            <div className="p-4 bg-white">
              <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
                  const activeTreatments = treatments.map((t, idx) => ({ ...t, color: COLORS[idx % COLORS.length] }))
                    .filter(t => isDateInTreatment(date, t));
                  
                  return (
                    <div 
                      key={day} 
                      className="aspect-square relative flex items-center justify-center text-sm rounded-lg hover:bg-slate-50 transition-colors group cursor-default"
                      title={activeTreatments.map(t => t.name).join(', ')}
                    >
                      <span className={`z-10 ${activeTreatments.length > 0 ? 'font-bold text-slate-800' : 'text-slate-500'}`}>{day}</span>
                      
                      {/* Background for single treatment */}
                      {activeTreatments.length === 1 && (
                        <div className={`absolute inset-0.5 rounded-lg opacity-20 ${activeTreatments[0].color.bg}`} />
                      )}

                      {/* Background for multiple treatments */}
                      {activeTreatments.length > 1 && (
                        <div className="absolute inset-0.5 rounded-lg bg-slate-100/80" />
                      )}

                      {/* Dots for treatments */}
                      {activeTreatments.length > 0 && (
                         <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 flex gap-1">
                           {activeTreatments.map((t, idx) => (
                             <div key={idx} className={`w-1.5 h-1.5 rounded-full ${t.color.dot}`} />
                           ))}
                         </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {treatments.map((t, idx) => {
          const color = COLORS[idx % COLORS.length];
          return (
            <div key={idx} className={`flex flex-col gap-1 px-4 py-2 rounded-xl border ${color.bg} ${color.border}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                <span className={`text-sm font-bold ${color.text}`}>{t.name}</span>
                <span className={`text-xs ${color.text} opacity-75`}>({t.sessions} sessions)</span>
              </div>
              <div className={`text-xs ${color.text} pl-4 opacity-90`}>
                {new Date(t.startDate).toLocaleDateString()} - {new Date(t.endDate).toLocaleDateString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DatabaseFind = () => {
  const { layout } = useInvoiceLayout();
  const { showToast } = useUI();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Invoice[] | null>(null);
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>('');

  const getSyncStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const statusConfig = {
      SYNCED: { color: 'bg-emerald-500', text: '✓ Synced', textColor: 'text-white' },
      PENDING: { color: 'bg-amber-500', text: '⏳ Pending', textColor: 'text-white' },
      CONFLICT: { color: 'bg-rose-500', text: '⚠ Conflict', textColor: 'text-white' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
                   { color: 'bg-slate-500', text: status, textColor: 'text-white' };
    
    return (
      <span className={`${config.color} ${config.textColor} px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm`}>
        {config.text}
      </span>
    );
  };

  useEffect(() => {
    loadInvoices();
    
    const handleInvoicesUpdated = () => {
      loadInvoices();
    };

    const handleSyncCompleted = (_event: any, data: any) => {
      setLastSyncTime(data.timestamp);
    };
    
    window.addEventListener('invoices-updated', handleInvoicesUpdated);
    ipcRenderer.on('sync-completed', handleSyncCompleted);
    
    return () => {
      window.removeEventListener('invoices-updated', handleInvoicesUpdated);
      ipcRenderer.removeListener('sync-completed', handleSyncCompleted);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Syncing with backend...');
    try {
      const result = await ipcRenderer.invoke('sync-now');
      if (result.success) {
        setSyncMessage(result.result.message || 'Sync completed successfully!');
        setLastSyncTime(result.result.lastSyncTime || new Date().toISOString());
        setTimeout(() => setSyncMessage(''), 3000);
        window.dispatchEvent(new CustomEvent('invoices-updated'));
      } else {
        setSyncMessage('Sync failed: ' + (result.error || 'Unknown error'));
        setTimeout(() => setSyncMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error syncing:', error);
      setSyncMessage('Sync failed: ' + String(error));
      setTimeout(() => setSyncMessage(''), 5000);
      handleFrontendError(error, showToast, 'Sync with backend failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Add escape key handler for modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedPatient) {
        setSelectedPatient(null);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [selectedPatient]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredInvoices(invoices);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = invoices.filter(inv =>
        inv.patient.firstName.toLowerCase().includes(query) ||
        inv.patient.lastName.toLowerCase().includes(query) ||
        inv.patient.age.toString().includes(query) ||
        (inv.patient.phone && inv.patient.phone.includes(query)) ||
        inv.invoiceNumber.toLowerCase().includes(query)
      );
      setFilteredInvoices(filtered);
    }
  }, [searchQuery, invoices]);

  const loadInvoices = async () => {
    try {
      const result = await ipcRenderer.invoke('load-invoices');
      if (result.success) {
        setInvoices(result.invoices);
        setFilteredInvoices(result.invoices);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      handleFrontendError(error, showToast, 'Error loading invoices');
    }
  };

  const groupByPatient = () => {
    const grouped = new Map<string, Invoice[]>();
    filteredInvoices.forEach(inv => {
      const name = `${inv.patient.firstName} ${inv.patient.lastName}`;
      if (!grouped.has(name)) {
        grouped.set(name, []);
      }
      grouped.get(name)!.push(inv);
    });
    return Array.from(grouped.entries());
  };

  const patientGroups = groupByPatient();

  const handlePrintInvoice = (invoice: Invoice) => {
    try {
      const toISODate = (dateStr: string) => {
        try {
          return new Date(dateStr).toISOString().split('T')[0];
        } catch (e) {
          return dateStr;
        }
      };

      const invoiceData: InvoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        date: toISODate(invoice.date),
        patient: {
          firstName: invoice.patient.firstName,
          lastName: invoice.patient.lastName,
          age: invoice.patient.age,
          gender: invoice.patient.gender as any,
          phone: invoice.patient.phone || '',
          uhid: invoice.patient.uhid,
        },
        treatments: invoice.treatments.map(t => {
          const sessions = t.sessions || 1;
          const totalAmount = t.amount || 0;
          const ratePerSession = sessions > 0 ? totalAmount / sessions : 0;

          return {
            name: t.name,
            sessions: sessions,
            startDate: toISODate(t.startDate),
            endDate: toISODate(t.endDate),
            amount: ratePerSession,
            duration: '', 
          };
        }),
        diagnosis: invoice.diagnosis || '',
        notes: invoice.notes || '',
        paymentMethod: invoice.paymentMethod || 'Cash',
        total: (invoice.total || 0).toString(),
        timestamp: new Date().toISOString(),
      };

      const printContent = generateInvoiceHTML(invoiceData, layout);
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      } else {
        showToast('warning', 'Please allow popups to print invoices.');
      }
    } catch (error) {
      console.error('Error generating invoice print:', error);
      handleFrontendError(error, showToast, 'Failed to generate invoice for printing.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 px-6 pb-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <PageHeader 
          title="Patient Database"
          icon={
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <SearchIcon />
            </div>
          }
          actions={
            <div className="flex flex-col items-end">
              <button
                onClick={handleManualSync}
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
              {(syncMessage || lastSyncTime) && (
                <div className="mt-2 text-right">
                  {syncMessage && (
                    <p className={`text-xs font-medium ${
                      syncMessage.includes('failed') ? 'text-rose-500' : 'text-emerald-600'
                    }`}>
                      {syncMessage}
                    </p>
                  )}
                  {!syncMessage && lastSyncTime && (
                    <p className="text-[10px] text-slate-400 font-medium">
                      Last synced: {new Date(lastSyncTime).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          }
        />

        {/* Search Section */}
        <div className="relative max-w-2xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patients by name, phone, or UHID..."
            className="w-full pl-11 pr-4 py-4 bg-white border-0 rounded-2xl shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all text-slate-600 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {patientGroups.map(([name, patientInvoices], index) => {
            const latest = patientInvoices[0];
            const colorTheme = COLORS[index % COLORS.length];
            const totalPaid = patientInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
            
            return (
              <div
                key={name}
                onClick={() => setSelectedPatient(patientInvoices)}
                className={`group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border border-slate-100 hover:-translate-y-1`}
              >
                {/* Decorative Background Header */}
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

                {/* Avatar & Content */}
                <div className="px-5 pb-5">
                  <div className="relative -mt-10 mb-3">
                    <div className={`w-20 h-20 rounded-2xl ${colorTheme.bg} ${colorTheme.border} border-4 border-white shadow-md flex items-center justify-center text-2xl font-bold ${colorTheme.text}`}>
                      {name.charAt(0)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-bold text-slate-800 truncate pr-2">{name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                      latest.patient.gender?.toLowerCase() === 'male' ? 'bg-blue-50 text-blue-600' :
                      latest.patient.gender?.toLowerCase() === 'female' ? 'bg-pink-50 text-pink-600' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {latest.patient.gender || '?'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-4 text-sm text-slate-500">
                    {latest.patient.phone ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {latest.patient.phone}
                      </span>
                    ) : (
                      <span className="italic">No phone</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Age</p>
                        <p className="font-bold text-slate-700">{latest.patient.age} Yrs</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500">Latest Inv</p>
                        <p className="font-bold text-slate-700 truncate" title={latest.invoiceNumber}>{latest.invoiceNumber}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-slate-500">Total Paid</span>
                      <span className="font-bold text-emerald-600">₹{totalPaid}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {patientGroups.length === 0 && (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900">No patients found</h3>
            <p className="text-slate-500 mt-1">Try adjusting your search query</p>
          </div>
        )}
      </div>

      {/* Enlarge View Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedPatient(null)}
          />
          
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-white border-b border-slate-100 px-8 py-6 flex justify-between items-start shrink-0 z-10">
              <div className="flex items-center gap-5">
                <div className={`w-16 h-16 rounded-2xl ${COLORS[0].bg} flex items-center justify-center text-2xl font-bold ${COLORS[0].text}`}>
                  {selectedPatient[0].patient.firstName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {selectedPatient[0].patient.firstName} {selectedPatient[0].patient.lastName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-xs uppercase tracking-wide">
                        {selectedPatient[0].patient.gender}
                      </span>
                      <span className="font-medium">{selectedPatient[0].patient.age} Years</span>
                    </div>
                    
                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                    
                    <div className="text-sm text-slate-600 font-medium">
                      UHID: <span className="text-slate-800">{selectedPatient[0].patient.uhid}</span>
                    </div>

                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>

                    {selectedPatient[0].patient.phone && (
                      <div className="text-sm text-slate-600 font-medium flex items-center gap-1">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {selectedPatient[0].patient.phone}
                      </div>
                    )}

                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>

                    <div className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                      Total Paid: ₹{selectedPatient.reduce((sum, inv) => sum + (inv.total || 0), 0)}
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto p-8 bg-slate-50/50">
              <div className="space-y-6">
                {selectedPatient.map((invoice, idx) => (
                  <div key={invoice.invoiceNumber} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    {/* Invoice Header */}
                    <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm shadow-sm">
                          #{selectedPatient.length - idx}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-slate-500 font-medium">
                            {new Date(invoice.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {getSyncStatusBadge(invoice.syncStatus)}
                        <button
                          onClick={() => handlePrintInvoice(invoice)}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-600 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Print Invoice
                        </button>
                      </div>
                    </div>

                    <div className="p-6 grid lg:grid-cols-3 gap-8">
                      {/* Left Column: Diagnosis & Notes */}
                      <div className="lg:col-span-1 space-y-6">
                        {invoice.diagnosis && (
                          <div className="bg-amber-50/50 rounded-xl p-5 border border-amber-100">
                            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Diagnosis</h4>
                            <p className="text-slate-700 font-medium leading-relaxed">{invoice.diagnosis}</p>
                          </div>
                        )}
                        
                        {invoice.notes && (
                          <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</h4>
                            <p className="text-slate-600 text-sm leading-relaxed">{invoice.notes}</p>
                          </div>
                        )}

                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Payment Details</h4>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-slate-500">Method</span>
                            <span className="text-sm font-medium text-slate-700">{invoice.paymentMethod || 'Cash'}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                            <span className="text-sm font-bold text-slate-700">Total Paid</span>
                            <span className="text-lg font-bold text-emerald-600">₹{invoice.total}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Treatment Calendar */}
                      <div className="lg:col-span-2">
                        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          Treatment Schedule
                        </h4>
                        <TreatmentCalendar treatments={invoice.treatments} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseFind;
