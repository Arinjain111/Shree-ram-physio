import { useState, useEffect, useRef } from 'react';
import { useInvoiceLayout } from '@/hooks/useInvoiceLayout';
import { useUI } from '@/context/UIContext';
import PageHeader from '@/components/layout/PageHeader';
import { generateInvoiceHTML } from '@/utils/invoiceGenerator';
import { samplePatient, sampleDiagnosis } from '@/data/sampleInvoiceData';
import PatientForm from '@/components/invoice/PatientForm';
import PatientSearch from '@/components/invoice/PatientSearch';
import TreatmentForm from '@/components/invoice/TreatmentForm';
import AdditionalInfoForm from '@/components/invoice/AdditionalInfoForm';
import InvoicePreview from '@/components/invoice/InvoicePreview';
import { InvoiceDataSchema, validateForm, type PatientForm as PatientInfo, type TreatmentForm as TreatmentItem, type InvoiceData } from '@/schemas/validation.schema.ts';
import { generateNextInvoiceNumber } from '@/utils/invoiceUtils';
import { calculateTotal } from '@/utils/calculationUtils';
import { handleFrontendError } from '@/services/errorHandler';
import { FileTextIcon } from '@/components/icons';

const { ipcRenderer } = window.require('electron');

const InvoiceGenerator = () => {
  const { layout } = useInvoiceLayout();
  const { showToast, showModal } = useUI();
  
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
  const [existingInvoices, setExistingInvoices] = useState<InvoiceData[]>([]);
  const [syncNotification, setSyncNotification] = useState<string>('');
  const invoiceNumberFetched = useRef(false);

  // Load existing invoices and fetch next invoice number
  useEffect(() => {
    const initialize = async () => {
      let invoices: InvoiceData[] = [];
      
      // 1. Load existing invoices
      try {
        const result = await ipcRenderer.invoke('load-invoices');
        invoices = result?.invoices || [];
        setExistingInvoices(invoices);
      } catch (error) {
        console.error('Error loading invoices:', error);
        handleFrontendError(error, showToast, 'Error loading invoices');
      }

      // 2. Fetch next invoice number (only once)
      if (!invoiceNumberFetched.current) {
        invoiceNumberFetched.current = true;
        try {
          // Try to get invoice number from backend first
          const result = await ipcRenderer.invoke('get-next-invoice-number');
          if (result.success && result.invoiceNumber) {
            setInvoiceNumber(result.invoiceNumber);
          } else {
            // Fallback to local generation if backend fails
            const localNumber = generateNextInvoiceNumber(invoices);
            setInvoiceNumber(localNumber);
          }
        } catch (error) {
          console.error('Error fetching invoice number from backend:', error);
          // Fallback to local generation if offline
          const localNumber = generateNextInvoiceNumber(invoices);
          setInvoiceNumber(localNumber);
        }
      }
    };

    initialize();
  }, []);

  // Listen for sync completion events
  useEffect(() => {
    const handleSyncCompleted = (_event: any, data: any) => {
      
      // Show notification
      if (data.synced.invoices > 0) {
        setSyncNotification(`✅ ${data.synced.invoices} invoice(s) synced to backend!`);
        setTimeout(() => setSyncNotification(''), 5000);
        
        // Reload invoices to show updated sync status
        loadExistingInvoices();
      }
      
      // Handle conflicts
      if (data.conflicts && data.conflicts.length > 0) {
        const conflictMsg = data.conflicts.map((c: any) => 
          `Invoice ${c.originalNumber} renumbered to ${c.newNumber}`
        ).join('\n');
        showModal({
          title: 'Invoice Number Conflicts',
          message: `Invoice number conflicts detected:\n\n${conflictMsg}`,
          type: 'info',
          confirmText: 'OK',
        });
      }
    };

    ipcRenderer.on('sync-completed', handleSyncCompleted);
    
    return () => {
      ipcRenderer.removeListener('sync-completed', handleSyncCompleted);
    };
  }, []);

  const loadExistingInvoices = async () => {
    try {
      const result = await ipcRenderer.invoke('load-invoices');
      const invoices = result?.invoices || [];
      setExistingInvoices(invoices);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  // Treatment Management Functions
  const addTreatmentItem = () => {
    setTreatments([...treatments, { name: '', duration: '', startDate: '', endDate: '', sessions: 0, amount: 0 }]);
  };

  const removeTreatmentItem = (index: number) => {
    setTreatments(treatments.filter((_, i) => i !== index));
  };

  const updateTreatment = (index: number, field: keyof TreatmentItem, value: any) => {
    setTreatments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const getCurrentInvoiceData = (): InvoiceData => {
    return {
      invoiceNumber: invoiceNumber,
      date: invoiceDate,
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        uhid: patient.uhid,
      },
      treatments,
      notes,
      paymentMethod,
      total: calculateTotal(treatments),
      timestamp: new Date().toISOString(),
      diagnosis,
    };
  };

  // Print and Save Functions
  const handlePrint = async () => {
    const invoiceData = getCurrentInvoiceData();

    // Validate invoice data with Zod before printing
    const validation = validateForm(InvoiceDataSchema, invoiceData);
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
      return;
    }

    const html = generateInvoiceHTML(invoiceData, layout);
    try {
      const result = await ipcRenderer.invoke('print-invoice', html);
      if (result.success) {
        showToast('success', 'Invoice printed successfully!');
      } else {
        showToast('error', 'Print failed: ' + result.error);
      }
    } catch (error: any) {
      handleFrontendError(error, showToast, 'Error printing invoice');
    }
  };

  const handleSaveAndPrint = async () => {
    const invoiceData = getCurrentInvoiceData();

    // Validate invoice data with Zod before saving
    const validation = validateForm(InvoiceDataSchema, invoiceData);
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
      return;
    }

    try {
      const saveResult = await ipcRenderer.invoke('save-invoice', validation.data);
      if (saveResult.success) {
        // Show success message
        showToast('success', `Invoice ${invoiceData.invoiceNumber} saved successfully!`);
        
        // Update existing invoices list
        const updatedInvoices = [...existingInvoices, invoiceData];
        setExistingInvoices(updatedInvoices);
        
        // Fetch next invoice number from backend
        try {
          const nextNumResult = await ipcRenderer.invoke('get-next-invoice-number');
          if (nextNumResult.success && nextNumResult.invoiceNumber) {
            setInvoiceNumber(nextNumResult.invoiceNumber);
          } else {
            // Fallback to local generation
            const nextNumber = generateNextInvoiceNumber(updatedInvoices);
            setInvoiceNumber(nextNumber);
          }
        } catch (error) {
          // Fallback to local generation
          const nextNumber = generateNextInvoiceNumber(updatedInvoices);
          setInvoiceNumber(nextNumber);
        }
        
        // Reset form for next invoice (keep patient info for convenience)
        setTreatments([]);
        setDiagnosis('');
        setNotes('');
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        
        await handlePrint();
      } else {
        showToast('error', 'Error saving invoice: ' + saveResult.error);
      }
    } catch (error: any) {
      handleFrontendError(error, showToast, 'Error saving invoice');
    }
  };

  // JSX Render
  // const headerActions = document.getElementById('header-actions'); // Removed

  return (
    <div className="w-full max-w-[1600px] mx-auto p-6">
      {/* Header Section */}
      <PageHeader 
        title="Invoice Generator"
        icon={
          <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
            <FileTextIcon />
          </div>
        }
        actions={
          <>
            <button 
              onClick={handlePrint} 
              className="px-5 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium shadow-sm transition-colors"
            >
              Print
            </button>
            <button 
              onClick={handleSaveAndPrint} 
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save & Print
            </button>
          </>
        }
      />

      {/* Sync Notification */}
      {syncNotification && (
        <div className="max-w-full mx-auto mb-4">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{syncNotification}</span>
          </div>
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="max-w-full mx-auto pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* LEFT COLUMN - Form */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow-md p-6">
            <form className="space-y-6">

              {/* Patient Search Section (Step 1) */}
              <section className="mb-6 border-2 border-purple-400 rounded-2xl bg-linear-to-r from-purple-50 via-purple-100 to-purple-50 px-4 py-4 shadow-sm">
                <h3 className="text-sm font-semibold text-[#4C2C82] mb-1 flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-[#4C2C82] shadow-sm">
                    1
                  </span>
                  Find Existing Patient
                </h3>
                <p className="text-xs text-gray-700 mb-3">
                  Start by searching with contact number or invoice number to instantly fetch an existing patient's details.
                </p>
                <PatientSearch
                  invoices={existingInvoices as any}
                  onPatientSelect={(selectedPatient) => {
                    setPatient(selectedPatient);
                  }}
                />
              </section>

              {/* Invoice Number Section (Step 2) */}
              <section>
                <h3 className="text-lg font-semibold text-[#5F3794]">Invoice Number <span className="text-red-500">*</span></h3>
                <div>
                  <p className="mb-2 text-xs text-gray-500">
                    🔒 Auto-generated sequential number synced with backend database
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      readOnly
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold cursor-not-allowed"
                      placeholder="Loading..."
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-green-600 bg-green-50 p-2 rounded flex items-start">
                    <svg className="w-4 h-4 mr-1 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Invoice number is automatically assigned to prevent conflicts and maintain sequential order</span>
                  </p>
                </div>
              </section>

              <PatientForm patient={patient} setPatient={setPatient} />

              {/* Diagnosis Section */}
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
                updateTreatment={updateTreatment}
                removeTreatmentItem={removeTreatmentItem}
                addTreatmentItem={addTreatmentItem}
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
              invoiceData={getCurrentInvoiceData()}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceGenerator;
