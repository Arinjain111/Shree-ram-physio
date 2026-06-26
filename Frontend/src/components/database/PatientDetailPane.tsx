import { useState, useEffect, useRef } from 'react';
import { useUI } from '@/context/UIContext';
import { useLogger } from '@/utils/logger';
import type { DatabaseInvoice } from '@/types/database.types';
import { InvoiceHistoryCard } from './InvoiceHistoryCard';
import { TreatmentSessionPanel } from './TreatmentSessionPanel';
import { ipcRenderer } from '@/lib/ipc';

type TabKey = 'history' | 'sessions';

interface PatientDetailPaneProps {
    invoices: DatabaseInvoice[] | null;
    onPrintInvoice: (invoice: DatabaseInvoice) => void;
}

export const PatientDetailPane = ({ invoices, onPrintInvoice }: PatientDetailPaneProps) => {
  const { showToast, showModal } = useUI();
  const [activeTab, setActiveTab] = useState<TabKey>('history');
  const [modalVisibleCount, setModalVisibleCount] = useState(5);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteRef = useRef<HTMLDivElement>(null);
  const log = useLogger();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (deleteRef.current && !deleteRef.current.contains(e.target as Node)) {
        setShowDeleteOptions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  
  if (!invoices || invoices.length === 0) {
      return (
          <div className="bg-white/60 rounded-3xl border border-slate-200/60 h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-700 mb-2 tracking-tight">No Patient Selected</h3>
              <p className="text-slate-500 max-w-sm">Select a patient from the list on the left to view their complete details, medical history, and past invoices.</p>
          </div>
      );
  }

  const sortedInvoices = [...invoices].sort((a, b) => {
    const numA = parseInt(a.invoiceNumber.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.invoiceNumber.replace(/\D/g, '')) || 0;
    return numB - numA;
  });

  const latest = sortedInvoices[0];
  const patient = latest.patient;
  
  const totalPaid = sortedInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const hasCloudData = !!patient.cloudId;

  const handleDelete = (target: 'local' | 'cloud' | 'both') => {
      showModal({
          type: 'danger',
          title: `Delete Patient (${target === 'both' ? 'Everywhere' : target})`,
          message: `Are you sure you want to delete this patient ${target === 'both' ? 'everywhere' : 'from ' + target}?\nThis cannot be undone.`,
          confirmText: 'Yes, Delete',
          cancelText: 'Cancel',
          onConfirm: async () => {
              setIsDeleting(true);
              try {
                  const result = await ipcRenderer.invoke('delete-patient', patient.id, target);
                  if (result.success) {
                      showToast('success', `Patient deleted successfully (${target})`);
                      window.dispatchEvent(new CustomEvent('invoices-updated'));
                  } else {
                      showModal({
                          title: 'Delete Failed',
                          message: result.error || 'Unknown error occurred',
                          type: 'danger',
                          confirmText: 'Close'
                      });
                  }
              } catch (error) {
                  showToast('error', 'Failed to invoke delete operation');
                  log.error('db', 'Failed to invoke patient delete', { error: error instanceof Error ? error.message : String(error) });
              } finally {
                  setIsDeleting(false);
                  setShowDeleteOptions(false);
              }
          }
      });
  };

  return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 flex flex-col h-full overflow-hidden">
        
        {/* Sleek Profile Header */}
        <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-8 shrink-0 relative">
          
          <div className="flex items-start justify-between">
            <div className="flex gap-6 items-center">
              {/* Large Circular Avatar */}
              <div className="w-16 h-16 rounded-full bg-indigo-50 border-2 border-white shadow-xs flex items-center justify-center text-2xl font-bold text-indigo-600 shrink-0">
                {patient.firstName.charAt(0)}
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">
                  {patient.firstName} {patient.lastName}
                </h2>
                
                {/* Clean Info Grid */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Gender:</span>
                    <span className="text-slate-800 capitalize">{patient.gender.toLowerCase()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Age:</span>
                    <span className="text-slate-800">{patient.age} yrs</span>
                  </div>
                  {patient.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Phone:</span>
                      <span className="text-slate-800">{patient.phone}</span>
                    </div>
                  )}
                  {patient.uhid && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">UHID:</span>
                      <span className="text-slate-800 font-mono">{patient.uhid}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right side stats & actions */}
            <div className="flex flex-col items-end gap-4">
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Lifetime Value</div>
                        <div className="text-xl font-bold text-emerald-600">₹{totalPaid.toLocaleString()}</div>
                    </div>
                </div>

                {/* Delete Dropdown */}
                <div className="relative" ref={deleteRef}>
                    <button
                        onClick={() => setShowDeleteOptions(!showDeleteOptions)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors border border-slate-200 hover:border-rose-200 flex items-center gap-1.5"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete Patient
                    </button>
                    {showDeleteOptions && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-1">
                            <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Delete from:</div>
                            <button disabled={isDeleting} onClick={() => handleDelete('local')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors flex items-center gap-2"><span>💻 Local Only</span></button>
                            <button disabled={isDeleting || !hasCloudData} onClick={() => handleDelete('cloud')} className={`text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${!hasCloudData ? 'text-slate-400 opacity-50 cursor-not-allowed bg-slate-50' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'}`}><span>☁️ Cloud Only</span></button>
                            <div className="h-px bg-slate-100 my-1"></div>
                            <button disabled={isDeleting || !hasCloudData} onClick={() => handleDelete('both')} className={`text-left px-3 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${!hasCloudData ? 'text-rose-300 opacity-50 cursor-not-allowed bg-slate-50' : 'text-rose-600 hover:bg-rose-50'}`}><span>🗑️ Everywhere</span></button>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="bg-white border-b border-slate-100 px-8 shrink-0">
          <div className="flex gap-1 max-w-4xl mx-auto">
            {([
              { key: 'history' as TabKey, label: 'Invoice History' },
              { key: 'sessions' as TabKey, label: 'Sessions' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-8 bg-slate-50/30 flex-1 custom-scrollbar">
          <div className="space-y-6 max-w-4xl mx-auto">
            {activeTab === 'history' && (
              <>
                {sortedInvoices.slice(0, modalVisibleCount).map((invoice, idx) => (
                  <InvoiceHistoryCard
                    key={invoice.invoiceNumber}
                    invoice={invoice}
                    index={idx}
                    totalCount={sortedInvoices.length}
                    onPrint={onPrintInvoice}
                  />
                ))}

                {modalVisibleCount < sortedInvoices.length && (
                  <div className="flex justify-center pt-4 pb-2">
                    <button
                      onClick={() => setModalVisibleCount(prev => prev + 5)}
                      className="px-6 py-2.5 bg-white text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 font-semibold shadow-xs transition-all active:scale-95"
                    >
                      Load More History (Showing {modalVisibleCount} of {invoices.length})
                    </button>
                  </div>
                )}
              </>
            )}

            {activeTab === 'sessions' && patient && (
              <TreatmentSessionPanel
                patientId={patient.id!}
                patientName={`${patient.firstName} ${patient.lastName}`}
              />
            )}
          </div>
        </div>
      </div>
  );
};
