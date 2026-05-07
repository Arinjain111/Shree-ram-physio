import { useState } from 'react';
import type { DatabaseInvoice } from '@/types/database.types';
import TreatmentCalendar, { COLORS } from './TreatmentCalendar';
import { useNavigate } from 'react-router-dom';
import { useUI } from '@/context/UIContext';

const { ipcRenderer } = window.require('electron');

// Utils
const getSyncStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const statusConfig: any = {
      SYNCED: { color: 'bg-emerald-500', text: '✓ Synced', textColor: 'text-white' },
      PENDING: { color: 'bg-amber-500', text: '⏳ Pending', textColor: 'text-white' },
      CONFLICT: { color: 'bg-rose-500', text: '⚠ Conflict', textColor: 'text-white' }
    };
    
    const config = statusConfig[status] || 
                   { color: 'bg-slate-500', text: status, textColor: 'text-white' };
    
    return (
      <span className={`${config.color} ${config.textColor} px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm`}>
        {config.text}
      </span>
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
              console.error('Invoice Delete errors:', result.errors);
            }
          }
        } catch (error) {
          showToast('error', 'Failed to invoke delete operation');
          console.error(error);
        } finally {
          setShowDeleteOptions(false);
        }
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Invoice Header */}
      <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm shadow-sm">
            #{totalCount - index}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{invoice.invoiceNumber}</p>
            <p className="text-xs text-slate-500 font-medium">
              {new Date(invoice.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            {invoice.TransactionId && (
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                TX ID: <span className="font-bold text-slate-700">{invoice.TransactionId}</span>
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {getSyncStatusBadge(invoice.syncStatus)}

          {canEdit ? (
            <button
              onClick={() => navigate('/invoice-generator', { state: { mode: 'edit', invoiceId: invoice.id } })}
              disabled={!invoice.id}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-amber-300 hover:text-amber-700 text-slate-600 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title={!invoice.id ? 'Missing invoice id' : 'Edit this invoice (not synced yet)'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.414z" />
              </svg>
              Edit
            </button>
          ) : (
            <button
              onClick={() => navigate('/invoice-generator', { state: { mode: 'duplicate', invoiceId: invoice.id } })}
              disabled={!invoice.id}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-amber-300 hover:text-amber-700 text-slate-600 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title={!invoice.id ? 'Missing invoice id' : 'Reissue: creates a new invoice based on this one'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 4h8m-8 4h5M7 21h10a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-2.414-2.414A2 2 0 0014.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Reissue
            </button>
          )}

          <button
            onClick={() => onPrint(invoice)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-600 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Invoice
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowDeleteOptions(!showDeleteOptions)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
              title="Delete Invoice"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete
            </button>
            {showDeleteOptions && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-60 overflow-hidden">
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

          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Treatments</h4>
            {invoice.treatments.map((t, idx) => {
              const color = COLORS[idx % COLORS.length];
              return (
                <div key={idx} className={`flex flex-col gap-1 px-4 py-3 rounded-xl border ${color.bg} ${color.border}`}>
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
  );
};
