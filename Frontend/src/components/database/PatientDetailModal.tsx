import { useState } from 'react';
import { useUI } from '@/context/UIContext';
import type { DatabaseInvoice } from '@/types/database.types';
import { InvoiceHistoryCard } from './InvoiceHistoryCard';

const { ipcRenderer } = window.require('electron');

interface PatientDetailModalProps {
    invoices: DatabaseInvoice[] | null;
    onClose: () => void;
    onPrintInvoice: (invoice: DatabaseInvoice) => void;
}

export const PatientDetailModal = ({ invoices, onClose, onPrintInvoice }: PatientDetailModalProps) => {
  const { showToast, showModal } = useUI();
  const [modalVisibleCount, setModalVisibleCount] = useState(5);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  if (!invoices || invoices.length === 0) return null;

  const latest = invoices[0];
  const patient = latest.patient;
  
  // Calculate total paid across all invoices
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

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
                      onClose();
                  } else {
                      showModal({
                          title: 'Delete Failed',
                          message: result.error || 'Unknown error occurred',
                          type: 'danger',
                          confirmText: 'Close'
                      });
                      // Show partial errors if any
                      if (result.errors && result.errors.length > 0) {
                          console.error('Delete errors:', result.errors);
                      }
                  }
              } catch (error) {
                  showToast('error', 'Failed to invoke delete operation');
                  console.error(error);
              } finally {
                  setIsDeleting(false);
                  setShowDeleteOptions(false);
              }
          }
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/30 transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-white border-b border-slate-100 px-8 py-6 flex justify-between items-start shrink-0 z-10">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center text-2xl font-bold text-purple-700`}>
              {patient.firstName.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                {patient.firstName} {patient.lastName}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-xs uppercase tracking-wide">
                    {patient.gender}
                  </span>
                  <span className="font-medium">{patient.age} Years</span>
                </div>
                
                <div className="w-1 h-1 rounded-full bg-slate-300"></div>

                {!!patient.uhid && (
                  <>
                    <div className="text-sm text-slate-600 font-medium">
                      UHID: <span className="text-slate-800">{patient.uhid}</span>
                    </div>

                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                  </>
                )}

                {patient.phone && (
                  <div className="text-sm text-slate-600 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {patient.phone}
                  </div>
                )}

                <div className="w-1 h-1 rounded-full bg-slate-300"></div>

                <div className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  Total Paid: ₹{totalPaid}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Delete Dropdown */}
            <div className="relative">
                <button
                    onClick={() => setShowDeleteOptions(!showDeleteOptions)}
                    className="p-2 hover:bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg transition-colors flex items-center gap-2"
                    title="Delete Patient"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                {showDeleteOptions && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-1">
                        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Delete from:</div>
                        <button 
                            disabled={isDeleting}
                            onClick={() => handleDelete('local')} 
                            className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <span>💻 Local Only</span>
                        </button>
                        <button 
                            disabled={isDeleting}
                            onClick={() => handleDelete('cloud')} 
                            className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <span>☁️ Cloud Only</span>
                        </button>
                        <div className="h-px bg-slate-100 my-1"></div>
                        <button 
                            disabled={isDeleting}
                            onClick={() => handleDelete('both')} 
                            className="text-left px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <span>🗑️ Everywhere</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="w-px h-8 bg-slate-200 mx-1"></div>

            <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="overflow-y-auto p-8 bg-slate-50/50">
          <div className="space-y-6">
            {invoices.slice(0, modalVisibleCount).map((invoice, idx) => (
              <InvoiceHistoryCard
                key={invoice.invoiceNumber}
                invoice={invoice}
                index={idx}
                totalCount={invoices.length}
                onPrint={onPrintInvoice}
              />
            ))}

            {modalVisibleCount < invoices.length && (
              <div className="flex justify-center pt-4 pb-2">
                <button
                  onClick={() => setModalVisibleCount(prev => prev + 5)}
                  className="px-6 py-2 bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium shadow-sm transition-all"
                >
                  Load More History (Showing {modalVisibleCount} of {invoices.length})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
