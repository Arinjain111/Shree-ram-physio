import React, { useMemo } from 'react';
import { useInvoiceLayout } from '@/hooks/useInvoiceLayout';
import { generateInvoiceHTML } from '@/utils/invoiceGenerator';
import type { InvoicePreviewProps } from '@/types/component.types';

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoiceData }) => {
  const { layout } = useInvoiceLayout();

  const invoiceHTML = useMemo(() => {
    return generateInvoiceHTML(invoiceData, layout);
  }, [invoiceData, layout]);

  return (
    <div className="bg-white overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      <div className="mb-2 flex justify-between items-center">
        <div className='flex flex-row gap-2 items-center'>
          <h3 className="text-xl font-semibold text-slate-800">Live Preview</h3>
          <h4 className='text-sm text-slate-600'>(Updates the page as you fill the form)</h4>
        </div>
      </div>
      <div className="bg-slate-50 rounded-lg overflow-hidden flex justify-center">
        <div style={{ zoom: '0.68', minWidth: '800px', transformOrigin: 'top center' }}>
          <div dangerouslySetInnerHTML={{ __html: invoiceHTML }} />
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;
