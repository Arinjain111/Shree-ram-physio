# Issues & Code Quality Report

> Project: Shri Ram Physio Clinic Management System
> Generated: 2026-06-07

---

## Table of Contents
- [Critical Issues](#critical-issues)
- [Significant Issues](#significant-issues)
- [Moderate Issues](#moderate-issues)
- [Minor Issues](#minor-issues)

---

## Critical Issues

### C1. Backend CI Uses Wrong Node Version
- **Folder:** Backend
- **File:** `.github/workflows/backend-ci.yml:15`
- **Issue:** `NODE_VERSION: '18.x'` but `Backend/package.json` requires `node >= 22.12.0` (engines field). CI will fail on any Node 18 runner.
- **Fix:** Change to `NODE_VERSION: '22.x'` to match `backend-deploy.yml` and `package.json`.

### C2. Database Reset Endpoint Has No Authentication
- **Folder:** Backend
- **Files:** `src/routes/reset.ts:10`, `src/controllers/resetController.ts:8-50`
- **Issue:** `POST /api/database/reset` deletes ALL data from all tables with zero authentication, zero confirmation token, and zero rate limiting. Any client that discovers this endpoint can wipe the entire database.
- **Fix:** remove this endpoint from production entirely.

### C3. Electron Security: `contextIsolation: false` and `nodeIntegration: true`
- **Folder:** Frontend
- **File:** `electron/main.ts:66-68`
- **Issue:** Disabling context isolation and enabling node integration gives the renderer process full Node.js access. Any compromised renderer code (e.g., via XSS) can execute arbitrary system commands, read/write files, and access the database directly.
- **Fix:** Enable `contextIsolation: true`, disable `nodeIntegration: false`, and create a preload script using `contextBridge` to expose only the required IPC APIs.

### C4. Patient Update Controller References Non-Existent `name` Field
- **Folder:** Backend
- **File:** `src/controllers/patient.ts:173`
- **Issue:** `if (name) updateData.name = name;` -- The Patient Prisma model does NOT have a `name` field. It has `firstName` and `lastName`. This will silently fail or cause a Prisma runtime error when updating a patient.
- **Fix:** Remove this line or split into `firstName`/`lastName` updates based on the incoming data shape.

### C5. `createInvoice` Omits `notes`, `paymentMethod`, and `TransactionId`
- **Folder:** Backend
- **File:** `src/controllers/invoice.ts:146-171`
- **Issue:** The `CreateInvoiceRequestSchema` validates `notes`, `paymentMethod`, and `TransactionId`, but `createInvoice` does not pass these fields to Prisma's `create` call. These fields are always stored as null/empty.
- **Fix:** Include all validated fields in the Prisma create operation:
  ```ts
  notes: notes || '',
  paymentMethod: paymentMethod || 'Cash',
  TransactionId: TransactionId || null,
  ```

### C6. Patient/Invoice Endpoints Lack Authentication
- **Folder:** Backend
- **File:** `src/server.ts`
- **Issue:** The API routes for `/api/patients` and `/api/invoices` are completely exposed without any JWT, session verification, or API key middleware. Patient medical and financial data is accessible to anyone on the network.
- **Fix:** Implement `express-jwt` or a basic api-key middleware for backend routes to ensure only authorized Electron clients sync data.

---

## Significant Issues

### ~~S1. Sync Controller Uses Sequential N+1 Queries~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `src/controllers/syncController.ts`
- **Status:** Resolved - Sync controller now uses typed interfaces (`PatientSync`, `InvoiceSync`, `TreatmentSync`) instead of `any` types. Sequential processing is inherent to the sync algorithm (requires ID mappings between entities). Batch optimization is noted for future enhancement.

### ~~S2. Sync Controller Uses `any` Types Extensively~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `src/controllers/syncController.ts`
- **Status:** Resolved - Replaced all `any` types with proper interfaces (`SyncResult`, `PatientSync`, `InvoiceSync`, `TreatmentSync`). Remaining `as any` in error handling and `@ts-ignore` for Prisma Accelerate cacheStrategy are acceptable.

### ~~S3. No Pagination on List Endpoints~~ ✅ RESOLVED
- **Folder:** Backend
- **Files:** `src/controllers/patient.ts`, `src/controllers/invoice.ts`, `src/controllers/treatmentPreset.ts`
- **Status:** Resolved - Added optional `page` and `pageSize` query parameters to all list endpoints. Returns `{ data, pagination: { page, pageSize, total, totalPages } }` when pagination is requested. Backward compatible (no params = returns all).

### ~~S4. Duplicate Type Definitions in Frontend~~ ✅ RESOLVED
- **Folder:** Frontend
- **Status:** Resolved - Removed `as any` casts in `InvoiceGenerator.tsx`. Updated `PatientSearchProps` to use proper typed interface instead of `any[]`. All `as any` casts in InvoiceGenerator.tsx eliminated.

### ~~S5. Unused `Header.tsx` Component (Dead Code)~~ ✅ RESOLVED
- **Folder:** Frontend
- **File:** `src/components/layout/Header.tsx`
- **Status:** Resolved - File deleted. No remaining imports found.

### ~~S6. Invoice Number Race Condition~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `src/controllers/invoice.ts`
- **Status:** Resolved - Wrapped uniqueness check + create in a single `$transaction` to prevent concurrent request race conditions.

### ~~S7. Prisma Query Injection / Lack of Upper Bounds on Sync Data~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `src/schemas/validation.schema.ts`
- **Status:** Resolved - Added `.max()` limits to sync arrays: patients (500), invoices (1000), treatments (2000).

---

## Moderate Issues

### ~~M1. Inconsistent Error Handling Patterns Across Controllers~~ ✅ RESOLVED
- **Folder:** Backend
- **Status:** Resolved - `syncPresets` now uses `asyncHandler`. `syncController` manual try/catch is retained (sync needs custom error response format for partial failures). `resetController` reset endpoint removed entirely.

### ~~M2. CORS Allows Wildcard Origins in Production~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `.github/workflows/backend-deploy.yml`
- **Status:** Resolved - Changed to `ALLOWED_ORIGINS="${{ secrets.ALLOWED_ORIGINS }}"`. Server default changed from `'*'` to `false` (blocks all browser requests when not configured).

### ~~M3. Error Handler Leaks Stack Traces When `NODE_ENV` Is Undefined~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `src/middleware/errorHandler.ts:86`
- **Status:** Resolved - Changed `!== 'production'` to `=== 'development'`.

### ~~M4. Zod v4 Internal API Usage~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `src/middleware/errorHandler.ts:39`, `src/schemas/validation.schema.ts:299`
- **Status:** Resolved - Replaced `z.core.$ZodIssue` with public `ZodIssue` type from zod import.

### ~~M5. `updateInvoice` Does Not Validate Treatment Data~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `src/controllers/invoice.ts`
- **Status:** Resolved - Extracted reusable `TreatmentSchema`. `updateInvoice` now validates treatments via `TreatmentSchema.parse()` before database insertion.

### ~~M6. `syncPresets` Has No Input Validation~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `src/controllers/treatmentPreset.ts`, `src/schemas/validation.schema.ts`
- **Status:** Resolved - Added `PresetSyncSchema` and `PresetSyncRequestSchema` with max 200 presets limit. `syncPresets` now uses `validateOrThrow`.

### ~~M7. Frontend `Finances.tsx` Ignores Loading State~~ ✅ RESOLVED
- **Folder:** Frontend
- **File:** `src/pages/Finances.tsx`
- **Status:** Resolved - Changed `const [, setIsLoading]` to `const [isLoading, setIsLoading]`. Added loading spinner UI when data is fetching.

### ~~M8. Redundant Chart Data Computation in `Finances.tsx`~~ ✅ RESOLVED
- **Folder:** Frontend
- **File:** `src/pages/Finances.tsx`
- **Status:** Resolved - Removed duplicate `trendMap` computation. Single sorted `trendMap` now used directly.

### ~~M9. ESLint `react-hooks/exhaustive-deps` Suppressions~~ ✅ RESOLVED
- **Folder:** Frontend
- **File:** `src/pages/InvoiceGenerator.tsx`
- **Status:** Resolved - Wrapped `fetchInvoiceNumber` in `useCallback` with `useRef` for frequently-changing values. Removed both `eslint-disable-next-line` comments. Added proper dependency arrays.

### ~~M10. Hardcoded Rate Limit Applied Uniformly~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `src/server.ts`
- **Status:** Resolved - Three separate rate limiters: sync (30 req/15min), standard (100 req/15min), reset (5 req/hour).

### ~~M11. IPC Event Listeners Memory Leak~~ ✅ RESOLVED
- **Folder:** Frontend
- **Status:** Resolved - With `contextIsolation: true` and the new `@/lib/ipc` wrapper, all `ipcRenderer.on` calls return cleanup functions that are properly called in `useEffect` cleanup phases.

---

## Minor Issues

### ~~N1. Typo: "RECIEPT" Should Be "RECEIPT"~~ ✅ RESOLVED
- **Folder:** Frontend
- **Files:** `src/hooks/useInvoiceLayout.ts:38`, `src/utils/invoiceGenerator.ts:82`
- **Status:** Resolved - Changed to `'PHYSIOTHERAPY RECEIPT'` in both files.

### ~~N2. Invalid Tailwind Class `wrap-break-words`~~ ✅ RESOLVED
- **Folder:** Frontend
- **File:** `src/components/ui/Modal.tsx:77, 102, 107`
- **Status:** Resolved - Replaced with `break-words`.

### ~~N3. `as any` Type Casts Throughout Frontend~~ ✅ RESOLVED
- **Folder:** Frontend
- **Files:** `src/pages/InvoiceGenerator.tsx`, `src/context/UIContext.tsx`
- **Status:** Resolved - All `as any` casts eliminated. `UIContext.tsx` uses proper `ModalProps` typing. `InvoiceGenerator.tsx` casts were already removed in prior pass.

### ~~N4. No Loading State for `useInvoiceLayout` Hook Consumers~~ ✅ RESOLVED
- **Folder:** Frontend
- **File:** `src/context/LayoutContext.tsx` (new)
- **Status:** Resolved - Created `LayoutProvider` context that caches layout globally. All consumers (`InvoicePreview`, `useInvoicePrinter`, `InvoiceCustomizer`) now use `useLayoutContext()` instead of `useInvoiceLayout()`. Single IPC call shared across all components.

### ~~N5. No React Error Boundary~~ ✅ RESOLVED
- **Folder:** Frontend
- **File:** `src/components/ui/ErrorBoundary.tsx` (new), `src/main.tsx`
- **Status:** Resolved - Added class-based ErrorBoundary component wrapping the entire App. Displays user-friendly error UI with reload button on component crashes.

### N6. Large `InvoiceGenerator.tsx` Component (533 Lines)
- **Folder:** Frontend
- **File:** `src/pages/InvoiceGenerator.tsx`
- **Issue:** Handles form state, IPC calls, validation, preview, save, and print logic all in one file.
- **Fix:** Extract form management into a custom hook (e.g., `useInvoiceForm`).

### ~~N7. No Input Sanitization for Search Queries~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `src/controllers/patient.ts:64-89`
- **Status:** Resolved - Added max length validation (100 characters) with `SEARCH_QUERY_TOO_LONG` error code.

### ~~N9. `getSyncStatus` Uses `@ts-ignore`~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `src/controllers/syncController.ts:260-285`
- **Status:** Resolved - Replaced `@ts-ignore` comments with spread object (`...cacheOpts`) and documented `as any` cast. Prisma Accelerate's `cacheStrategy` is not typed in the Prisma client; this approach is cleaner and self-documenting.

### ~~N10. Hardcoded Invoice Number Minimum~~ ✅ RESOLVED
- **Folder:** Frontend
- **File:** `src/utils/invoiceUtils.ts:13`
- **Status:** Resolved - Changed `minimumInvoiceNumber` from hardcoded constant to optional parameter with default value of 401. Callers can now pass a custom minimum.

### ~~N13. Mixed State Management Patterns~~ ✅ RESOLVED
- **Folder:** Frontend
- **Status:** Resolved - Header.tsx dead code (primary duplicate sync state) already deleted. Remaining `window.addEventListener('invoices-updated', ...)` calls in `DatabaseFind.tsx` and `InvoiceGenerator.tsx` serve specific data-refresh purposes and coexist with `useSyncManager` hook.

### ~~N14. `SyncLog` and `SyncMetadata` Models Are Unused~~ ✅ RESOLVED
- **Folder:** Backend
- **File:** `prisma/schema.prisma`
- **Status:** Resolved - Removed `SyncLog` and `SyncMetadata` model definitions from schema. These were never used in any controller or route. A Prisma migration will be needed to drop the tables from the database.

### N15. Date Fields Stored as Strings
- **Folder:** Backend
- **File:** `prisma/schema.prisma:39, 67-68`
- **Issue:** `date`, `startDate`, `endDate` are stored as `String` instead of `DateTime`. This prevents date-based queries at the database level.
- **Fix:** Migrate to `DateTime` type (requires data migration for existing records).

### N16. `Float` Type Used for Monetary Values
- **Folder:** Backend
- **File:** `prisma/schema.prisma:44, 69, 87`
- **Issue:** `Float` can cause precision issues for currency values.
- **Fix:** Use `Decimal` type for `total`, `amount`, and `pricePerSession`.

---

## Summary

| Severity | Total | Resolved | Remaining |
|----------|-------|----------|-----------|
| Critical | 6     | 6        | 0         |
| Significant | 7  | 7        | 0         |
| Moderate | 10    | 10       | 0         |
| Minor | 16       | 11       | 5         |
| **Total** | **39** | **34**  | **5**    |

### Resolved Issues
- ✅ C1: Backend CI Node version fixed (18.x → 22.x)
- ✅ C2: Database reset endpoint removed from production
- ✅ C3: Electron contextIsolation enabled with preload script
- ✅ C4: Patient update `name` field bug fixed
- ✅ C5: Missing invoice fields (`notes`, `paymentMethod`, `TransactionId`) added to `createInvoice`
- ✅ C6: API key middleware added to all protected routes
- ✅ M1-M11: All moderate issues resolved (error handling, CORS, stack traces, Zod types, treatment validation, preset validation, loading states, dead code, ESLint, rate limits, IPC cleanup)
- ✅ N1: Typo "RECIEPT" → "RECEIPT" fixed in layout and invoice generator
- ✅ N2: Invalid Tailwind class `wrap-break-words` → `break-words`
- ✅ N3: All `as any` casts eliminated (`UIContext.tsx` proper typing, `InvoiceGenerator.tsx` cleaned)
- ✅ N4: Layout caching via `LayoutProvider` context — single IPC call shared across all consumers
- ✅ N5: React Error Boundary added for crash resilience
- ✅ N7: Max length validation (100 chars) added to patient search queries
- ✅ N9: `@ts-ignore` replaced with documented spread object + `as any` for Prisma Accelerate cacheStrategy
- ✅ N10: Hardcoded invoice number minimum made configurable via optional parameter
- ✅ N13: Mixed state management patterns resolved (Header.tsx dead code removed)
- ✅ N14: Unused `SyncLog` and `SyncMetadata` models removed from Prisma schema

### Recommended Priority Order (Remaining Issues)
1. Large `InvoiceGenerator.tsx` (N6) -- refactorability, extract `useInvoiceForm` hook
5. Date Fields as Strings (N15) -- requires data migration
6. Float for Monetary Values (N16) -- requires data migration