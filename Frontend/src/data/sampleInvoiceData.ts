import type { PatientForm as PatientInfo, TreatmentForm as TreatmentItem } from '@/schemas/validation.schema.ts';

export const samplePatient: PatientInfo = {
  firstName: '',
  lastName: '',
  age: 0,
  gender: '',
  phone: '',
  uhid: '',
};

export const sampleTreatments: TreatmentItem[] = [
  { name: '', duration: '', startDate: '', endDate: '', sessions: 0, amount: 0 },
];

export const sampleInvoiceNumber = '0001';
export const sampleNotes = 'Patient to follow up in two weeks for reassessment.';
export const sampleInvoiceDate = '15-05-2025';
export const sampleDiagnosis = '';
export const samplePaymentMode = 'CASH';

export const calculateSampleTotal = () => {
  return sampleTreatments.reduce((sum, item) => sum + (item.sessions * item.amount), 0).toFixed(2);
};

