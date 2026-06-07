import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUI } from '@/context/UIContext';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useInvoicePrinter } from '@/hooks/useInvoicePrinter';
import { useLogger } from '@/utils/logger';

import { samplePatient, sampleDiagnosis } from '@/data/sampleInvoiceData';
import { InvoiceDataSchema, validateForm, type PatientForm as PatientInfo, type TreatmentForm as TreatmentItem, type InvoiceData } from '@/schemas/validation.schema';
import { generateNextInvoiceNumber } from '@/utils/invoiceUtils';
import { calculateDiscountedTotal } from '@/utils/calculationUtils';
import { ipcRenderer } from '@/lib/ipc';

type InvoiceGeneratorMode = 'create' | 'edit' | 'duplicate';

type InvoiceGeneratorNavState = {
  mode?: InvoiceGeneratorMode;
  invoiceId?: number;
};

export const useInvoiceForm = () => {
  const { showToast, showModal } = useUI();
  const { isSyncing } = useSyncManager(); 
  const { handleError } = useErrorHandler();
  const { printInvoice, previewInvoice } = useInvoicePrinter();
  const location = useLocation();
  const navigate = useNavigate();
  const log = useLogger();

  // Form State
  const [patient, setPatient] = useState<PatientInfo>(samplePatient);
  const [treatments, setTreatments] = useState<TreatmentItem[]>(() => [
    { name: '', duration: '', startDate: '', endDate: '', sessions: 0, amount: 0 }
  ]);
  const [diagnosis, setDiagnosis] = useState(sampleDiagnosis);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [TransactionId, setTransactionId] = useState('');
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceNumberEdited, setInvoiceNumberEdited] = useState(false);
  const [isRefreshingInvoiceNumber, setIsRefreshingInvoiceNumber] = useState(false);

  const [mode, setMode] = useState<InvoiceGeneratorMode>('create');
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  
  // Data State
  const [existingInvoices, setExistingInvoices] = useState<InvoiceData[]>([]);
  const [previewInvoiceData, setPreviewInvoiceData] = useState<InvoiceData | null>(null);

  // Refs for values accessed inside fetchInvoiceNumber to avoid stale closures
  const editingInvoiceIdRef = useRef(editingInvoiceId);
  const invoiceNumberEditedRef = useRef(invoiceNumberEdited);
  const existingInvoicesRef = useRef(existingInvoices);
  const patientRef = useRef(patient);

  useEffect(() => { editingInvoiceIdRef.current = editingInvoiceId; }, [editingInvoiceId]);
  useEffect(() => { invoiceNumberEditedRef.current = invoiceNumberEdited; }, [invoiceNumberEdited]);
  useEffect(() => { existingInvoicesRef.current = existingInvoices; }, [existingInvoices]);
  useEffect(() => { patientRef.current = patient; }, [patient]);

  // Helper to fetch invoice number
  const fetchInvoiceNumber = useCallback(async (force = false) => {
    if (editingInvoiceIdRef.current) {
      return;
    }
    if (!force && invoiceNumberEditedRef.current) {
      return;
    }

    const currentPatient = patientRef.current;
    const currentInvoices = existingInvoicesRef.current;

    try {
      const result = await ipcRenderer.invoke('get-next-invoice-number', {
        id: currentPatient?.id,
        cloudId: currentPatient?.cloudId
      });
      if (result.success && result.invoiceNumber) {
        setInvoiceNumber(result.invoiceNumber);
        setInvoiceNumberEdited(false);
        log.debug('invoice', 'Next invoice number resolved', { patient: currentPatient?.firstName, invoiceNumber: result.invoiceNumber, source: result.source });
      } else {
        setInvoiceNumber(generateNextInvoiceNumber(currentInvoices));
        setInvoiceNumberEdited(false);
      }
    } catch (error) {
       log.error('invoice', 'Failed to fetch invoice number', { error: error instanceof Error ? error.message : String(error) });
       setInvoiceNumber(generateNextInvoiceNumber(currentInvoices));
       setInvoiceNumberEdited(false);
    }
  }, []);

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
        const state = (location.state || {}) as InvoiceGeneratorNavState;
        const navMode: InvoiceGeneratorMode = state.mode || 'create';
        setMode(navMode);

        // 1. Load Invoices
        const result = await ipcRenderer.invoke('load-invoices');
        const loadedInvoices = result?.invoices || [];
        setExistingInvoices(loadedInvoices);

        // If opened for edit/duplicate, load the invoice
        if (state.invoiceId) {
          const invoiceResult = await ipcRenderer.invoke('get-invoice', state.invoiceId);
          if (!invoiceResult?.success || !invoiceResult?.invoice) {
            showToast('error', invoiceResult?.error || 'Failed to load invoice');
          } else {
            const inv = invoiceResult.invoice;

            // Populate form with invoice data
            setPatient({
              id: inv.patient?.id ?? null,
              cloudId: inv.patient?.cloudId ?? null,
              firstName: inv.patient?.firstName || '',
              lastName: inv.patient?.lastName || '',
              age: inv.patient?.age || 0,
              gender: inv.patient?.gender || '',
              phone: inv.patient?.phone || '',
              uhid: inv.patient?.uhid || ''
            });

            setTreatments(
              (inv.treatments || []).map((t: { id?: number; cloudId?: number; name: string; duration?: string; startDate: string; endDate: string; sessions: number; amount: number }) => ({
                id: t.id ?? null,
                cloudId: t.cloudId ?? null,
                name: t.name,
                duration: t.duration || '',
                startDate: t.startDate,
                endDate: t.endDate,
                sessions: t.sessions,
                amount: t.amount
              }))
            );

            setDiagnosis(inv.diagnosis || '');
            setNotes(inv.notes || '');
            setInvoiceDate(inv.date);
            setPaymentMethod(inv.paymentMethod || 'Cash');
            setTransactionId(inv.TransactionId || '');
            setAmountPaid(inv.amountPaid ?? 0);
            setDiscount(typeof inv.discount === 'string' ? Number(inv.discount) || 0 : (inv.discount ?? 0));
            setDiscountType((inv.discountType as 'amount' | 'percentage') || 'amount');

            if (navMode === 'edit') {
              if (inv.syncStatus === 'SYNCED') {
                showToast('error', 'This invoice is already synced. Use Reissue instead.');
                setMode('duplicate');
                setEditingInvoiceId(null);
              } else {
                setEditingInvoiceId(inv.id);
                setInvoiceNumber(inv.invoiceNumber);
                setInvoiceNumberEdited(true);
              }
            } else if (navMode === 'duplicate') {
              setEditingInvoiceId(null);
              setInvoiceNumber('');
              setInvoiceNumberEdited(false);
            }
          }
        }

        // 2. Fetch Initial Number (create/duplicate only)
        const currentMode = state.mode || 'create';
        if (currentMode !== 'edit') {
          await fetchInvoiceNumber(true);
        }

      } catch (error) {
        handleError(error, 'Error initializing invoice generator');
      }
    };

    initialize();
  }, [fetchInvoiceNumber, handleError, showToast, location.state]);

  // Refresh invoice number when patient changes
  useEffect(() => {
    if (editingInvoiceId) {
      return;
    }
    setInvoiceNumberEdited(false);
    fetchInvoiceNumber(true);
  }, [patient?.id, patient?.cloudId, editingInvoiceId, fetchInvoiceNumber]);

  // Sync Completion Listener (Handled by useSyncManager globally, but we might want to refresh invoices here)
  useEffect(() => {
      const handleInvoicesUpdated = async () => {
        try {
            const result = await ipcRenderer.invoke('load-invoices');
            if (result?.invoices) {
                setExistingInvoices(result.invoices);
                fetchInvoiceNumber(true); // Update number as well
            }
        } catch (e) { log.error('invoice', 'Failed to reload invoices after update event', { error: e instanceof Error ? e.message : String(e) }); }
      };

      window.addEventListener('invoices-updated', handleInvoicesUpdated);
      return () => window.removeEventListener('invoices-updated', handleInvoicesUpdated);
  }, [fetchInvoiceNumber]);

  const getCurrentInvoiceData = (): InvoiceData => ({
    id: editingInvoiceId || null,
    invoiceNumber,
    date: invoiceDate,
    patient: { ...patient },
    treatments,
    notes,
    paymentMethod,
    TransactionId: TransactionId || undefined,
    total: calculateDiscountedTotal(treatments, discount, discountType),
    discount: String(discount || 0),
    discountType,
    timestamp: new Date().toISOString(),
    diagnosis: diagnosis || undefined,
    amountPaid: amountPaid || 0,
  });

  // Debounce Preview
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewInvoiceData(getCurrentInvoiceData());
    }, 500);
    return () => clearTimeout(timer);
  }, [patient, treatments, diagnosis, discount, discountType, invoiceDate, paymentMethod, notes, invoiceNumber, TransactionId, amountPaid]);

  
  // Helpers
  const displayInvoiceNumber = (value: string) => (value || '').replace(/^0+/, '');

  const toPaddedInvoiceNumber = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    if (!digitsOnly) return '';
    return digitsOnly.padStart(4, '0');
  };

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

  const handlePreview = async () => {
    const data = getCurrentInvoiceData();
    const validatedData = validateInvoice(data);
    if (!validatedData) return;

    try {
        const result = await previewInvoice(data);
        if (!result) {
            showToast('error', 'Failed to generate preview PDF');
        }
    } catch (error) {
        handleError(error, 'Error previewing invoice');
    }
  };

  const resetForm = () => {
    setTreatments([]);
    setDiagnosis('');
    setNotes('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDiscount(0);
    setDiscountType('amount');
  };

  const handleSaveAndPDF = async () => {
      const data = getCurrentInvoiceData();
      const validatedData = validateInvoice(data);
      if (!validatedData) return;

      try {
          const saveResult = editingInvoiceId
            ? await ipcRenderer.invoke('update-invoice', editingInvoiceId, validatedData)
            : await ipcRenderer.invoke('save-invoice', validatedData);
          if (!saveResult.success) throw saveResult;
          showToast('success', editingInvoiceId ? `Invoice ${data.invoiceNumber} updated!` : `Invoice ${data.invoiceNumber} saved!`);

          // Push immediately to cloud; ignore failures so user can still print
          await ipcRenderer.invoke('sync-now').catch(() => {});

          window.dispatchEvent(new CustomEvent('invoices-updated'));

          // Update State
          if (!editingInvoiceId) {
            setExistingInvoices(prev => [...prev, data]);
            await fetchInvoiceNumber(true);
            resetForm();
          }

          // Print via OS dialog (no local PDF save)
          const result = await printInvoice(data);
          if (!result) throw new Error('Print failed');

          if (editingInvoiceId) {
            navigate('/database-find');
          }

      } catch (error) {
          handleError(error, 'Error saving/generating PDF');
      }
  };

  return {
    patient, setPatient,
    treatments, setTreatments,
    diagnosis, setDiagnosis,
    discount, setDiscount,
    discountType, setDiscountType,
    invoiceDate, setInvoiceDate,
    paymentMethod, setPaymentMethod,
    TransactionId, setTransactionId,
    amountPaid, setAmountPaid,
    notes, setNotes,
    invoiceNumber, setInvoiceNumber,
    invoiceNumberEdited, setInvoiceNumberEdited,
    isRefreshingInvoiceNumber,
    mode, editingInvoiceId,
    existingInvoices,
    previewInvoiceData,
    isSyncing,
    refreshInvoiceNumber,
    displayInvoiceNumber,
    toPaddedInvoiceNumber,
    handlePreview,
    handleSaveAndPDF,
    getCurrentInvoiceData
  };
};
