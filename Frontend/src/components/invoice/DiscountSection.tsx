import { useState, useEffect } from 'react';
import { calculateDiscountAmount } from '@/utils/calculationUtils';

type DiscountType = 'amount' | 'percentage';

interface Props {
  discount: number;
  discountType: DiscountType;
  onChange: (value: number, type: DiscountType) => void;
  subTotal: number;
}

export default function DiscountSection({ discount, discountType, onChange, subTotal }: Props) {
  const [enabled, setEnabled] = useState(discount > 0 || discountType === 'percentage');

  useEffect(() => {
    if (discount > 0 || discountType === 'percentage') setEnabled(true);
  }, [discount, discountType]);

  const handleValueChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, '');
    const num = cleaned === '' ? 0 : Number(cleaned);
    if (Number.isNaN(num)) return;
    if (discountType === 'percentage' && num > 100) return;
    onChange(num, discountType);
  };

  const handleTypeChange = (next: DiscountType) => {
    onChange(discount, next);
  };

  const handleClear = () => {
    onChange(0, 'amount');
    setEnabled(false);
  };

  const discountAmount = calculateDiscountAmount(subTotal, discount, discountType);
  const finalTotal = Math.max(0, subTotal - discountAmount);

  if (!enabled) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setEnabled(true)}
          className="text-sm font-medium text-slate-600 hover:text-slate-800 underline"
        >
          + Add Discount (optional)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">
          Discount <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          Remove
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 text-sm">
            {discountType === 'amount' ? '₹' : '%'}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={discount === 0 ? '' : String(discount)}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder={discountType === 'amount' ? '0' : '0'}
            className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => handleTypeChange('amount')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              discountType === 'amount' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Amount
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('percentage')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              discountType === 'percentage' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Percentage
          </button>
        </div>
      </div>

      {discount > 0 && (
        <div className="text-xs text-slate-500 flex items-center gap-3 pl-1">
          <span>
            Discount applied: <span className="font-semibold text-rose-600">−₹{discountAmount.toFixed(2)}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            Final total: <span className="font-semibold text-slate-700">₹{finalTotal.toFixed(2)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
