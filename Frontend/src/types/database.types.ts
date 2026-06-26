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
  id?: number;
  name: string;
  duration?: string;
  sessions: number;
  startDate: string;
  endDate: string;
  amount: number;
}

export interface TreatmentSession {
  id: number;
  treatmentId: number;
  sessionNumber: number;
  date: string | null;
  attended: number;
  painBefore: number | null;
  painAfter: number | null;
  notes: string;
  exercisesPerformed: string;
  progress: string | null;
  cancelled: number;
  rescheduledDate: string | null;
  syncStatus?: string;
  cloudId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TreatmentSessionSummary {
  treatmentId: number;
  treatmentName: string;
  invoiceNumber: string;
  totalSessions: number;
  attendedCount: number;
  cancelledCount: number;
  pendingCount: number;
  sessions: TreatmentSession[];
}

export interface PainTrendPoint {
  sessionNumber: number;
  date: string | null;
  painBefore: number;
  painAfter: number;
  painDelta: number;
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
  TransactionId?: string;
  total: number;
  discount?: number;
  discountType?: string;
  paymentStatus?: string;
  amountPaid?: number;
  syncStatus?: string;
  cloudId?: number;
  lastSyncAt?: string;
}

export interface SearchInvoice {
  invoiceNumber: string;
  date?: string;
  patient: Patient;
}
