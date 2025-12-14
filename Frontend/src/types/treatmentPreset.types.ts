export interface TreatmentPreset {
  id?: number;
  name: string;
  defaultSessions: number;
  pricePerSession: number;
  createdAt?: string;
  updatedAt?: string;
}
