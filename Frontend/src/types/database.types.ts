// Database-related type definitions

export interface Patient {
  id?: number;
  firstName?: string;
  lastName?: string;
  name?: string; // Full name from older records
  age: number;
  gender: string;
  phone?: string;
  uhid?: string;
  syncStatus?: string;
  cloudId?: number;
}

export interface Treatment {
  name: string;
  duration?: string;
  sessions: number;
  startDate: string;
  endDate: string;
  amount: number;
}

export interface DatabaseInvoice {
  id?: number;
  patientId?: number;
  invoiceNumber: string;
  date: string;
  patient: {
    id?: number;
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
    phone?: string;
    uhid?: string | null;
    syncStatus?: string;
    cloudId?: number;
  };
  treatments: Treatment[];
  diagnosis?: string;
  notes?: string;
  paymentMethod: string;
  total: number;
  syncStatus?: string;
  cloudId?: number;
  lastSyncAt?: string;
}

export interface SearchInvoice {
  invoiceNumber: string;
  date?: string;
  patient: Patient;
}
