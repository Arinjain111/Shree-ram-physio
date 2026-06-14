import { useUI } from '@/context/UIContext';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useState, useEffect, useRef } from 'react';

/* Components */
import PageHeader from '@/components/layout/PageHeader';
import PatientForm from '@/components/invoice/PatientForm';
import PatientSearch from '@/components/invoice/PatientSearch';
import TreatmentForm from '@/components/invoice/TreatmentForm';
import AdditionalInfoForm from '@/components/invoice/AdditionalInfoForm';
import DiagnosisAutocomplete from '@/components/invoice/DiagnosisAutocomplete';
import DiscountSection from '@/components/invoice/DiscountSection';
import InvoicePreview from '@/components/invoice/InvoicePreview';
import { FileTextIcon } from '@/components/icons';

import { useInvoiceForm } from '@/hooks/useInvoiceForm';



const InvoiceGenerator = () => {
  const { showToast } = useUI();
  const {
    patient, setPatient,
    treatments, setTreatments,
    diagnosis, setDiagnosis,
    discount, setDiscount,
    discountType, setDiscountType,
    invoiceDate, setInvoiceDate,
    paymentMethod, setPaymentMethod,
    amountPaid, setAmountPaid,
    TransactionId, setTransactionId,
    notes, setNotes,
    invoiceNumber, setInvoiceNumber,
    setInvoiceNumberEdited,
    isRefreshingInvoiceNumber,
    existingInvoices,
    previewInvoiceData,
    isSyncing,
    refreshInvoiceNumber,
    displayInvoiceNumber,
    toPaddedInvoiceNumber,
    handlePreview,
    handleSaveAndPDF,
    getCurrentInvoiceData
  } = useInvoiceForm();

  const [isPartialMode, setIsPartialMode] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('unpaid');
  const userHasSelectedStatus = useRef(false);

  const subTotal = Number(
    treatments.reduce((sum: any, t: any) => sum + (Number(t.sessions || 0) * Number(t.amount || 0)), 0).toFixed(2)
  );
  const totalAmount = discountType === 'percentage'
    ? subTotal - (subTotal * (discount || 0)) / 100
    : subTotal - (discount || 0);

  useEffect(() => {
    if (userHasSelectedStatus.current) return;
    if (amountPaid >= totalAmount && totalAmount > 0) {
      setPaymentStatus('paid');
    } else if (amountPaid > 0) {
      setPaymentStatus('partial');
    } else {
      setPaymentStatus('unpaid');
    }
  }, [amountPaid, totalAmount]);

  // Clear partial mode if fully paid
  if (isPartialMode && amountPaid >= totalAmount && totalAmount > 0) {
    setIsPartialMode(false);
    setPaymentStatus('paid');
  }

  return (
    <div className="w-full max-w-full min-h-screen bg-slate-50/50 px-4 sm:px-6 mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader 
        breadcrumb="Billing"
        title="Invoice Generator"
        icon={<div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><FileTextIcon /></div>}
        actions={
          <>
            <button 
              onClick={handlePreview} 
              className="px-5 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium shadow-sm transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Preview PDF
            </button>
            <button 
              onClick={handleSaveAndPDF} 
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm transition-all transform active:scale-95 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save & Print
            </button>
          </>
        }
      />

      <div className="max-w-full mx-auto pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* LEFT COLUMN - Form */}
          <div className="lg:col-span-3 space-y-6">
            <form className="space-y-6">
              
              {/* Step 1: Patient Search */}
              <section className="bg-linear-to-br from-purple-50 via-white to-purple-50/50 border-2 border-purple-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 p-6 relative">
                {/* Decorative background element */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none z-0">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-purple-100/50 rounded-bl-full -mr-16 -mt-16"></div>
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">Find Existing Patient</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    Start by searching with contact number or invoice number to instantly fetch an existing patient's details.
                  </p>
                <PatientSearch
                  invoices={existingInvoices}
                  onPatientSelect={setPatient}
                />
                </div>
              </section>

              {/* Step 2: Invoice Number & Payment */ }
              <section className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <FileTextIcon />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Invoice Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number <span className="text-red-500">*</span></label>
                    <p className="mb-2 text-xs text-slate-500">
                      Auto-suggested sequential number
                      {isSyncing && <span className="ml-2 text-indigo-600 font-semibold animate-pulse">⟳ Syncing...</span>}
                    </p>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        maxLength={4}
                        value={displayInvoiceNumber(invoiceNumber)}
                        onChange={(e) => {
                          setInvoiceNumberEdited(true);
                          setInvoiceNumber(toPaddedInvoiceNumber(e.target.value));
                        }}
                        className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-xl bg-slate-50/50 text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                        placeholder={isSyncing ? "Syncing..." : "401"}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <button
                          type="button"
                          onClick={refreshInvoiceNumber}
                          disabled={isRefreshingInvoiceNumber}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Refresh invoice number"
                          aria-label={isRefreshingInvoiceNumber ? 'Refreshing invoice number' : 'Refresh invoice number'}
                        >
                          {isRefreshingInvoiceNumber ? (
                            <svg className="animate-spin w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 14a8 8 0 00-14.828-3M4 10a8 8 0 0014.828 3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                    <p className="mb-2 text-xs text-slate-500">
                      Select the method of payment
                    </p>
                    <CustomSelect
                      value={paymentMethod}
                      onChange={(newMethod) => {
                        const methodStr = String(newMethod);
                        setPaymentMethod(methodStr);
                        if (TransactionId && methodStr !== 'UPI' && methodStr !== 'Card') {
                          setTransactionId('');
                          showToast('info', `Payment method changed to ${methodStr}. Transaction ID cleared.`);
                        }
                      }}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 pt-5 border-t border-slate-100">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
                    <p className="mb-2 text-xs text-slate-500">
                      Mark as Paid, Unpaid, or Partial
                    </p>
                    <CustomSelect
                      value={paymentStatus}
                      onChange={(val) => {
                        userHasSelectedStatus.current = true;
                        const status = String(val) as 'paid' | 'unpaid' | 'partial';
                        setPaymentStatus(status);
                        if (status === 'paid') {
                          setIsPartialMode(false);
                          setAmountPaid(totalAmount);
                        } else if (status === 'unpaid') {
                          setIsPartialMode(false);
                          setAmountPaid(0);
                        } else if (status === 'partial') {
                          setIsPartialMode(true);
                          if (amountPaid >= totalAmount) {
                            setAmountPaid(0);
                          }
                        }
                      }}
                      options={[
                        { value: 'unpaid', label: 'Unpaid' },
                        { value: 'paid', label: 'Paid' },
                        { value: 'partial', label: 'Partial Paid' },
                      ]}
                    />
                  </div>
                  {paymentStatus === 'partial' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount Paid (₹)</label>
                      <p className="mb-2 text-xs text-slate-500">
                        Enter the exact amount received
                      </p>
                      <input
                        type="number"
                        min="0"
                        max={totalAmount}
                        step="0.01"
                        value={amountPaid || ''}
                        onChange={e => setAmountPaid(Number(e.target.value))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                  )}
                </div>
              </section>

              <PatientForm 
                patient={patient} 
                setPatient={setPatient} 
                TransactionId={TransactionId}
                setTransactionId={setTransactionId}
                paymentMethod={paymentMethod}
              />

              <section className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 p-6">
                <div className="flex items-center gap-2 mb-4">
                   <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                   </div>
                   <h3 className="text-lg font-semibold text-slate-800">Diagnosis / Complaint</h3>
                </div>
                <div>
                  <label htmlFor="diagnosis" className="block text-sm font-medium text-slate-700 mb-1">
                    Provisional Diagnosis <span className="text-red-500">*</span>
                  </label>
                  <DiagnosisAutocomplete
                    value={diagnosis}
                    onChange={setDiagnosis}
                  />
                </div>
              </section>

              <TreatmentForm
                treatments={treatments}
                updateTreatment={(index, field, value) => {
                    setTreatments((prev: any) => {
                        const newTreatments = [...prev];
                        newTreatments[index] = { ...newTreatments[index], [field]: value };
                        return newTreatments;
                    });
                }}
                removeTreatmentItem={(index) => setTreatments((t: any) => t.filter((_: any, i: any) => i !== index))}
                addTreatmentItem={() => setTreatments((prev: any) => [...prev, { name: '', duration: '', startDate: '', endDate: '', sessions: 0, amount: 0 }])}
              />

              <section className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 p-6">
                <div className="flex items-center gap-2 mb-4">
                   <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                   </div>
                   <h3 className="text-lg font-semibold text-slate-800">Discount</h3>
                </div>
                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5">
                  <DiscountSection
                    discount={discount}
                    discountType={discountType}
                    onChange={(value, type) => {
                      setDiscount(value);
                      setDiscountType(type);
                    }}
                    subTotal={subTotal}
                  />
                </div>
              </section>

              <AdditionalInfoForm
                invoiceDate={invoiceDate}
                setInvoiceDate={setInvoiceDate}
                notes={notes}
                setNotes={setNotes}
              />
            </form>
          </div>

          {/* RIGHT COLUMN - Preview */}
          <div className="lg:col-span-2 lg:sticky lg:top-22 lg:self-start bg-white rounded-lg shadow-md p-4">
            <InvoicePreview
              invoiceData={previewInvoiceData || getCurrentInvoiceData()}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceGenerator;
