import { useUI } from '@/context/UIContext';

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

  return (
    <div className="w-full max-w-400 min-h-fit bg-slate-50/50 px-6  mx-auto">
      <PageHeader 
        title="Invoice Generator"
        icon={<div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><FileTextIcon /></div>}
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
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors flex items-center gap-2"
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
          <div className="lg:col-span-3 bg-white rounded-lg shadow-md p-6">
            <form className="space-y-6">
              
              {/* Step 1: Patient Search */}
              <section className="mb-6 border-2 border-purple-400 rounded-2xl bg-linear-to-r from-purple-50 via-purple-100 to-purple-50 px-4 py-4 shadow-sm">
                <h3 className="text-sm font-semibold text-[#4C2C82] mb-1 flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-[#4C2C82] shadow-sm">1</span>
                  Find Existing Patient
                </h3>
                <p className="text-xs text-gray-700 mb-3">
                  Start by searching with contact number or invoice number to instantly fetch an existing patient's details.
                </p>
                <PatientSearch
                  invoices={existingInvoices}
                  onPatientSelect={setPatient}
                />
              </section>

              {/* Step 2: Invoice Number & Payment */ }
              <section>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#5F3794]">Invoice Number <span className="text-red-500">*</span></h3>
                    <p className="mb-2 text-xs text-gray-500">
                      Auto-suggested sequential number (editable)
                      {isSyncing && <span className="ml-2 text-blue-600 font-semibold animate-pulse">⟳ Syncing...</span>}
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
                        className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg bg-white text-gray-700 font-semibold"
                        placeholder={isSyncing ? "Syncing..." : "401"}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <button
                          type="button"
                          onClick={refreshInvoiceNumber}
                          disabled={isRefreshingInvoiceNumber}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Refresh invoice number"
                        >
                          {isRefreshingInvoiceNumber ? (
                            <svg className="animate-spin w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24">
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
                    <h3 className="text-lg font-semibold text-[#5F3794]">Payment Method</h3>
                    <p className="mb-2 text-xs text-gray-500">
                      Select the method of payment
                    </p>
                    <select
                      value={paymentMethod}
                      onChange={(e) => {
                        const newMethod = e.target.value;
                        setPaymentMethod(newMethod);
                        if (TransactionId && newMethod !== 'UPI' && newMethod !== 'Card') {
                          setTransactionId('');
                          showToast('info', `Payment method changed to ${newMethod}. Transaction ID cleared.`);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-semibold"
                    >
                      <option>Cash</option>
                      <option>Card</option>
                      <option>UPI</option>
                      <option>Online</option>
                      <option>Cheque</option>
                    </select>
                  </div>
                </div>
              </section>

              <PatientForm 
                patient={patient} 
                setPatient={setPatient} 
                TransactionId={TransactionId}
                setTransactionId={setTransactionId}
                paymentMethod={paymentMethod}
              />

              <section>
                <h3 className="text-lg font-semibold text-[#5F3794] mb-2">Diagnosis / Complaint</h3>
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

              <section>
                <h3 className="text-lg font-semibold text-[#5F3794] mb-2">Discount</h3>
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <DiscountSection
                    discount={discount}
                    discountType={discountType}
                    onChange={(value, type) => {
                      setDiscount(value);
                      setDiscountType(type);
                    }}
                    subTotal={Number(
                      treatments.reduce((sum, t) => sum + (Number(t.sessions || 0) * Number(t.amount || 0)), 0).toFixed(2)
                    )}
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
