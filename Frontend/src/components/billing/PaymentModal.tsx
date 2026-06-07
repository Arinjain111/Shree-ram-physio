import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ipcRenderer } from '@/lib/ipc';
import { useLogger } from '@/utils/logger';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface PaymentModalProps {
  isOpen: boolean;
  invoiceId: number;
  patientName: string;
  invoiceNumber: string;
  total: number;
  amountPaid: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({
  isOpen, invoiceId, patientName, invoiceNumber, total, amountPaid, onClose, onSuccess
}: PaymentModalProps) {
  const [amount, setAmount] = useState(total - amountPaid);
  const [method, setMethod] = useState('Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const log = useLogger();

  if (!isOpen) return null;

  const remaining = total - amountPaid;

  const handleSubmit = async () => {
    if (amount <= 0) return;
    setIsSubmitting(true);
    try {
      const result = await ipcRenderer.invoke('record-payment', invoiceId, amount, method);
      if (result.success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      log.error('payment', 'Payment failed', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="relative z-50" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-900/50 transition-opacity" onClick={onClose} />
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-slate-100">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-semibold text-slate-900">Record Payment</h3>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Patient</span>
                  <span className="font-medium text-slate-800">{patientName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Invoice</span>
                  <span className="font-medium text-slate-800">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total</span>
                  <span className="font-medium text-slate-800">₹{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Paid</span>
                  <span className="font-medium text-emerald-600">₹{amountPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Remaining</span>
                  <span className="font-medium text-rose-600">₹{remaining.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Amount</label>
                <input
                  type="number"
                  min="0"
                  max={remaining}
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(Math.min(Number(e.target.value), remaining))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Method</label>
                <CustomSelect
                  value={method}
                  onChange={(val) => setMethod(String(val))}
                  themeColor="teal"
                  options={[
                    { value: 'Cash', label: 'Cash' },
                    { value: 'Card', label: 'Card' },
                    { value: 'UPI', label: 'UPI' },
                    { value: 'Online', label: 'Online' },
                    { value: 'Cheque', label: 'Cheque' },
                  ]}
                />
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-3 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={amount <= 0 || isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
