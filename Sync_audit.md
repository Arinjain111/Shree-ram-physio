# Sync Architecture Audit — Redundancies, Races & Waste

> **Date:** June 8, 2026  
> **Scope:** All sync triggers, event listeners, page-level data loading, and timer behavior across the Electron app.

---

## Top-Line Findings

| Category | Count |
|----------|-------|
| Redundant data loads | 7 |
| Race conditions | 5 |
| Unnecessary backend calls | 3 |
| Dead code files | 2 |

---

## 1. Every Page Re-Fetches Everything (No Shared Cache)

Navigating between pages causes fresh full-table scans every time. No in-memory cache exists between page mounts.

| Data Call | Pages That Call It |
|-----------|---------------------|
| `load-invoices` | Finances, Reports, DatabaseFind, InvoiceGenerator (4 pages) |
| `get-billing-summary` | Finances (re-reads ALL invoices internally) |
| `get-inventory-transactions` | Finances, Reports, Inventory (3 pages) |

**Impact:** Opening Finances reads the entire invoice table **twice** (`load-invoices` + `get-billing-summary` internally does its own `findMany`). Navigating to Reports after Finances reads it again. Every page transition = full table scan.

---

## 2. Double Sync After Every Manual Trigger

**File:** `Frontend/electron/sync/prismaSyncEngine.ts`

When a user manually clicks "Cloud Sync":
1. `sync-now` → `performSync(true)` runs
2. On completion → `resetAutoSyncTimer(5min)` is called
3. `resetAutoSyncTimer` → `stopAutoSync()` + `startAutoSync()`
4. `startAutoSync()` **immediately calls `performSync()`** on line 44

So every manual sync is immediately followed by a second, unnecessary sync. The second sync's `shouldSync()` will still hit `/api/sync/status` (an HTTP call to Supabase) before realizing nothing is pending.

---

## 3. `get-billing-summary` Writes the Database During a Read

**File:** `Frontend/electron/ipc/invoices.ts:624-637`

When `get-billing-summary` is called (which happens on every Finances page mount), it loops through ALL invoices recomputing `paymentStatus`. If the computed status differs (e.g., today's date makes an invoice "overdue"), it writes to the database and sets `syncStatus: 'PENDING'`.

This means simply **viewing** the Finances page can mark records as needing sync. If auto-sync fires at the same time, there's a read-write race on the invoice table.

---

## 4. One Delete = Three Separate IPC Calls

**Files:** `PatientDetailPane.tsx`, `InvoiceHistoryCard.tsx`, `DatabaseFind.tsx`, `useSyncManager.ts`

When a user deletes a patient or invoice:
1. The delete handler dispatches `invoices-updated` CustomEvent
2. **Listener 1** (DatabaseFind.tsx:93) → calls `loadInvoices()` (full scan)
3. **Listener 2** (useSyncManager.ts:79) → calls `loadDatabaseStats()` (counts everything)
4. **Listener 3** (useInvoiceForm.ts:241, if mounted) → calls `load-invoices` + `fetchInvoiceNumber`

Three separate IPC calls fire from one user action, most reading the same data.

---

## 5. Sync Guard Silently Drops Concurrent Requests

**File:** `Frontend/electron/sync/prismaSyncEngine.ts:135-137`

```ts
if (this.isSyncing) {
  return { success: false, message: 'Sync already in progress' };
}
```

No queue. No retry. If the 5-minute auto-sync fires while the user just triggered a manual sync from `useInvoiceForm.ts:334` (save-invoice), the user-initiated sync is silently swallowed by `.catch(() => {})`. The only recovery is waiting for the next cycle.

---

## 6. `get-sync-status` Handler Exists but is Never Called

**File:** `Frontend/electron/ipc/sync.ts:64`

The handler `get-sync-status` is defined and wired to IPC, but no renderer code ever calls `ipcRenderer.invoke('get-sync-status')`. The sync status is only obtained from `sync-now` return values. The handler code and its `$transaction` counts (7 queries) are dead weight.

---

## 7. Legacy SyncEngine is Dead Code

| File | Detail |
|------|--------|
| `Frontend/electron/sync/syncEngine.ts` | Old non-Prisma sync engine. Not imported by any IPC handler. ~100 lines. |
| `Frontend/electron/types/sync.types.ts` | Types for the legacy engine — unused. |

The active sync engine is `prismaSyncEngine.ts`. These files are never imported.

---

## 8. Race Conditions Summary

| # | Severity | What Happens |
|---|----------|--------------|
| RC-1 | Medium | Save-invoice → `sync-now` + `invoices-updated` event fire near-simultaneously, causing overlapping data reloads |
| RC-2 | Medium | `get-billing-summary` writes to DB while auto-sync might be reading the same rows |
| RC-3 | Low | No lockout prevents manual sync during database reset |
| RC-4 | Low | Immediate second `performSync()` after manual trigger (section 2) |
| RC-5 | Medium | Single delete triggers 3 separate IPC calls reading the same data |

---

## 9. Recommended Fixes (Priority Order)

### High Impact
1. **Remove immediate `performSync()` from `startAutoSync`** — line 44 of `prismaSyncEngine.ts`. Let the interval fire naturally. Manual sync should just restart the clock, not trigger a redundant cycle.
2. **Add in-memory data cache** — A simple module-level cache for `load-invoices`, `get-inventory-transactions`, and `get-expenses` results. Invalidate on sync completion, mutation, or after a TTL (e.g., 30 seconds). Prevents 4 pages from doing the same full-table scan.
3. **Make `get-billing-summary` read-only** — Don't write `syncStatus: 'PENDING'` from a read operation. Move the status-correction logic to a background job or to the sync engine itself.

### Medium Impact
4. **Queue concurrent sync requests** — Instead of silently dropping with "already in progress", set a `pendingSync` flag and run after the current sync completes.
5. **Consolidate `invoices-updated` listeners** — Have one listener in `useSyncManager` that broadcasts to all subscribers, instead of each component independently calling `load-invoices`.
6. **Remove legacy SyncEngine files** — `syncEngine.ts` and `sync.types.ts` have been dead code since the Prisma migration.

### Low Impact
7. **Remove unused `get-sync-status` IPC handler** — Or wire it up in the UI to show "Last synced X minutes ago" in the toolbar.
8. **Add sync-lock during database reset** — Reject `sync-now` calls while `reset-all-databases` is running.

---

*Analysis performed June 8, 2026. See recommended fixes above for remediation.*
