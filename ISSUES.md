# Issues & Code Quality Report

> Project: Shri Ram Physio Clinic Management System  
> Last verified: June 14, 2026

---

## Resolved Issues (55 Total)

### Recent (v2.5.5)
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
| 13 | **Payment Status dropdown reverts to Unpaid** | Was a derived `let` variable; now stored as explicit `useState` with a one-time auto-detect for invoice-loading case |
| 14 | **Sync crash on duplicate `invoice_number` rows** | `save-invoice` is idempotent (find by number, update or create); `performSync` self-heals at startup with a `GROUP BY invoice_number HAVING COUNT(*) > 1` dedup; `applyCloudUpdates` deletes sibling duplicates before each update |
| 15 | **Manual invoice number edit silently overwritten** | Patient-change useEffect and `invoices-updated` listener now respect the `invoiceNumberEdited` ref; refresh button is the only way to force-overwrite |
| 16 | **Wrong "next invoice number" for legacy non-padded rows** | `get-next-invoice-number` now sorts with `CAST(invoice_number AS INTEGER) DESC` via raw SQL |
| 17 | **Billing list order was arbitrary** | `filteredInvoices` now sorts by `date` desc (with `id` desc as tiebreaker) |
| 18 | **PageSkeleton never shown** | Old `PageLoader` set `loading=false` in the same `useEffect` it set it to `true`; rewritten to use `React.lazy()` + `<Suspense>` so each page is its own Rollup chunk and the skeleton shows during fetch |
| 19 | **Monolithic page bundle** | `React.lazy()` wraps every page; verified chunks via `npm run build:vite` (Home 8KB → InvoiceGenerator 125KB per page) |
| — | Read cache for repeat queries | 10s TTL cache on `load-invoices`, `get-transactions`, `get-expenses` |
| — | Sync-on-close | Last-chance `performSync` in `before-quit` handler |
| — | Sync status dashboard | Per-table pending counts + idle/syncing indicator in Settings |
| — | Double sync after manual trigger | Removed redundant immediate sync from `startAutoSync` |
| — | Sync queue (was silently dropped) | `pendingSync` flag retries after current sync completes |
| — | Billing summary writing during read | Computes corrected status in-memory only |
| — | Auto-sync interval too aggressive | Bumped from 5 min → 10 min; `resetAutoSyncTimer` updated to match |

### Earlier (39 resolved)
Security hardening, CI fixes, Zod validation across all endpoints, `any`/`@ts-ignore` removal, memory leaks in IPC listeners, React Error Boundary, layout caching, invoice number race condition fix, query limits on sync arrays, backend pagination.

---

## Open / Security Concerns

| # | Issue | Severity | Where |
|---|-------|----------|-------|
| 1 | `nodeIntegration: true` in print window | 🔴 Critical | `electron/ipc/print.ts` — temporary BrowserWindow with `contextIsolation: false` and `nodeIntegration: true`. Fix: switch to `contextIsolation: true` + `nodeIntegration: false` + preload script |
| 2 | `reset-all-databases` IPC is unauthenticated | 🟠 High | `electron/ipc/sync.ts` — anyone running the app can wipe both DBs. Move behind admin gate once RBAC ships |
| 3 | No unit / integration / E2E tests | 🟡 Medium | (see FEATURES_ROADMAP.md → DevOps / Testing) |

---

## Summary

| Severity | Total | Resolved | Remaining |
|----------|-------|----------|-----------|
| Critical | 7 | 7 | 1 (open) |
| Significant | 9 | 9 | 0 |
| Moderate | 12 | 12 | 0 |
| Minor | 27 | 27 | 0 |
| **Total** | **55** | **54** | **1** |
