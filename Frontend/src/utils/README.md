# Utils Directory

This directory contains all utility functions and business logic for the application, organized by domain.

## Structure

### 📄 `invoiceUtils.ts`
**Purpose:** Invoice number generation, validation, and formatting
- `generateNextInvoiceNumber()` - Generate sequential invoice numbers
- `formatInvoiceDate()` - Format dates for invoices
- `formatCurrency()` - Format currency values
- `parseInvoiceNumber()` - Parse invoice numbers from various formats

**Usage:**
```typescript
import { generateNextInvoiceNumber } from '@/utils/invoiceUtils';
const nextNumber = generateNextInvoiceNumber(existingInvoices);
```

---

### 📄 `calculationUtils.ts`
**Purpose:** All financial and mathematical calculations
- `calculateTotal()` - Calculate total cost from treatment items
- `calculateTreatmentCost()` - Calculate individual treatment cost
- `calculateTotalPaid()` - Sum all payments
- `calculateRemainingBalance()` - Calculate outstanding balance
- `toCurrencyString()` / `parseCurrency()` - Currency conversion helpers

**Usage:**
```typescript
import { calculateTotal } from '@/utils/calculationUtils';
const total = calculateTotal(treatments);
```

---

### 📄 `searchUtils.ts`
**Purpose:** Patient search algorithm with fuzzy matching
- `searchPatients()` - Main search function with scoring
- `normalizeSearchString()` - Normalize strings for comparison
- `matchesQuery()` - Check if text matches query

**Features:**
- Multi-field search (name, phone, UHID, invoice numbers)
- Fuzzy matching with relevance scoring
- Handles legacy data formats

**Usage:**
```typescript
import { searchPatients } from '@/utils/searchUtils';
const results = searchPatients(query, invoices);
```

---

### 📄 `dateUtils.ts`
**Purpose:** Date formatting, parsing, and calculations
- `formatDate()` - Format to YYYY-MM-DD
- `formatDateDisplay()` - Format for display (e.g., "Jan 15, 2024")
- `getCurrentDate()` - Get current date
- `daysBetween()` - Calculate days between dates
- `addDays()` - Add days to a date
- `isValidDate()` - Validate date objects

**Usage:**
```typescript
import { formatDate, daysBetween } from '@/utils/dateUtils';
const formatted = formatDate(new Date());
```

---

### 📄 `validationUtils.ts`
**Purpose:** Common validation helpers
- `isValidPhone()` - Validate Indian phone numbers
- `isValidEmail()` - Validate email addresses
- `isValidUHID()` - Validate UHID format
- `isNotEmpty()` - Check non-empty strings
- `isPositiveNumber()` - Validate positive numbers
- `sanitizeString()` - Sanitize user input

**Usage:**
```typescript
import { isValidPhone, isValidEmail } from '@/utils/validationUtils';
if (!isValidPhone(phone)) { /* handle error */ }
```

---

### 📄 `index.ts`
**Purpose:** Central export point for all utilities

**Usage:**
```typescript
// Import multiple utilities at once
import { calculateTotal, generateNextInvoiceNumber, searchPatients } from '@/utils';
```

---

## Design Principles

1. **Single Responsibility:** Each utility file has a clear, focused purpose
2. **Pure Functions:** Most utilities are pure functions with no side effects
3. **Type Safety:** Full TypeScript support with proper typing
4. **Reusability:** Functions can be used across components and pages
5. **Documentation:** Each function has clear JSDoc comments

## Migration from logic-scripts

All logic from the old `logic-scripts/` folder has been refactored and moved here:
- ✅ `invoice-generator.js` logic → `invoiceUtils.ts`
- ✅ `searchAlgorithm.ts` → `searchUtils.ts`
- ✅ Calculation logic from components → `calculationUtils.ts`
- ✅ Date formatting → `dateUtils.ts`
- ✅ Validation helpers → `validationUtils.ts`

## Best Practices

- Import from specific files for tree-shaking: `import { x } from '@/utils/invoiceUtils'`
- Or use the central export: `import { x } from '@/utils'`
- Keep functions small and focused
- Add unit tests for complex logic
- Document edge cases and assumptions
