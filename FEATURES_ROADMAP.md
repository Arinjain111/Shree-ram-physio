# Feature Checklist & Roadmap

> **Project**: Shri Ram Physio — Offline-First Physiotherapy Clinic Management
> **Stack**: Electron 39 + React 18 + TypeScript 5 + Vite 7 + Tailwind 4 + SQLite (Prisma) + PostgreSQL (cloud sync) + Express
> **Last Deep-Dive Analysis**: June 14, 2026

---

## 📋 Executive Summary

This document is the result of a deep-dive architectural audit (read of every page, IPC handler, Prisma model, and existing feature) combined with web research on leading physiotherapy clinic management software (SPRY, WebPT, ClinicSource, PhysioCare PMS, Net Health, etc.). The goal is to map out **what features will increase reuse, stickiness, and clinic efficiency** while playing to the existing strengths of this app:

- ✅ Offline-first, no-internet-required core workflow
- ✅ Bidirectional cloud sync with smart polling
- ✅ Customizable invoice templates (A4/A5, full branding)
- ✅ Inventory + expense + financial tracking
- ✅ Diagnosis N-gram autocomplete
- ✅ Auto-update + single-instance lock

The roadmap below is ordered by **impact-per-effort**, with "Quick Wins" first and "Strategic Bets" last.

---

## ✅ Implemented Features (Version 2.5.4 — Current)

### Invoice Generator
- ✅ Patient information form (name, age, gender, phone, UHID)
- ✅ Multiple treatment items with quantity and rate
- ✅ Automatic amount calculation
- ✅ Total calculation
- ✅ Invoice-level discount (amount or percentage)
- ✅ Payment method selection (Cash/Card/UPI/Online/Cheque)
- ✅ Notes/Prescription field
- ✅ Print via Windows default printer
- ✅ Save invoice data locally
- ✅ Preview before printing
- ✅ Date picker with current date default
- ✅ Form validation (Zod)
- ✅ Responsive design
- ✅ **Diagnosis autocomplete** with N-gram next-word prediction
- ✅ **Auto-add diagnosis to presets on save** (increments frequency or creates preset)
- ✅ **Smart per-patient invoice numbering** (cloud → local → fallback)
- ✅ **Edit / Duplicate / Create modes** with proper state management

### Database Find (Patient Lookup)
- ✅ Search patients by name, age, phone, invoice ID
- ✅ Display all patient records
- ✅ Group invoices by patient
- ✅ View patient details modal
- ✅ Treatment history display
- ✅ Visit count tracking
- ✅ Last visit date
- ✅ Detailed invoice view per patient
- ✅ Alphabet filter, sort options, sync-status filter
- ✅ **Treatment Calendar** component (monthly view of treatment date ranges)

### Invoice Customizer
- ✅ Clinic name, address, phone, email customization
- ✅ Doctor name and registration number
- ✅ Logo upload (base64 storage)
- ✅ Header alignment (left/center/right)
- ✅ Logo position options
- ✅ Font size options (small/medium/large)
- ✅ Border toggle
- ✅ Live preview
- ✅ Save/Load configuration as JSON
- ✅ Reset to default

### Presets Manager (Treatment & Diagnosis)
- ✅ Treatment Presets CRUD (name, default sessions, price per session)
- ✅ Diagnosis Presets CRUD with frequency counter
- ✅ Diagnosis shortcuts (text expansion, e.g. "LBP" → "Low Back Pain")
- ✅ **Search filter** for both preset lists
- ✅ Manual "Sync from Cloud" button (header-level)
- ✅ N-gram bigram + trigram model for diagnosis autocomplete

### Finances (Billing + Overview)
- ✅ Overview tab: revenue, expense, profit metrics
- ✅ Period-over-period trends
- ✅ Cash flow chart
- ✅ Top outstanding patients
- ✅ Billing tab: overdue tracker, bulk payment recording
- ✅ Status tabs: all/unpaid/partial/paid/overdue
- ✅ Expense recording with categories
- ✅ Profit & Loss statements
- ✅ Sync status dashboard

### Reports
- ✅ 5 summary cards
- ✅ 7 charts (daily revenue, payment pie, monthly composed, visit trends, top treatments, age groups, day-of-week)
- ✅ Weekly summary table
- ✅ CSV export

### Inventory
- ✅ Product/Supply tracking (stock, cost, selling price)
- ✅ Purchase (restock) and sale (outflow) recording
- ✅ Inventory transactions log
- ✅ Atomic stock updates with transactions
- ✅ Bidirectional cloud sync

### Settings
- ✅ Invoice Preferences (auto-save PDF, save location)
- ✅ Data Sync status (per-table pending counts, last sync time)
- ✅ Force full sync, reset database
- ✅ System & About (version, check for updates)

### UI/UX
- ✅ Minimal, clean design with light gradients
- ✅ Responsive layout
- ✅ Smooth transitions, professional color scheme
- ✅ Modal dialogs, form validation feedback
- ✅ Hover effects
- ✅ Unified top bar with breadcrumb + actions
- ✅ Hub-based navigation (Billing / Clinic Mgmt / Patient DB / Configuration)
- ✅ **Page-level loading skeleton** — `PageSkeleton` shimmer placeholder shown while lazy chunks resolve via `React.lazy()` + `Suspense`
- ✅ **Code-split routes** — each page is its own Rollup chunk (Home 8KB, Settings 14KB, Finances 31KB, Reports 61KB, InvoiceGenerator 125KB, etc.) for faster initial paint

### Technical & Architecture
- ✅ Electron 39+ framework
- ✅ Offline-First Architecture (SQLite via better-sqlite3 + Prisma)
- ✅ Cloud Sync (PostgreSQL / Supabase via Prisma, 10-minute smart-polling interval)
- ✅ TypeScript strict mode
- ✅ IPC communication (52 channels across 10 handlers)
- ✅ Zod validation mirrored on frontend + backend
- ✅ Print API integration
- ✅ PDF generation with auto-save
- ✅ **Idempotent `save-invoice` IPC** — finds an existing row by `invoiceNumber` and updates it instead of creating a duplicate
- ✅ **Sync self-heal** — `performSync` runs a `GROUP BY invoice_number HAVING COUNT(*) > 1` cleanup at startup; `applyCloudUpdates` deletes sibling duplicates before each update
- ✅ **Immutable invoice numbers** — both upload and apply phases refuse to rewrite a printed `invoiceNumber`
- ✅ **Numeric sort on `invoiceNumber`** in `get-next-invoice-number` — `CAST(invoice_number AS INTEGER) DESC` so legacy non-padded rows can't out-sort padded ones
- ✅ Error handling with normalized errors
- ✅ Structured logger (JSON + human modes, field redaction, toast bridge)
- ✅ HTTP access log middleware
- ✅ React ErrorBoundary
- ✅ Auto-update via electron-updater
- ✅ Single-instance lock
- ✅ Smart polling sync engine
- ✅ Sync deduplication (4-way patient match)
- ✅ Immutable invoice numbers (cloud cannot mutate)
- ✅ In-memory read cache for hot endpoints
- ✅ Express backend with helmet, CORS, rate limiting (3 tiers)

---

## 🟢 Quick Wins (High Impact, Low Effort — v2.6 / Q3 2026)

These features reuse existing schemas (where they already exist) or add a focused module without architectural changes.

### 1. 🩺 Treatment Session Tracking (use existing `TreatmentSession` table)
- **Why**: Schema already has `painBefore`, `painAfter`, `exercisesPerformed`, `attended`, `rescheduledDate` — but no UI.
- **What to build**:
  - "Sessions" tab inside `PatientDetailPane` showing all sessions for a treatment
  - Per-session modal to log attendance, pain scale (0-10), exercises, progress
  - Visual pain-trend chart (line chart over time)
  - Mark session as cancelled / rescheduled
- **Impact**: Turns the app from a billing tool into a true clinical tool. The single biggest gap.

### 2. 🗂️ Patient Document Attachments
- **Why**: Roadmap lists it. PT clinics deal with MRI reports, X-rays, doctor's notes.
- **What to build**:
  - New `PatientDocument` table (id, patientId, fileName, mimeType, base64/pdf, category, uploadedAt)
  - Upload via file picker (drag-drop) inside `PatientDetailPane`
  - Store on disk in `userData/patient-docs/{patientId}/`
  - View/download documents, no in-app viewer
- **Impact**: Centralized records.

### 3. 📤 CSV Export for Patient List & Invoice List
- **Why**: Reports page already exports charts. Patient/invoice lists don't.
- **What to build**:
  - "Export CSV" button on `DatabaseFind` and `Finances` (billing tab)
  - Reuse the CSV utility from `Reports.tsx`
- **Impact**: Compliance, accounting integration.

### 5. 🧪 Bulk CSV Import (Patients)
- **Why**: Migration from paper records.
- **What to build**:
  - Settings → "Import Patients from CSV" with template download
  - Validate each row via Zod, show preview, commit
- **Impact**: Onboarding speed.

---

## 🟡 Medium-Term (Strategic — v2.7-v3.0)

These are larger features that may require schema changes, new pages, or backend work.

### 14. 📜 Audit Trail / Activity Log
- **Why**: Medical data needs compliance trail. Only `SyncLog` exists today.
- **What to build**:
  - New `AuditLog` table (id, userId?, action, entity, entityId, before, after, ip, timestamp)
  - Hook into every IPC mutation (create/update/delete)
  - `/audit-log` admin page with filters
  - Backend mirrors the log
- **Impact**: Compliance, debugging, security.

### 15. 📲 Patient Communication (SMS / WhatsApp)
- **Why**: Every competitor lists this. India especially loves WhatsApp.
- **What to build**:
  - Integration with **WhatsApp Business API** (via Meta or providers like Wati / Interakt)
  - **Triggered messages**:
    - Payment receipt
    - marketing messages
  - Settings → "WhatsApp API Key" configuration
  - "Send manual message" button on patient detail
- **Impact**: Huge reduction in no-shows. Industry-standard now.

### 21. 📋 Insurance / TPA Claims (if India → later)
- **Why**: Cash-based + insurance models differ. Many Indian clinics want both.
- **What to build**:
  - Add `InsuranceProvider`, `Policy`, `Claim` tables
  - Eligibility check API
  - Claim submission workflow
  - Track claim status (submitted/approved/rejected/paid)
- **Impact**: New revenue segment.

### 22. 🔄 Database Backup / Restore
- **Why**: Single SQLite file = single point of failure.
- **What to build**:
  - Settings → "Backup Database" → save `.db` file with timestamp
  - Scheduled auto-backup (every week to `userData/backups/`)
  - "Restore from backup" with confirmation
- **Impact**: Disaster recovery.

### 25. 📡 Offline Queue Management & Conflict Resolution
- **Why**: Sync engine works, but no UI for "what happened during offline".
- **What to build**:
  - Settings → "Sync History" with detailed log of every push/pull
  - Visual indicator on records (cloud-pending / synced / conflict)
  - Manual conflict resolution UI (rare, but needed)
- **Impact**: Trust in the sync.

### 27. 📊 Advanced Analytics & BI
- **What to build**:
  - Cohort analysis (retention by month of first visit)
  - Patient lifetime value (LTV)
  - Treatment effectiveness score (pain delta vs. cost)
  - Funnel: inquiry → first visit → package → repeat
  - Predictive revenue forecast (simple linear regression)
- **Impact**: Strategic decision-making.

### 28. 🏷️ Barcode / QR Code on Invoice
- **What to build**:
  - Generate QR with UPI payment deep link
- **Impact**: Modern, paperless.

---

## 🛠️ Technical Debt & Infrastructure (Continuous)

### Frontend

#### Routing & Loading
- ✅ React ErrorBoundary — catches render errors and routes them through the structured logger
- ✅ Toast Notification System (auto-dismiss, stacking) — `UIProvider` raises toasts from the new `useLogger().error(...)` automatically
- ✅ **Page-level code splitting** — every page is wrapped in `React.lazy()` and a `<Suspense>` boundary in `App.tsx`; `PageLoader` shows the `PageSkeleton` while each chunk is being fetched
- ✅ **PageSkeleton** — full-width shimmer placeholder (header + grid content) shown while lazy chunks resolve

#### Performance & Build
- ✅ **Lazy chunk split** per page (verified via `npm run build:vite` — `Home 8KB`, `Settings 14KB`, `Finances 31KB`, `Reports 61KB`, `InvoiceGenerator 125KB`, etc.)
- ✅ **Bundle size analysis** — `rollup-plugin-visualizer` wired into `vite.config.ts` (dynamic-imported to dodge the CJS/ESM clash); `npm run analyze` emits `dist/stats.html` as a treemap with gzip + brotli sizes. Verified: 723KB stats.html with all chunks + node_modules
- ✅ **Route-level preload on hover/idle** — `HubLayout` calls `preloaders[tab.path]?.()` on `onMouseEnter` and `onFocus`; the fire-and-forget `import()` lands the chunk in the module cache before the user clicks
- ⬜ **Asset preloading hints** — add `<link rel="modulepreload">` for the chunks of the current hub on initial paint

#### State & Data
- ✅ Custom hooks (`useInvoiceForm`, `useInvoicePrinter`, `useSyncManager`, `useErrorHandler`, `useAutoUpdater`, `useInvoiceLayout`) — heavy logic kept out of components
- ✅ **Custom-hooks barrel** — `src/hooks/index.ts` re-exports all hooks so pages do `import { useInvoiceForm } from '@/hooks'`
- ⬜ **React Query / SWR for IPC reads** — currently every page re-fetches on mount via raw `ipcRenderer.invoke`; a small cache layer (or even a manual `useQuery`-style hook) would dedupe `load-invoices` / `load-patients` calls across pages and keep the UI snappy when navigating back
- ⬜ **Mutations invalidate cache** — when `save-invoice` / `record-payment` succeeds, the matching query should be invalidated, not just reloaded via the `invoices-updated` window event

#### UX & Accessibility
- ✅ **Accessibility audit (partial)** — `aria-label` added to icon-only buttons across Pagination (First/Prev/Next/Last), InvoiceHistoryCard (Edit/Reissue/Print/Delete), PatientDetailModal (Delete), UpdateBanner (Dismiss), TreatmentSettings (Edit/Delete on both tabs), InvoiceGenerator (refresh invoice number, with state-aware label), HubLayout (back-home)
- ⬜ **Focus traps in modals** — PaymentModal, PatientDetailModal still need a focus-trap so Tab cycles inside the dialog
- ⬜ **Live regions for toast queue** — wrap the toast container in `aria-live="polite"` / `aria-atomic="true"` so screen readers announce new toasts
- ⬜ **Print preview improvements** — page-break accuracy for long treatment lists, A5 support is already plumbed through `useInvoicePrinter` and `LayoutConfig.paperSize`; need to surface the live-preview pane in the chosen paper size

#### Testing & Quality
- ⬜ **Unit tests** — Vitest + React Testing Library; start with `useInvoiceForm` (form state machine) and `useSyncManager` (debouncing, event listener cleanup)
- ⬜ **E2E tests** — Playwright with Electron; cover "save invoice → see in Database Find → pay partial → see in Finances"

#### Security Hardening
- ⬜ **Fix `nodeIntegration: true` in print window** — `electron/ipc/print.ts` creates a temporary `BrowserWindow` with `contextIsolation: false` and `nodeIntegration: true`. Switch to `contextIsolation: true` + `nodeIntegration: false` + a preload script that exposes only `print` / `pdf` via contextBridge
- ✅ **CSP header for the renderer** — `<meta http-equiv="Content-Security-Policy">` in `index.html`: `default-src 'self'`, no inline-object/frame, `connect-src 'self' https:` (for the cloud sync API), `frame-ancestors 'none'`, `base-uri 'self'`, plus `strict-origin-when-cross-origin` referrer

#### Refactors & Hygiene
- ✅ **Extract custom-hooks barrel** — `src/hooks/index.ts` so pages can `import { useInvoiceForm } from '@/hooks'`
- ⬜ **Type tightening** — replace `any` returns in the data-loading `useEffect`s with proper `InvoiceData[]` / `DatabaseInvoice[]` types; the Zod schemas are already the source of truth, just need the IPC response types to use them

### Backend
- ✅ Structured Logging with redaction (in-house `logger` with JSON / human modes, level filtering, `with/child/time`)
- ✅ Zod validation on all IPC handlers — mirrored on frontend + backend
- ✅ 3-tier rate limiting (sync 30/15min, standard 100/15min, reset 5/hour)
- ✅ HTTP access log middleware — single line per request (IP, method, URL, status, duration)
- ⬜ **API Versioning** (`/api/v1/` prefix) — lets us evolve the contract without breaking older Electron builds
- ⬜ **Health Check enhancements** — extend `/health` to report DB row counts, last sync timestamp, disk free in `userData`, sync engine state
- ⬜ **Database Indexing optimization** — add `@@index` on `Invoice.date`, `Invoice.paymentStatus`, `Patient.phone`, `Patient.uhid`, `Patient.cloudId`, `Treatment.invoiceId`, `syncStatus` (most are already there for relations; add the rest)
- ⬜ **Graceful Degradation for Sync Failures** — when the backend is down, queue mutations locally and retry with exponential backoff; surface a non-blocking "Sync paused — will retry in Ns" toast instead of an error
- ⬜ **Database Migration strategy** — zero-downtime for additive changes, plan for non-additive changes (column drops, type changes) with shadow columns + dual-writes
- ⬜ **Per-clinic API keys** — current `AZURE_BACKEND_URL` uses a single static key; rotate to per-clinic keys when RBAC lands (issue #13 in the Medium-Term section)
- ⬜ **Response compression** — `compression` middleware on Express for `load-invoices` / `load-patients` payloads (largest endpoints)

### Database
- ⬜ **Soft delete** — `deletedAt DateTime?` on Patient / Invoice / TreatmentPreset / DiagnosisPreset; replace `prisma.x.delete()` with `update({ where: { id }, data: { deletedAt: now() } })` and filter reads by `deletedAt: null`
- ⬜ **Audit columns on every table** — `createdAt` / `updatedAt` already on most, double-check Inventory and InventoryTransaction; add `createdBy` / `updatedBy` once RBAC ships
- ⬜ **Foreign-key enforcement** — SQLite needs `PRAGMA foreign_keys = ON` per connection; verify the driver-adapter setup actually emits it
- ⬜ **Encrypt at rest** — switch to SQLCipher for the local DB; protects patient PII if the laptop is stolen

### Security
- ⬜ Audit trails (see Quick Win #14 in the Medium-Term section)
- ⬜ **Print-window `nodeIntegration` flag** — `electron/ipc/print.ts` still uses `contextIsolation: false` and `nodeIntegration: true` for the OS print dialog. Switch to a preload script that exposes only `print` / `pdf` via `contextBridge`
- ✅ **Renderer CSP** — added a strict `Content-Security-Policy` meta tag in `index.html` (`default-src 'self'`, no inline-object/frame, `connect-src 'self' https:` for the cloud sync API, `frame-ancestors 'none'`, `base-uri 'self'`, plus `strict-origin-when-cross-origin` referrer). The print-window fix is still pending; once it lands, the CSP should also be tightened to drop `'unsafe-inline'` for `script-src` (currently allowed only for the critical startup error handler)
- ⬜ **Dependency scanning** — `npm audit` in CI; Dependabot auto-PRs for patch updates
- ⬜ **Secret rotation** — `API_KEY` and any cloud creds should be rotatable without a full app release

### DevOps / Testing
- ⬜ **Unit tests** — Vitest + React Testing Library; start with `useInvoiceForm` (form state machine), `useSyncManager` (debouncing, event listener cleanup), and the `prismaSyncEngine` dedup logic
- ⬜ **Integration tests for IPC handlers** — spin up a temp Prisma + SQLite, invoke each `ipcMain.handle('save-invoice', …)` etc. and assert DB state
- ⬜ **E2E tests** — Playwright with Electron; cover "save invoice → see in Database Find → pay partial → see in Finances → sync → see in cloud"
- ⬜ **CI pipeline** — GitHub Actions: lint + typecheck + test on every PR; build on tag push is already wired (`electron-release.yml`)
- ⬜ **Pre-commit hook** — `husky` + `lint-staged` for ESLint / Prettier on staged files
- ⬜ **Coverage gates** — fail PRs that drop below 70% line coverage on touched files
- ⬜ **Sentry / error reporting** — pipe `useLogger().error(...)` into Sentry in production builds so the team gets paged on new error patterns

---

## 🐛 Bug Fixes & Known Issues

### Resolved
- ✅ **Sync deduplication** — 4-way patient match prevents infinite duplicates
- ✅ **Finances page crashes** — Date handling, rendering, Tailwind class fixes
- ✅ **Diagnosis autocomplete** — Wired N-gram model in Invoice Generator
- ✅ **Inventory sync & validation** — Bidirectional sync + Zod
- ✅ **Payment status dropdown reverts to Unpaid** — was a derived `let` variable; now stored as explicit `useState` with a one-time auto-detect for the invoice-loading case
- ✅ **Sync crash on duplicate `invoice_number`** — `save-invoice` is now idempotent; `performSync` self-heals at startup; `applyCloudUpdates` deletes sibling duplicates before each update
- ✅ **Manual invoice number edit silently overwritten** — patient-change useEffect and `invoices-updated` listener now respect the `invoiceNumberEdited` ref; refresh button is the only way to force-overwrite
- ✅ **Wrong "next invoice number" for non-padded legacy rows** — `get-next-invoice-number` now sorts with `CAST(invoice_number AS INTEGER) DESC`

### Security Concerns (from deep dive)
- ⚠️ **`nodeIntegration: true` in print window** — `electron/ipc/print.ts` creates a temporary BrowserWindow with `contextIsolation: false` and `nodeIntegration: true`. **Fix immediately** to `contextIsolation: true` and `nodeIntegration: false`, use preload script.

### To Be Tested
- Network connectivity edge cases
- Long sync pauses (24h+ offline)
- Very large datasets (10k+ invoices)
- Concurrent edits from multiple devices
- Page lazy-load under slow CPU / first-paint timing

---

## 💡 User-Requested / Future Ideas (Backlog)

*This section captures ideas from the deep-dive that don't fit a specific release*

- Treatment outcome measurement (Oswestry, DASH, FMS scoring)
- Inventory expiry date tracking (for consumables)
- Treatment consent forms (digital signature)
- Pre/post treatment photos with measurement overlays
- Pain scale heatmap (body diagram)

---

## 📊 Performance Goals

### Current (v2.5.5)
- Startup time: < 3 seconds
- Search response: < 100ms
- Print dialog: < 1 second
- Data save: < 500ms
- Offline mode: Fully operational without network
- **Page cold paint**: skeleton visible immediately, real page in < 100ms after chunk arrives (cached on subsequent visits)

### Target (v3.0)
- Search across large datasets: < 200ms
- Cloud sync: < 5 seconds
- Report generation: < 2 seconds
- App cold start: < 2 seconds (now realistic thanks to per-page code splitting — main bundle dropped from one monolithic chunk to ~200KB + 8-125KB lazy chunks)
- Memory footprint: < 300 MB

---

## 🔐 Security Enhancements Roadmap

| Phase | Feature | Priority |
|---|---|---|
| **Now** | Fix `nodeIntegration: true` in print window | 🔴 Critical |
| **v2.7** | Audit log table | 🟡 Medium |

---

## 📱 Platform Expansion Roadmap

| Phase | Platform | Status |
|---|---|---|
| **Current** | Windows desktop | ✅ Live |

---

## 🏆 Strategic Bets (Highest ROI for Reusability)

If you can only build 3 things in the next 6 months, build these:

### 🥇 1. Treatment Session Tracking
- **Why**: Turns the app from "billing" into "clinical workflow". Highest user stickiness.
- **Effort**: 2-3 weeks (UI + use existing schema)
- **Reuse**: PatientDetailPane, TreatmentCalendar, existing `TreatmentSession` table
- **Revenue impact**: Clinics won't churn because clinical data is locked in.

### 🥉 2. WhatsApp / SMS Integration
- **Why**: Massive reduction in no-shows, modern expectation.
- **Effort**: 1-2 weeks (integration with Wati/Interakt)
- **Reuse**: Existing patient phone numbers, scheduled jobs in sync engine
- **Revenue impact**: Direct revenue retention.

---

## 🎯 Anti-Features (What NOT to Build)

Sometimes the best roadmap is what you don't build:

- ❌ **AI chat assistant for patients** — Premature, high support cost
- ❌ **Blockchain for medical records** — Hype, not real demand
- ❌ **AR/VR for exercises** — Cool demo, no clinic will pay
- ❌ **Voice-controlled UI** — Privacy concerns, unreliable
- ❌ **Full HL7/FHIR compliance** — Massive effort, only needed for hospital integrations
- ❌ **Custom report builder** — Many "advanced" features are rarely used; stick to fixed reports
- ❌ **Native Windows tray utility** — Electron has limitations; users prefer one app

---

## 📚 Documentation Roadmap

### Completed
- ✅ README.md
- ✅ Quick Start Guide
- ✅ Invoice Template Reference
- ✅ Sample Data

---

## 🏁 Final Recommendations

**For the next 90 days**, focus on:
1. Fix the security issues (`nodeIntegration`, reset IPC) — 1 day
2. Ship **Quick Win #1: Treatment Session Tracking** — 2-3 weeks
3. Build the foundation for **#13: RBAC** — parallel track

**For the next 180 days**, add:
4. **Quick Win #5: WhatsApp/SMS** (huge retention)
5. **Quick Win #3: Treatment Packages** (recurring revenue)
6. **Quick Win #7: Patient Document Attachments** (clinical completeness)

**For the next 365 days**, lay the foundation for v3.0:
7. Multi-branch (architectural changes pay off later)

**Why this order?**
- Quick wins ship fast → user delight → retention
- Clinical depth (sessions, packages) is the moat that prevents churn
- Multi-user / RBAC unlocks enterprise sales
- Web + payments unlock 10x addressable market
- AI / mobile is "nice to have" but not yet table stakes

---

*Last Updated: June 14, 2026 (v2.5.5 — bundle visualizer, route preload, CSP, a11y labels, hooks barrel)*
