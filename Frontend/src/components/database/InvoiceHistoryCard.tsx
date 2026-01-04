import type { DatabaseInvoice } from '@/types/database.types';
import TreatmentCalendar from './TreatmentCalendar';

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
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {getSyncStatusBadge(invoice.syncStatus)}
          <button
            onClick={() => onPrint(invoice)}
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
  );
};
