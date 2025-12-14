// Type Definitions for Invoice Generator

export interface TreatmentItem {
  name: string;
  /** Optional descriptive duration text (e.g. 15 Days) */
  duration: string;
  startDate: string;
  endDate: string;
  /** Number of sessions */
  sessions: number;
  /** Amount charged per session */
  amount: number;
  rate?: number; // deprecated – kept for backward compatibility
}

export interface PatientInfo {
  name: string;
  age: number;
  gender: string;
  phone: string;
  uhid: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  patient: PatientInfo;
  treatments: TreatmentItem[];
  notes: string;
  paymentMethod: string;
  total: string;
  timestamp: string;
  diagnosis?: string;
}
