# Types Directory

This directory contains all TypeScript type definitions and interfaces used throughout the application, organized by domain.

## File Structure

### `index.ts`
Central export file that re-exports all types from other files. Import from here for convenience:
```typescript
import type { Patient, DatabaseInvoice, LayoutConfig } from '@/types';
```

### `invoice.types.ts`
Invoice-related type definitions:
- `TreatmentItem` - Individual treatment in an invoice
- `PatientInfo` - Patient information structure
- `InvoiceData` - Complete invoice data structure

### `treatmentPreset.types.ts`
Treatment preset definitions:
- `TreatmentPreset` - Saved treatment templates

### `database.types.ts`
Database-related types for data persistence and search:
- `Patient` - Patient entity with optional fields for legacy data
- `Treatment` - Treatment record structure
- `DatabaseInvoice` - Full invoice record from database
- `SearchInvoice` - Simplified invoice for search operations

### `layout.types.ts`
Layout and customization types:
- `LayoutConfig` - Complete invoice layout configuration including header, styling, and advanced options

### `component.types.ts`
React component props interfaces:
- `PatientFormProps` - Props for PatientForm component
- `TreatmentFormProps` - Props for TreatmentForm component
- `PatientSearchProps` - Props for PatientSearch component
- `AdditionalInfoFormProps` - Props for AdditionalInfoForm component
- `InvoicePreviewProps` - Props for InvoicePreview component
- `ColorCircleProps` - Props for ColorCircle component
- `StylingSectionProps` - Props for StylingSection component
- `PreviewPanelProps` - Props for PreviewPanel component
- `HeaderDetailsSectionProps` - Props for HeaderDetailsSection component

## Usage Guidelines

1. **Always import types from the centralized location**: 
   ```typescript
   import type { DatabaseInvoice, Patient } from '@/types/database.types';
   ```

2. **Use the index file for multiple imports**:
   ```typescript
   import type { 
     Patient, 
     DatabaseInvoice, 
     LayoutConfig 
   } from '@/types';
   ```

3. **Keep component props in component.types.ts**: All React component prop interfaces should be defined here.

4. **Avoid duplicating types**: If a type exists here, import it rather than redefining it locally.

5. **Document complex types**: Add JSDoc comments for complex or non-obvious type definitions.

## Migration Notes

Previously, types were scattered across individual component files and pages. All types have now been consolidated into this directory for:
- Better code organization
- Easier maintenance
- Prevention of duplicate definitions
- Improved type reusability
- Clearer project structure
