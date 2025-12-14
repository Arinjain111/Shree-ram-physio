// Component props type definitions

import type { PatientForm, TreatmentForm, InvoiceData } from '@/schemas/validation.schema';
import type { LayoutConfig } from './layout.types';

// Patient Form Component
export interface PatientFormProps {
  patient: PatientForm;
  setPatient: (patient: PatientForm) => void;
}

// Treatment Form Component
export interface TreatmentFormProps {
  treatments: TreatmentForm[];
  updateTreatment: (index: number, field: keyof TreatmentForm, value: any) => void;
  removeTreatmentItem: (index: number) => void;
  addTreatmentItem: () => void;
}

// Patient Search Component
export interface PatientSearchProps {
  invoices: any[]; // Using any for now to avoid circular dependencies
  onPatientSelect: (patient: PatientForm) => void;
}

// Additional Info Form Component
export interface AdditionalInfoFormProps {
  invoiceDate: string;
  setInvoiceDate: (date: string) => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  notes: string;
  setNotes: (notes: string) => void;
}

// Invoice Preview Component
export interface InvoicePreviewProps {
  invoiceData: InvoiceData;
}

// Customizer Components
export interface ColorCircleProps {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}

export interface StylingSectionProps {
  formData: LayoutConfig;
  onChange: (field: keyof LayoutConfig, value: any) => void;
}

export interface PreviewPanelProps {
  formData: LayoutConfig;
}

export interface HeaderDetailsSectionProps {
  formData: LayoutConfig;
  onChange: (field: keyof LayoutConfig, value: any) => void;
}
