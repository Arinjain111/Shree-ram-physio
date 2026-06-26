export type ClinicalCategory = 'diagnosis' | 'exercise';

export interface ClinicalPreset {
  id: number;
  name: string;
  category: ClinicalCategory;
  frequency: number;
  createdAt?: string;
  updatedAt?: string;
}
