import React, { useMemo } from 'react';
import { generateInvoiceHTML } from '@/utils/invoiceGenerator';
import type { InvoiceData } from '@/schemas/validation.schema.ts';
import type { PreviewPanelProps } from '@/types/component.types';
import { 
  samplePatient, 
  sampleTreatments, 
  sampleInvoiceDate, 
  sampleNotes, 
  calculateSampleTotal,
  sampleInvoiceNumber,
  sampleDiagnosis,
  samplePaymentMode
} from '@/data/sampleInvoiceData';

const PreviewPanel: React.FC<PreviewPanelProps> = ({ formData }) => {
  const previewHTML = useMemo(() => {
    const sampleInvoiceData: InvoiceData = {
      invoiceNumber: sampleInvoiceNumber,
      date: sampleInvoiceDate,
      patient: samplePatient,
      treatments: sampleTreatments,
      notes: sampleNotes,
      paymentMethod: samplePaymentMode,
      total: calculateSampleTotal(),
      timestamp: new Date().toISOString(),
      diagnosis: sampleDiagnosis,
    };
    // Use the actual invoice generator utility to create the preview
    return generateInvoiceHTML(
      sampleInvoiceData,
      formData, // The dynamic layout config from the customizer
    );
  }, [formData]);

  return (
    <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
      <div className="mb-4 flex justify-between items-center">
        <div className='flex flex-row gap-2 items-center'>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            Live Preview
          </h3>
          <span className='text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200'>Auto-updates</span>
        </div>
      </div>
      <div className="bg-slate-500/10 rounded-xl overflow-hidden flex justify-center p-8 border border-slate-200/50 shadow-inner">
        <div className="shadow-2xl rounded-sm bg-white transition-all duration-300 ease-in-out" style={{ zoom: '0.65', minWidth: '800px', transformOrigin: 'top center' }}>
          <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;
