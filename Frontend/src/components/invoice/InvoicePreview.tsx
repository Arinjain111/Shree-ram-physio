import React, { useMemo } from 'react';
import { useLayoutContext } from '@/context/LayoutContext';
import { generateInvoiceHTML } from '@/utils/invoiceGenerator';
import type { InvoicePreviewProps } from '@/types/component.types';

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoiceData }) => {
  const { layout } = useLayoutContext();

  const invoiceHTML = useMemo(() => {
    return generateInvoiceHTML(invoiceData, layout);
  }, [invoiceData, layout]);

  // Determine dynamic zoom so that all paper sizes appear roughly the same width on screen
  const getZoomLevel = () => {
    const paperSize = layout.paperSize || 'A4';
    const paperOrientation = layout.paperOrientation || 'portrait';
    
    // Base target width on screen is ~540px (which is A4 portrait 794px * 0.68)
    const TARGET_WIDTH = 540;
    let currentWidth = 794; // Default A4 portrait
    
    if (paperSize === 'A4' && paperOrientation === 'landscape') currentWidth = 1123;
    if (paperSize === 'A5' && paperOrientation === 'portrait') currentWidth = 559;
    if (paperSize === 'A5' && paperOrientation === 'landscape') currentWidth = 794;
    
    return (TARGET_WIDTH / currentWidth).toFixed(2);
  };

  return (
    <div className="bg-white overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      <div className="mb-2 flex justify-between items-center">
        <div className='flex flex-row gap-3 items-center'>
          <h3 className="text-xl font-semibold text-slate-800">Live Preview</h3>
          <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full border border-purple-200 shadow-sm uppercase tracking-wider">
            {layout.paperSize || 'A4'} {layout.paperOrientation === 'landscape' ? 'Landscape' : 'Portrait'}
          </span>
          <h4 className='text-sm text-slate-600 hidden md:block'>(Updates as you type)</h4>
        </div>
      </div>
      <div className="bg-slate-50 rounded-lg overflow-hidden flex justify-center py-4">
        <div style={{ zoom: getZoomLevel(), minWidth: '100%', display: 'flex', justifyContent: 'center', transformOrigin: 'top center' }}>
          <div dangerouslySetInnerHTML={{ __html: invoiceHTML }} />
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;
