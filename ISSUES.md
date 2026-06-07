# Issues & Code Quality Report

> Project: Shri Ram Physio Clinic Management System  
> Last verified: June 8, 2026

---

## Resolved Issues (51 Total)

### Recent (v2.1.2)
| # | Issue | Fix |
|---|-------|-----|
| 1 | Large InvoiceGenerator component (533 lines) | Extracted logic into `useInvoiceForm` hook |
| 2 | Date fields stored as text strings | Idempotent migrations to convert TEXT → TIMESTAMP/DATETIME |
| 3 | Missing `fs-extra` dependency | Already in devDependencies |
| 4 | Hardcoded sync timeout | Dynamic timeout: 10s + 500ms/item, capped 30s–5min |
| 5 | Unused `getPaymentStatus` function | Removed during hook extraction |
| 6 | Prisma Accelerate config | False positive — actively used for production URLs |
| 7 | Dead code in `src/generated/` | False positive — Prisma client output directory |
| 8 | No unified logging system | Structured logger across backend + Electron + renderer with toast bridge |
| 9 | Sync data duplication | 4-way patient match + 3-way treatment match with identity fallbacks |
| 10 | Finances page crashes | `parseISO` on Date objects, React child Date render, invalid `h-75` class |
| 11 | Diagnosis autocomplete dead code | Swapped `<textarea>` for `DiagnosisAutocomplete` component |
| 12 | Inventory missing types, validation, sync, migration | Shared types, Zod on IPC, bidirectional sync, migration file |
| — | Read cache for repeat queries | 10s TTL cache on `load-invoices`, `get-transactions`, `get-expenses` |
| — | Sync-on-close | Last-chance `performSync` in `before-quit` handler |
| — | Sync status dashboard | Per-table pending counts + idle/syncing indicator in Settings |
| — | Double sync after manual trigger | Removed redundant immediate sync from `startAutoSync` |
| — | Sync queue (was silently dropped) | `pendingSync` flag retries after current sync completes |
| — | Billing summary writing during read | Computes corrected status in-memory only |

### Earlier (39 resolved)
Security hardening, CI fixes, Zod validation across all endpoints, `any`/`@ts-ignore` removal, memory leaks in IPC listeners, React Error Boundary, layout caching, invoice number race condition fix, query limits on sync arrays, backend pagination.

---

## Summary

| Severity | Total | Resolved | Remaining |
|----------|-------|----------|-----------|
| Critical | 7 | 7 | 0 |
| Significant | 9 | 9 | 0 |
| Moderate | 10 | 10 | 0 |
| Minor | 25 | 25 | 0 |
| **Total** | **51** | **51** | **0** |
