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
  sessions: number;
  startDate: string;
  endDate: string;
  amount: number;
}

export interface DatabaseInvoice {
  invoiceNumber: string;
  date: string;
  patient: {
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
    phone?: string;
    uhid: string;
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
