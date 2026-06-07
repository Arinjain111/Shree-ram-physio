import { useState, useEffect, useRef } from 'react';
import type { DatabaseInvoice } from '@/types/database.types';
import TreatmentCalendar, { COLORS } from './TreatmentCalendar';
import { useNavigate } from 'react-router-dom';
import { useUI } from '@/context/UIContext';
import { useLogger } from '@/utils/logger';
import { ipcRenderer } from '@/lib/ipc';

// Icons
const EditIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.414z" /></svg>;
const CopyIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 4h8m-8 4h5M7 21h10a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-2.414-2.414A2 2 0 0014.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
const PrintIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
const DeleteIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

const getSyncStatusBadge = (status?: string) => {
    if (!status) return null;
    const isSynced = status === 'SYNCED';
    const isConflict = status === 'CONFLICT';
    const colorClass = isSynced ? 'bg-emerald-500' : isConflict ? 'bg-rose-500' : 'bg-amber-500';
    return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-xs" title={status}>
            <span className={`w-2 h-2 rounded-full ${colorClass}`}></span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isSynced ? 'Synced' : isConflict ? 'Conflict' : 'Pending'}</span>
        </div>
    );
};

interface InvoiceHistoryCardProps {
    invoice: DatabaseInvoice;
    index: number;
    totalCount: number;
    onPrint: (invoice: DatabaseInvoice) => void;
}

export const InvoiceHistoryCard = ({ invoice, index, totalCount, onPrint }: InvoiceHistoryCardProps) => {
  const navigate = useNavigate();
  const { showModal, showToast } = useUI();
  const canEdit = invoice.syncStatus !== 'SYNCED';
  const hasCloudData = !!invoice.cloudId;
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const deleteRef = useRef<HTMLDivElement>(null);
  const log = useLogger();

  useEffect(() => {
    if (!showDeleteOptions) return;
    const handler = (e: MouseEvent) => {
      if (deleteRef.current && !deleteRef.current.contains(e.target as Node)) {
        setShowDeleteOptions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDeleteOptions]);

  const handleDelete = async (target: 'local' | 'cloud' | 'both') => {
    showModal({
      type: 'danger',
      title: `Delete Invoice (${target === 'both' ? 'Everywhere' : target})`,
      message: `Are you sure you want to delete this invoice ${target === 'both' ? 'everywhere' : 'from ' + target}?\nThis cannot be undone.`,
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const result = await ipcRenderer.invoke('delete-invoice', invoice.id, target);
          if (result.success) {
            showToast('success', `Invoice deleted successfully (${target})`);
            window.dispatchEvent(new CustomEvent('invoices-updated'));
          } else {
            showModal({
              title: 'Delete Failed',
              message: result.error || 'Unknown error occurred',
              type: 'danger',
              confirmText: 'Close'
            });
            if (result.errors?.length) {
              log.error('db', 'Invoice delete partial errors', { errors: result.errors });
            }
          }
        } catch (error) {
          showToast('error', 'Failed to invoke delete operation');
          log.error('db', 'Failed to invoke invoice delete', { error: error instanceof Error ? error.message : String(error) });
        } finally {
          setShowDeleteOptions(false);
        }
      }
    });
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
      {/* Invoice Header */}
      <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 text-sm shadow-xs">
            #{totalCount - index}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <p className="text-base font-bold text-slate-800 tracking-tight">{invoice.invoiceNumber}</p>
              {getSyncStatusBadge(invoice.syncStatus)}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
              <span>{new Date(invoice.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-600 border border-slate-200 shadow-xs uppercase tracking-wider text-[10px]">
                {invoice.paymentMethod || 'Cash'}
              </span>

              {invoice.TransactionId && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>TX: <span className="font-bold text-slate-700">{invoice.TransactionId}</span></span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Actions Row - Minimal Icons */}
        <div className="flex items-center gap-1">
          {canEdit ? (
            <button
              onClick={() => navigate('/invoice-generator', { state: { mode: 'edit', invoiceId: invoice.id } })}
              disabled={!invoice.id}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
              title={!invoice.id ? 'Missing invoice id' : 'Edit this invoice (not synced yet)'}
            >
              <EditIcon />
            </button>
          ) : (
            <button
              onClick={() => navigate('/invoice-generator', { state: { mode: 'duplicate', invoiceId: invoice.id } })}
              disabled={!invoice.id}
              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
              title={!invoice.id ? 'Missing invoice id' : 'Reissue: creates a new invoice based on this one'}
            >
              <CopyIcon />
            </button>
          )}

          <button
            onClick={() => onPrint(invoice)}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            title="Print Invoice"
          >
            <PrintIcon />
          </button>
          
          <div className="relative" ref={deleteRef}>
            <button
              onClick={() => setShowDeleteOptions(!showDeleteOptions)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete Invoice"
            >
              <DeleteIcon />
            </button>
            {showDeleteOptions && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Delete from:</div>
                <button 
                  onClick={() => handleDelete('local')} 
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors flex items-center justify-between group"
                >
                  <span>Local Database</span>
                  <span className="opacity-0 group-hover:opacity-100 text-rose-400">→</span>
                </button>
                <button 
                  onClick={() => handleDelete('cloud')} 
                  disabled={!hasCloudData}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between group ${!hasCloudData ? 'text-slate-400 opacity-50 cursor-not-allowed bg-slate-50' : 'text-slate-700 hover:bg-rose-50 hover:text-rose-600'}`}
                >
                  <span>Cloud Database</span>
                  {hasCloudData && <span className="opacity-0 group-hover:opacity-100 text-rose-400">→</span>}
                </button>
                <div className="h-px bg-slate-100 my-1"></div>
                <button 
                  onClick={() => handleDelete('both')} 
                  disabled={!hasCloudData}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-between group ${!hasCloudData ? 'text-rose-300 opacity-50 cursor-not-allowed bg-slate-50' : 'text-rose-600 hover:bg-rose-50'}`}
                >
                  <span>Everywhere</span>
                  {hasCloudData && <span className="opacity-0 group-hover:opacity-100">→</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 grid lg:grid-cols-5 gap-8">
        {/* Left Column: Diagnosis, Notes & Treatments */}
        <div className="lg:col-span-2 space-y-6">
          {invoice.diagnosis && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Diagnosis</h4>
              <p className="text-slate-700 text-sm font-medium leading-relaxed bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50">{invoice.diagnosis}</p>
            </div>
          )}
          
          {invoice.notes && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes</h4>
              <p className="text-slate-600 text-sm leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100">{invoice.notes}</p>
            </div>
          )}

          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Treatments</h4>
            <div className="flex flex-col gap-2">
              {invoice.treatments.map((t, idx) => {
                const color = COLORS[idx % COLORS.length];
                return (
                  <div key={idx} className="flex flex-col gap-0.5 px-4 py-3 rounded-2xl border border-slate-100 bg-white shadow-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                      <span className="text-sm font-bold text-slate-800">{t.name}</span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-400 pl-4">
                      {t.sessions} sessions &bull; {new Date(t.startDate).toLocaleDateString()} to {new Date(t.endDate).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Treatment Calendar */}
        <div className="lg:col-span-3">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Treatment Schedule</h4>
          <TreatmentCalendar treatments={invoice.treatments} />
        </div>
      </div>
    </div>
  );
};
