import { useState, useEffect } from 'react';
import type { AdditionalInfoFormProps } from '@/types/component.types';
import { ValidDateStringSchema } from '@/schemas/validation.schema.ts';

const AdditionalInfoForm = ({
  invoiceDate,
  setInvoiceDate,
  notes,
  setNotes
}: AdditionalInfoFormProps) => {
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (invoiceDate) {
      const result = ValidDateStringSchema.safeParse(invoiceDate);
      if (!result.success) {
        setDateError(result.error.issues[0].message);
      } else {
        setDateError('');
      }
    } else {
      setDateError('');
    }
  }, [invoiceDate]);
  return (
    <section>
      <h3 className="text-xl font-semibold text-[#5F3794] mb-2">Additional Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            required
            value={invoiceDate}
            min="2000-01-01"
            max={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              dateError ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
          />
          {dateError && (
            <p className="mt-1 text-xs text-red-500 font-medium">{dateError}</p>
          )}
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes/Prescription <span className="text-gray-500">(Optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </section>
  );
};

export default AdditionalInfoForm;
