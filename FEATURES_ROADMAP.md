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

### Technical & Architecture
- ✅ Electron 39+ framework
- ✅ Offline-First Architecture (SQLite via better-sqlite3 + Prisma)
- ✅ Cloud Sync (PostgreSQL / Supabase via Prisma)
- ✅ TypeScript strict mode
- ✅ IPC communication (52 channels across 10 handlers)
- ✅ Zod validation mirrored on frontend + backend
- ✅ Print API integration
- ✅ PDF generation with auto-save
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

### 2. 📅 Appointment Scheduling / Calendar
- **Why**: Every competitor has it. The roadmap lists it under "Future Enhancements" but never built.
- **What to build**:
  - New `Appointment` table (id, patientId, dateTime, durationMin, status, notes, treatmentId?)
  - `/appointments` page with weekly/monthly calendar view
  - Color-coded by status (scheduled/completed/cancelled/no-show)
  - Click empty slot to book; click appointment to view/edit
  - Show in patient detail pane as a "Next visit" badge
- **Impact**: Daily-use feature, every clinic needs it.

### 3. 📋 SOAP Notes (Subjective, Objective, Assessment, Plan)
- **Why**: Industry standard for PT clinical documentation. Reuse the `SessionNoteTemplate` table that already exists.
- **What to build**:
  - Rich-text SOAP note editor inside treatment session
  - Save SOAP notes per treatment (or per session)
  - Quick-pick from `SessionNoteTemplate` snippets
  - Print/export SOAP note as PDF
- **Impact**: Clinical credibility, medico-legal protection.

### 4. 📦 Treatment Packages
- **Why**: Recurring revenue model. Patients buy 10/20-session packages; auto-decrement per visit.
- **What to build**:
  - New `Package` table (id, patientId, totalSessions, usedSessions, price, expiresAt, status)
  - `/packages` page (or section in patient detail) to sell/redeem
  - When a session invoice is created, optionally consume one package credit
  - Alert when package is nearing expiry or fully used
- **Impact**: Better cash flow, customer retention, fewer billing disputes.

### 5. 💊 Digital Prescription / Exercise Plan
- **Why**: A printed invoice is not a prescription. Therapists need to give patients home exercises.
- **What to build**:
  - Add `prescription` JSON field to Invoice (exercises, dosage, frequency, duration)
  - Standard prescription template with sections (Medications, Exercises, Precautions, Follow-up)
  - Print as separate "Prescription Slip" with clinic letterhead
  - Optional: export as PDF
- **Impact**: High utility, low cost.

### 6. 🔔 In-App Reminders & To-Do
- **Why**: Free productivity boost, no third-party service needed.
- **What to build**:
  - Lightweight `Todo` table (id, title, dueDate, priority, completed, assignedTo)
  - Simple `/todos` page
  - Header bell icon with count of overdue items
  - Quick-add from anywhere
- **Impact**: Daily driver feature, sticky engagement.

### 7. 🗂️ Patient Document Attachments
- **Why**: Roadmap lists it. PT clinics deal with MRI reports, X-rays, doctor's notes.
- **What to build**:
  - New `PatientDocument` table (id, patientId, fileName, mimeType, base64/pdf, category, uploadedAt)
  - Upload via file picker (drag-drop) inside `PatientDetailPane`
  - Store on disk in `userData/patient-docs/{patientId}/`
  - View/download documents, no in-app viewer
- **Impact**: Centralized records.

### 8. 📤 CSV Export for Patient List & Invoice List
- **Why**: Reports page already exports charts. Patient/invoice lists don't.
- **What to build**:
  - "Export CSV" button on `DatabaseFind` and `Finances` (billing tab)
  - Reuse the CSV utility from `Reports.tsx`
- **Impact**: Compliance, accounting integration.

### 9. ⌨️ Keyboard Shortcuts
- **Why**: Power-user feature, almost zero cost.
- **What to build**:
  - `Ctrl+N` → New invoice
  - `Ctrl+P` → Print
  - `Ctrl+S` → Save
  - `Ctrl+F` → Focus search
  - `Esc` → Close modal
  - Show overlay on first launch with `?`
- **Impact**: Speed.

### 10. 🌗 Dark Mode
- **Why**: Free UX win, Tailwind already has dark: prefix everywhere.
- **What to build**:
  - Toggle in Settings → "Theme: Light / Dark / System"
  - Persist in `userData/settings.json`
  - All pages already use slate-* which has dark equivalents
- **Impact**: Modern feel, easy to ship.

### 11. 🧪 Bulk CSV Import (Patients)
- **Why**: Migration from paper records.
- **What to build**:
  - Settings → "Import Patients from CSV" with template download
  - Validate each row via Zod, show preview, commit
- **Impact**: Onboarding speed.

### 12. 📈 Inventory Low-Stock Alerts
- **Why**: The data is already there. Just needs a UI.
- **What to build**:
  - Inventory page: red badge on items below `reorderLevel`
  - Settings → "Low-stock threshold per item" (add `reorderLevel` field to `InventoryItem`)
  - Toast on app open if any items are low
- **Impact**: Avoid stockouts.

---

## 🟡 Medium-Term (Strategic — v2.7-v3.0)

These are larger features that may require schema changes, new pages, or backend work.

### 13. 🔐 Authentication & Role-Based Access Control (RBAC)
- **Why**: Currently anyone with the app can do anything. For multi-user clinics this is critical.
- **What to build**:
  - Add `User` table (id, username, passwordHash, role, lastLoginAt)
  - Roles: `admin` (full), `receptionist` (billing only), `therapist` (clinical notes, no billing), `viewer` (read only)
  - Login screen at app launch
  - Hash passwords with bcrypt, store JWT in main process
  - Per-page role guards (e.g. Settings = admin only)
  - Backend: `requireRole(role)` middleware
- **Impact**: Required for any multi-user deployment; big enterprise unlock.

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
    - Appointment confirmation (24h before)
    - Reminder (2h before)
    - Payment receipt
    - Birthday wish
    - Package expiry alert
  - Settings → "WhatsApp API Key" configuration
  - "Send manual message" button on patient detail
- **Impact**: Huge reduction in no-shows. Industry-standard now.

### 16. 🌐 Web Portal / Browser Access
- **Why**: Patients want to book from phone. Recept. wants to check on tablet.
- **What to build**:
  - Express backend already exists → add React-based web client
  - Subset of features: book appointment, view history, pay online, download invoice
  - Host on same Azure App Service alongside API
  - Share Postgres DB; Electron app uses local SQLite + sync as today
- **Impact**: 5x addressable users. Big differentiator.

### 17. 💳 Online Payments (Razorpay / Stripe)
- **Why**: India is UPI-first. Patients want to pay via PhonePe/GPay/Paytm from the invoice.
- **What to build**:
  - Integrate **Razorpay** (best India coverage) on the backend
  - On invoice: "Pay Online" button → opens QR/deep link
  - Backend webhook updates invoice `paymentStatus` and `amountPaid`
  - Auto-print receipt after success
- **Impact**: Faster collection, better UX.

### 18. 🏥 Multi-Branch / Multi-Location
- **Why**: Roadmap says ⬜. Larger clinics have 2-5 branches.
- **What to build**:
  - Add `Branch` table (id, name, address, phone, logo, headerColor)
  - All entities get `branchId`
  - "Switch branch" selector in header
  - Per-branch reports and dashboards
  - Per-branch customizations (logo, color) - reuses InvoiceCustomizer
- **Impact**: Enterprise-ready.

### 19. 📱 Mobile App (Companion)
- **Why**: Therapists want to log notes from the patient's side.
- **What to build**:
  - React Native or Capacitor app
  - Read-only access to assigned patients' schedules
  - Quick SOAP note entry, exercise logging
  - Push notifications for new appointments
- **Impact**: Therapist productivity.

### 20. 🧠 AI-Powered Features
- **Why**: Industry trend. Existing diagnosis N-gram is a start.
- **What to build**:
  - **AI Scribe**: Voice → SOAP note (use Whisper API)
  - **Smart Diagnosis**: Suggest differential diagnoses based on patient history
  - **Treatment Recommendation**: Suggest treatment plans from historical data
  - **Invoice Anomaly Detection**: Flag unusual charges
  - **Chatbot**: Patient-facing Q&A
- **Impact**: Modern, differentiating.

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
  - Scheduled auto-backup (daily to `userData/backups/`)
  - "Restore from backup" with confirmation
  - Optional: upload backup to cloud (Azure Blob)
- **Impact**: Disaster recovery.

### 23. 🌍 Multi-Language Support (i18n)
- **Why**: India has 22 official languages. Other countries too.
- **What to build**:
  - i18next integration
  - English + Hindi to start
  - Language switcher in Settings
  - Persist preference
- **Impact**: Geographic expansion.

### 24. 🧾 GST / Tax Support
- **Why**: Roadmap says ⬜. Indian clinics need GST invoices (CGST/SGST/IGST).
- **What to build**:
  - Add `taxRate`, `taxType`, `taxAmount` to Invoice and Treatment
  - Settings → "Default tax rate" + HSN/SAC code per treatment preset
  - Tax reports: monthly GST return, GSTR-1 export
- **Impact**: Legal compliance for many clinics.

### 25. 📡 Offline Queue Management & Conflict Resolution
- **Why**: Sync engine works, but no UI for "what happened during offline".
- **What to build**:
  - Settings → "Sync History" with detailed log of every push/pull
  - Visual indicator on records (cloud-pending / synced / conflict)
  - Manual conflict resolution UI (rare, but needed)
- **Impact**: Trust in the sync.

### 26. 🔌 Third-Party Integrations
- **Google Calendar**: Sync appointments
- **Tally / Zoho Books**: Export daily invoices
- **Email (SendGrid / AWS SES)**: Send PDF receipts to patient email
- **Google Drive / Dropbox**: Auto-backup PDF invoices
- **Twilio SMS**: Fallback if WhatsApp not available
- **Zapier / Webhooks**: For advanced users

### 27. 📊 Advanced Analytics & BI
- **What to build**:
  - Cohort analysis (retention by month of first visit)
  - Patient lifetime value (LTV)
  - Treatment effectiveness score (pain delta vs. cost)
  - Therapist performance scorecard
  - Funnel: inquiry → first visit → package → repeat
  - Predictive revenue forecast (simple linear regression)
- **Impact**: Strategic decision-making.

### 28. 🏷️ Barcode / QR Code on Invoice
- **What to build**:
  - Generate QR with UPI payment deep link
  - Generate barcode with invoice number for scanning
  - Patient loyalty card with QR
- **Impact**: Modern, paperless.

### 29. 📃 Credit / Debit Notes
- **Why**: Roadmap says ⬜. Required for returns and adjustments.
- **What to build**:
  - New `CreditNote` and `DebitNote` tables linked to original Invoice
  - Generate, apply, track
- **Impact**: Accounting accuracy.

### 30. 👥 Referral Tracking
- **What to build**:
  - Add `referralSource` enum to Patient (Google, Doctor, Word-of-mouth, etc.)
  - Add `referringDoctor` field
  - Report: top referral sources
  - Auto-commission calculation for referring doctors
- **Impact**: Marketing ROI.

---

## 🛠️ Technical Debt & Infrastructure (Continuous)

### Frontend
- ✅ React ErrorBoundary
- ✅ Toast Notification System (auto-dismiss, stacking)
- ⬜ Print Preview improvements (page break accuracy)
- ⬜ Bundle size analysis (vite-plugin-visualizer)
- ⬜ React.lazy for page-level code splitting
- ⬜ Service worker for PWA support
- ⬜ Fix `nodeIntegration: true` in print window (security risk)

### Backend
- ✅ Structured Logging with redaction
- ⬜ API Versioning (`/api/v1/` prefix)
- ⬜ Health Check enhancements (DB, disk, sync)
- ✅ Zod validation on all IPC handlers
- ⬜ Database Indexing optimization (add indices on date, phone, patientId, syncStatus)
- ⬜ Graceful Degradation for Sync Failures (queue locally, retry with backoff)
- ⬜ Database Migration strategy (zero-downtime, rollbacks)

### Database
- ⬜ Encrypt SQLite at rest (SQLCipher)
- ⬜ Soft delete instead of hard delete
- ⬜ Add `createdAt` / `updatedAt` to all tables
- ⬜ Add `branchId` for multi-tenant future
- ⬜ Foreign key constraint enforcement (currently off in SQLite)

### Security
- ⬜ Audit trails (see #14)
- ⬜ Encryption at rest for sensitive fields
- ⬜ 2FA for login
- ⬜ Session timeout

### DevOps / Testing
- ⬜ Unit tests (Vitest) — start with `useInvoiceForm`, sync engine
- ⬜ Integration tests for IPC handlers
- ⬜ E2E tests (Playwright with Electron)
- ⬜ CI pipeline (GitHub Actions: lint + test + build)
- ⬜ Pre-commit hook (lint-staged + husky)
- ⬜ Dependabot auto-merge for patches
- ⬜ Sentry / error reporting in production

---

## 🐛 Bug Fixes & Known Issues

### Resolved
- ✅ **Sync deduplication** — 4-way patient match prevents infinite duplicates
- ✅ **Finances page crashes** — Date handling, rendering, Tailwind class fixes
- ✅ **Diagnosis autocomplete** — Wired N-gram model in Invoice Generator
- ✅ **Inventory sync & validation** — Bidirectional sync + Zod

### Security Concerns (from deep dive)
- ⚠️ **`nodeIntegration: true` in print window** — `electron/ipc/print.ts` creates a temporary BrowserWindow with `contextIsolation: false` and `nodeIntegration: true`. **Fix immediately** to `contextIsolation: true` and `nodeIntegration: false`, use preload script.
- ⚠️ **Database reset IPC exposed** — `reset-all-databases` is callable by anyone running the app. Move behind admin auth.
- ⚠️ **API key in plain text** — Backend `API_KEY` env var is single static. Rotate to per-clinic keys when RBAC is added.

### To Be Tested
- Network connectivity edge cases
- Long sync pauses (24h+ offline)
- Very large datasets (10k+ invoices)
- Concurrent edits from multiple devices

---

## 💡 User-Requested / Future Ideas (Backlog)

*This section captures ideas from the deep-dive that don't fit a specific release*

- Customizable invoice templates with HTML/CSS editor
- Recurring appointments (e.g. daily for 2 weeks)
- Patient portal (read-only web access)
- Gift cards / vouchers
- Loyalty points
- Treatment outcome measurement (Oswestry, DASH, FMS scoring)
- Integration with wearables (Fitbit, Apple Health for exercise compliance)
- Voice-to-text SOAP notes
- QR code patient check-in kiosk
- Insurance pre-authorization workflow
- Telehealth / video consultation
- Lab integration (e.g. NABL labs in India)
- Inventory expiry date tracking (for consumables)
- Reorder automation (auto-purchase order to suppliers)
- Multi-currency support (for medical tourism)
- Treatment consent forms (digital signature)
- Pre/post treatment photos with measurement overlays
- Pain scale heatmap (body diagram)

---

## 📊 Performance Goals

### Current (v2.5.4)
- Startup time: < 3 seconds
- Search response: < 100ms
- Print dialog: < 1 second
- Data save: < 500ms
- Offline mode: Fully operational without network

### Target (v3.0)
- Support 100,000+ invoices without degradation
- Search across large datasets: < 200ms
- Cloud sync: < 5 seconds
- Report generation: < 2 seconds
- App cold start: < 2 seconds (with code splitting)
- Memory footprint: < 300 MB

### Stretch (v4.0)
- Offline + online seamless switching
- Multi-device real-time sync
- PWA installable, < 5 MB initial download

---

## 🔐 Security Enhancements Roadmap

| Phase | Feature | Priority |
|---|---|---|
| **Now** | Fix `nodeIntegration: true` in print window | 🔴 Critical |
| **Now** | Move `reset-all-databases` behind admin gate | 🔴 Critical |
| **v2.6** | Add login screen + bcrypt password hashing | 🟠 High |
| **v2.7** | RBAC (admin / receptionist / therapist / viewer) | 🟠 High |
| **v2.7** | Audit log table | 🟡 Medium |
| **v3.0** | Per-clinic API keys | 🟡 Medium |
| **v3.0** | Encrypt SQLite at rest | 🟡 Medium |
| **v3.0** | 2FA | 🟢 Low |
| **v4.0** | End-to-end encryption of clinical notes | 🟢 Low |

---

## 📱 Platform Expansion Roadmap

| Phase | Platform | Status |
|---|---|---|
| **Current** | Windows desktop | ✅ Live |
| **v2.6** | macOS desktop | ⬜ Pending (Electron supports; test build) |
| **v2.6** | Linux desktop | ⬜ Pending |
| **v3.0** | Web portal (React) | ⬜ Planned |
| **v3.5** | Progressive Web App (PWA) | ⬜ Planned |
| **v4.0** | iOS / Android native | ⬜ Planned |
| **v4.0** | Tablet-optimized UI (for clinic kiosk) | ⬜ Planned |

---

## 📅 Release Schedule (Proposed)

| Version | Target Date | Theme | Key Features |
|---|---|---|---|
| **v2.5.5** | July 2026 | Hotfix + Search | Treatment/Diagnosis preset search, auto-diagnosis save, sync cleanup |
| **v2.6** | Aug 2026 | Clinical Core | Treatment Session tracking, SOAP notes, Document attachments |
| **v2.7** | Sep 2026 | Scheduling | Appointment scheduling, packages, reminders |
| **v2.8** | Oct 2026 | Communication | WhatsApp integration, in-app todos, keyboard shortcuts, dark mode |
| **v2.9** | Nov 2026 | Performance | Code splitting, indexing, search < 100ms, DB backup |
| **v3.0** | Q1 2027 | Enterprise | RBAC, audit log, multi-branch, web portal beta, online payments |
| **v3.5** | Q3 2027 | Mobile + AI | PWA, AI scribe, smart diagnosis, mobile companion app |
| **v4.0** | 2028 | Platform | Native iOS/Android, multi-tenant SaaS, marketplace |

---

## 🏆 Strategic Bets (Highest ROI for Reusability)

If you can only build 3 things in the next 6 months, build these:

### 🥇 1. Treatment Session Tracking
- **Why**: Turns the app from "billing" into "clinical workflow". Highest user stickiness.
- **Effort**: 2-3 weeks (UI + use existing schema)
- **Reuse**: PatientDetailPane, TreatmentCalendar, existing `TreatmentSession` table
- **Revenue impact**: Clinics won't churn because clinical data is locked in.

### 🥈 2. Appointment Scheduling
- **Why**: Daily-driver feature that no clinic can live without.
- **Effort**: 3-4 weeks (new page + new table + calendar component)
- **Reuse**: Recharts, CustomSelect, existing patient/invoice data
- **Revenue impact**: 30%+ reduction in no-shows (industry stat).

### 🥉 3. WhatsApp / SMS Integration
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

### To Do
- ⬜ **User Manual** (PDF, with screenshots)
- ⬜ **Admin Guide** (multi-user, RBAC, backup/restore)
- ⬜ **Developer Docs** (architecture, sync engine, plugin system)
- ⬜ **API Reference** (auto-generated from Zod schemas)
- ⬜ **Video tutorials** (5-min walkthroughs per page)
- ⬜ **Changelog** (auto-generated from conventional commits)
- ⬜ **Migration guide** (from paper / other systems)

---

## 🏁 Final Recommendations

**For the next 90 days**, focus on:
1. Fix the security issues (`nodeIntegration`, reset IPC) — 1 day
2. Ship **Quick Win #1: Treatment Session Tracking** — 2-3 weeks
3. Ship **Quick Win #2: Appointment Scheduling** — 3-4 weeks
4. Build the foundation for **#13: RBAC** — parallel track

**For the next 180 days**, add:
5. **Quick Win #5: WhatsApp/SMS** (huge retention)
6. **Quick Win #3: Treatment Packages** (recurring revenue)
7. **Quick Win #7: Patient Document Attachments** (clinical completeness)

**For the next 365 days**, lay the foundation for v3.0:
8. Multi-branch (architectural changes pay off later)
9. Web portal (huge addressable market)
10. Online payments (Razorpay — India first)

**Why this order?**
- Quick wins ship fast → user delight → retention
- Clinical depth (sessions, packages) is the moat that prevents churn
- Multi-user / RBAC unlocks enterprise sales
- Web + payments unlock 10x addressable market
- AI / mobile is "nice to have" but not yet table stakes

---

*Last Updated: June 14, 2026*
*Prepared after deep dive into codebase + web research on SPRY, WebPT, ClinicSource, PhysioCare PMS, Net Health, and others.*
