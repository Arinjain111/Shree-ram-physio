import { useState, useEffect } from 'react';
import { useUI } from '@/context/UIContext';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useInvoicePrinter } from '@/hooks/useInvoicePrinter';

/* Components */
import PageHeader from '@/components/layout/PageHeader';
import PatientForm from '@/components/invoice/PatientForm';
import PatientSearch from '@/components/invoice/PatientSearch';
import TreatmentForm from '@/components/invoice/TreatmentForm';
import AdditionalInfoForm from '@/components/invoice/AdditionalInfoForm';
import InvoicePreview from '@/components/invoice/InvoicePreview';
import { FileTextIcon } from '@/components/icons';

/* Utilities & Data */
import { samplePatient, sampleDiagnosis } from '@/data/sampleInvoiceData';
import { InvoiceDataSchema, validateForm, type PatientForm as PatientInfo, type TreatmentForm as TreatmentItem, type InvoiceData } from '@/schemas/validation.schema.ts';
import { generateNextInvoiceNumber } from '@/utils/invoiceUtils';
import { calculateTotal } from '@/utils/calculationUtils';

const { ipcRenderer } = window.require('electron');

const InvoiceGenerator = () => {
  const { showToast, showModal } = useUI();
  const { isSyncing, syncNow } = useSyncManager(); // Use central sync state
  const { handleError } = useErrorHandler();
  const { printInvoice } = useInvoicePrinter();

  // Form State
  const [patient, setPatient] = useState<PatientInfo>(samplePatient);
  const [treatments, setTreatments] = useState<TreatmentItem[]>(() => [
    { name: '', duration: '', startDate: '', endDate: '', sessions: 0, amount: 0 }
  ]);
  const [diagnosis, setDiagnosis] = useState(sampleDiagnosis);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceNumberEdited, setInvoiceNumberEdited] = useState(false);
  const [isRefreshingInvoiceNumber, setIsRefreshingInvoiceNumber] = useState(false);
  
  // Data State
  const [existingInvoices, setExistingInvoices] = useState<InvoiceData[]>([]);
  const [previewInvoiceData, setPreviewInvoiceData] = useState<InvoiceData | null>(null);

  // Helper to fetch invoice number (Logic refactored to be cleaner)
  const fetchInvoiceNumber = async (force = false) => {
    if (!force && invoiceNumberEdited) {
      return;
    }

    try {
      // Pass patient data (local and cloud IDs) to get per-patient invoice number
      const result = await ipcRenderer.invoke('get-next-invoice-number', {
        id: patient?.id,
        cloudId: patient?.cloudId
      });
      if (result.success && result.invoiceNumber) {
        setInvoiceNumber(result.invoiceNumber);
        setInvoiceNumberEdited(false);
        console.log(`📋 Next invoice number for patient ${patient?.firstName}: ${result.invoiceNumber} (source: ${result.source})`);
      } else {
        // Fallback
        setInvoiceNumber(generateNextInvoiceNumber(existingInvoices));
        setInvoiceNumberEdited(false);
      }
    } catch (error) {
       console.error('Failed to fetch invoice number', error);
       setInvoiceNumber(generateNextInvoiceNumber(existingInvoices));
       setInvoiceNumberEdited(false);
    }
  };

  const refreshInvoiceNumber = async () => {
    setIsRefreshingInvoiceNumber(true);
    try {
      const result = await ipcRenderer.invoke('get-next-invoice-number', {
        id: patient?.id,
        cloudId: patient?.cloudId
      });

      if (result?.success && result?.invoiceNumber) {
        setInvoiceNumber(result.invoiceNumber);
        setInvoiceNumberEdited(false);

        if (result.backendErrorStatus === 429) {
          showToast('error', result.backendErrorMessage || 'Too many requests. Using local invoice number.');
        } else if (result.backendErrorStatus) {
          // Backend was attempted but failed (e.g. 400/500). Still show the user why.
          showToast('error', result.backendErrorMessage || 'Backend request failed. Using local invoice number.');
        } else {
          const suffix = result.source ? ` (${result.source})` : '';
          showToast('success', `Invoice number refreshed${suffix}`);
        }
      } else {
        // Fall back to local calculation if IPC failed
        const fallback = generateNextInvoiceNumber(existingInvoices);
        setInvoiceNumber(fallback);
        setInvoiceNumberEdited(false);
        showToast('error', result?.error || 'Failed to refresh invoice number');
      }
    } catch (error) {
      handleError(error, 'Failed to refresh invoice number');
    } finally {
      setIsRefreshingInvoiceNumber(false);
    }
  };

  // Initialization Effect
  useEffect(() => {
    const initialize = async () => {
      try {
        // 1. Load Invoices
        const result = await ipcRenderer.invoke('load-invoices');
        const loadedInvoices = result?.invoices || [];
        setExistingInvoices(loadedInvoices);

        // 2. Fetch Initial Number
        await fetchInvoiceNumber(true);

        // 3. Trigger Sync (Background)
        // We use the central syncNow to ensure global state is updated
        // But we don't await blocking UI unless necessary. 
        // Actually, syncNow returns success/fail.
        await syncNow();

      } catch (error) {
        handleError(error, 'Error initializing invoice generator');
      }
    };

    initialize();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh invoice number when patient changes (no loop: depends only on patient IDs)
  useEffect(() => {
    // If patient changes, any previous manual edit should not block fetching
    setInvoiceNumberEdited(false);
    fetchInvoiceNumber(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id, patient?.cloudId]);

  // Sync Completion Listener (Handled by useSyncManager globally, but we might want to refresh invoices here)
  useEffect(() => {
      const handleInvoicesUpdated = async () => {
        try {
            const result = await ipcRenderer.invoke('load-invoices');
            if (result?.invoices) {
                setExistingInvoices(result.invoices);
                fetchInvoiceNumber(true); // Update number as well
            }
        } catch (e) { console.error(e); }
      };

      window.addEventListener('invoices-updated', handleInvoicesUpdated);
      return () => window.removeEventListener('invoices-updated', handleInvoicesUpdated);
  }, []);

  // Debounce Preview
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewInvoiceData(getCurrentInvoiceData());
    }, 500);
    return () => clearTimeout(timer);
  }, [patient, treatments, diagnosis, invoiceDate, paymentMethod, notes, invoiceNumber]);

  
  // Helpers
  const displayInvoiceNumber = (value: string) => (value || '').replace(/^0+/, '');

  const toPaddedInvoiceNumber = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    if (!digitsOnly) return '';
    return digitsOnly.padStart(4, '0');
  };

  const getCurrentInvoiceData = (): InvoiceData => ({
    invoiceNumber,
    date: invoiceDate,
    patient: { ...patient },
    treatments,
    notes,
    paymentMethod,
    total: calculateTotal(treatments),
    timestamp: new Date().toISOString(),
    diagnosis,
  });

  const validateInvoice = (data: InvoiceData) => {
    const validation = validateForm(InvoiceDataSchema, data);
    if (!validation.valid) {
      const errorMessages = Object.entries(validation.fieldErrors)
        .map(([field, error]) => `${field}: ${error}`)
        .join('\n');
      showModal({
        title: 'Validation Failed',
        message: `Please fix the following errors:\n\n${errorMessages}`,
        type: 'danger',
        confirmText: 'OK',
      });
      return null;
    }
    return validation.data;
  };

  const handlePrint = async () => {
    const data = getCurrentInvoiceData();
    const validatedData = validateInvoice(data);
    if (!validatedData) return;

    try {
        const saveResult = await ipcRenderer.invoke('save-invoice', validatedData);
        if (!saveResult.success) throw saveResult;

        showToast('success', `Invoice ${data.invoiceNumber} saved!`);

        // Push to cloud right away; background sync remains as fallback
        await ipcRenderer.invoke('sync-now').catch(() => {
          /* non-blocking; still proceed to print */
        });
        
        // Update local state
        setExistingInvoices(prev => [...prev, data]);
        
        // Prepare next invoice
        await fetchInvoiceNumber(true);

        // Print
        const result = await printInvoice(data);
        if (result) {
            // Reset form only if print initiated successfully
            resetForm();
        }

    } catch (error) {
        handleError(error, 'Error saving/printing invoice');
    }
  };

  const handleSaveAndPDF = async () => {
      const data = getCurrentInvoiceData();
      const validatedData = validateInvoice(data);
      if (!validatedData) return;

      try {
          const saveResult = await ipcRenderer.invoke('save-invoice', validatedData);
          if (!saveResult.success) throw saveResult;
          showToast('success', `Invoice ${data.invoiceNumber} saved!`);

          // Push immediately to cloud; ignore failures so user can still print
          await ipcRenderer.invoke('sync-now').catch(() => {});

          // Update State
          setExistingInvoices(prev => [...prev, data]);
          await fetchInvoiceNumber(true);
          resetForm();

          // Print via OS dialog (no local PDF save)
          const result = await printInvoice(data);
          if (!result) throw new Error('Print failed');

      } catch (error) {
          handleError(error, 'Error saving/generating PDF');
      }
  };

  const resetForm = () => {
    setTreatments([]);
    setDiagnosis('');
    setNotes('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    // Patient usually stays same? Or reset? Original code resets treatments/notes but NOT patient explicitly?
    // Checking original code... 
    // Original: setTreatments([]), setDiagnosis(''), setNotes(''), setInvoiceDate(...)
    // It did NOT reset patient.
  };

  return (
    <div className="w-full max-w-400 mx-auto p-6">
      <PageHeader 
        title="Invoice Generator"
        icon={<div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><FileTextIcon /></div>}
        actions={
          <>
            <button 
              onClick={handlePrint} 
              className="px-5 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium shadow-sm transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
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
                  invoices={existingInvoices as any}
                  onPatientSelect={setPatient}
                />
              </section>

              {/* Step 2: Invoice Number */}
              <section>
                <h3 className="text-lg font-semibold text-[#5F3794]">Invoice Number <span className="text-red-500">*</span></h3>
                <div>
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
              </section>

              <PatientForm patient={patient} setPatient={setPatient} />

              <section>
                <h3 className="text-lg font-semibold text-[#5F3794] mb-2">Diagnosis / Complaint</h3>
                <div>
                  <label htmlFor="diagnosis" className="block text-sm font-medium text-slate-700 mb-1">
                    Provisional Diagnosis <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="diagnosis"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 border-slate-300 focus:ring-blue-500 placeholder-gray-400"
                    placeholder="e.g., Left Knee ACL Grade 2 Tear"
                  />
                </div>
              </section>

              <TreatmentForm
                treatments={treatments}
                updateTreatment={(index, field, value) => {
                    setTreatments(prev => {
                        const newTreatments = [...prev];
                        newTreatments[index] = { ...newTreatments[index], [field]: value };
                        return newTreatments;
                    });
                }}
                removeTreatmentItem={(index) => setTreatments(t => t.filter((_, i) => i !== index))}
                addTreatmentItem={() => setTreatments(prev => [...prev, { name: '', duration: '', startDate: '', endDate: '', sessions: 0, amount: 0 }])}
              />

              <AdditionalInfoForm
                invoiceDate={invoiceDate}
                setInvoiceDate={setInvoiceDate}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
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
