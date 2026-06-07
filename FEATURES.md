# Feature Recommendations

> Project: Shri Ram Physio Clinic Management System
> Generated: 2026-06-07

---

## Table of Contents
- [High Priority Features](#high-priority-features)
- [Medium Priority Features](#medium-priority-features)
- [Low Priority Features](#low-priority-features)
- [Frontend-Specific Enhancements](#frontend-specific-enhancements)
- [Backend-Specific Enhancements](#backend-specific-enhancements)

---

## High Priority Features

### H1. Patient Treatment Session Tracking
- **Applies to:** Both
- **Description:** No dedicated system for logging individual treatment sessions within an ongoing treatment plan.
- **Proposed Implementation:**
  - Backend: New `TreatmentSession` model linked to `Treatment` and `Invoice`. Fields: `date`, `notes`, `exercisesPerformed`, `progress`, `painLevel`, `therapistId`.
  - Backend: CRUD endpoints for session management.
  - Frontend: Session logging form within patient detail view. Progress tracking charts.
  - Frontend: Treatment plan overview showing completed vs. remaining sessions.
- **Impact:** Essential for clinical documentation and patient progress tracking.

---

## Medium Priority Features

### M1. Export & Reports
- **Applies to:** Frontend (primary), Backend
- **Description:** No way to export data for external use (accounting, tax filing, backup).
- **Proposed Implementation:**
  - PDF export: Financial reports (monthly/quarterly/annual), patient lists, treatment summaries.
  - CSV/Excel export: Invoice data, patient data, treatment data.
  - Backend: New `/api/reports` endpoints for generating report data.
  - Frontend: Export buttons on Finances page, Database Find page, and Settings page.
- **Impact:** Required for accounting, tax compliance, and data portability.

### M2. Outstanding Payments & Billing Tracker
- **Applies to:** Both
- **Description:** No tracking of unpaid or partially paid invoices.
- **Proposed Implementation:**
  - Backend: Add `paymentStatus` field to Invoice model (`paid`, `partial`, `unpaid`, `overdue`). Add `amountPaid` and `amountDue` fields.
  - Backend: `GET /api/invoices/outstanding` endpoint.
  - Frontend: New `/billing` page showing outstanding invoices, overdue alerts, payment history.
  - Frontend: Payment recording form (partial payments, payment method, date).
- **Impact:** Critical for revenue management and follow-ups.

### M3. Treatment Progress Notes
- **Applies to:** Both
- **Description:** No per-session clinical notes for ongoing treatments.
- **Proposed Implementation:**
  - Backend: Extend `TreatmentSession` model with rich text notes, assessment fields, goal tracking.
  - Backend: Attachment support (X-ray images, exercise diagrams).
  - Frontend: Rich text editor for session notes.
  - Frontend: Timeline view of patient's treatment history with notes.
- **Impact:** Essential for clinical documentation and continuity of care.

### M4. Backend and database status
- **Applies to:** Both
-**Description:** Currently there is no way to know the database and backend status as if they are down or up.
-**Proposed Implementation:**
  - 
-**Impact:** Better usability and interconnectivity on every other features and functions inside the software like sync mechanisms, retries logic

---

## Low Priority Features

### L1. Offline Queue Management
- **Applies to:** Frontend
- **Description:** Current sync engine is basic. No robust offline queue for failed sync operations.
- **Proposed Implementation:**
  - Persistent offline queue stored in SQLite.
  - Retry logic with exponential backoff.
  - Conflict resolution UI for manual review.
  - Sync status dashboard showing pending/failed items.
- **Impact:** Better reliability in low-connectivity environments.

### L2. Data Backup & Restore
- **Applies to:** Both
- **Description:** No manual backup/export/import functionality.
- **Proposed Implementation:**
  - Frontend: "Backup Now" button in Settings. Downloads encrypted SQLite dump.
  - Frontend: "Restore from Backup" with file picker and validation.
  - Backend: Automated daily backups to Azure Blob Storage.
  - Backup encryption with clinic-specific key.
- **Impact:** Data safety and disaster recovery.

### L3. Analytics & Business Intelligence
- **Applies to:** Frontend (primary), Backend
- **Description:** Current `Finances.tsx` is basic. No advanced analytics.
- **Proposed Implementation:**
  - Treatment type profitability analysis.
  - Patient retention rate and churn analysis.
  - Peak hours/days analysis for staffing optimization.
  - Custom date range comparisons with visual charts.
- **Impact:** Data-driven business decisions.

### L4. Exercise Prescription Library
- **Applies to:** Frontend (primary), Backend
- **Description:** No structured exercise prescription system.
- **Proposed Implementation:**
  - Backend: `Exercise` model with name, description, image/video URL, bodyPart, difficulty.
  - Backend: `ExercisePrescription` model linking exercises to patients/sessions.
  - Frontend: Exercise library browser with search and filters.
  - Frontend: Printable exercise handouts for patients.
- **Impact:** Standardized treatment protocols, better patient compliance.

### L5. WhatsApp / SMS Integration for Reminders and Receipts
- **Applies to:** Backend
- **Description:** Clinics often share digital invoices over WhatsApp. Adding notification support simplifies the process.
- **Proposed Implementation:**
  - Integrate a basic Twilio, local SMS gateway, or WhatsApp Business API via the Backend.
  - Add a "Share Invoice to Patient Phone" button to push a PDF or link.
- **Impact:** Improves patient experience and engagement.

---

## Frontend-Specific Enhancements

### F1. Keyboard Navigation & Accessibility
- **Description:** Many interactive elements lack `aria-label`, `role`, or keyboard navigation. Home page cards use `onClick` on `div` instead of `<button>`.
- **Fix:** Use semantic HTML elements, add ARIA attributes, implement full keyboard navigation.

### F2. React Error Boundary
- **Description:** No React Error Boundary for runtime component errors.
- **Fix:** Add an Error Boundary component to gracefully handle crashes and show a user-friendly error message.

### F3. Toast Notification System Enhancement
- **Description:** Current toast system is basic. No auto-dismiss, no stacking, no action buttons.
- **Fix:** Add auto-dismiss with configurable duration, toast stacking, undo action support (e.g., "Invoice saved" with "Undo" button).

### F4. Dark Mode
- **Description:** No dark mode support.
- **Fix:** Add Tailwind dark mode support with system preference detection and manual toggle in Settings.

### F5. Print Preview Improvements
- **Description:** Invoice print preview uses raw HTML string generation (`generateInvoiceHTML` returns a 696-line template literal).
- **Fix:** Consider using a template engine or React-based PDF generation library for better maintainability.

### F6. Form Auto-Save Drafts
- **Description:** Invoice form data is lost if the app closes unexpectedly.
- **Fix:** Auto-save form state to localStorage or SQLite. Restore on next open with user prompt to restore previous invoice generation attempt.

---

## Backend-Specific Enhancements

### B1. Structured Logging
- **Description:** All logging uses `console.log` and `console.error`. No structured logging, no log levels, no request logging.
- **Fix:** Add `pino` or `winston` with request ID tracking, log levels, and JSON output for log aggregation.

### B2. API Versioning
- **Description:** No API versioning. Breaking changes will break existing Electron clients.
- **Fix:** Add `/api/v1/` prefix to all routes. Plan for `/api/v2/` when breaking changes are needed.

### B3. Health Check Enhancements
- **Description:** Current `/health` endpoint only returns `{ status: 'healthy', timestamp }`.
- **Fix:** Add database connectivity check, disk space check, memory usage, uptime. Return detailed status for monitoring tools.

### B4. Request Validation Middleware
- **Description:** Not all endpoints validate input. Patient create/update, preset create/update lack Zod validation.
- **Fix:** Apply Zod validation schemas to all POST/PUT endpoints using a reusable middleware.

### B5. Database Indexing
- **Description:** No explicit indexes on frequently queried fields beyond auto-created ones. `phone` in Patient is searched but has no index.
- **Fix:** Add indexes on `Patient.phone`, `Patient.uhid`, `Invoice.patientId`, `Invoice.date`, `Treatment.invoiceId`.

### B6. Graceful Degradation for Sync Failures
- **Description:** Sync failures are logged but not tracked or retried automatically.
- **Fix:** Implement sync failure tracking, automatic retry with backoff, and manual retry UI in the frontend.

### B7. API Documentation
- **Description:** No API documentation for the backend endpoints.
- **Fix:** Add OpenAPI/Swagger specification. Use `swagger-jsdoc` or `tsoa` for auto-generated docs.

### B8. Database Migration Strategy
- **Description:** Uses `prisma db push --accept-data-loss` in production deployment (backend-deploy.yml:104), which can cause data loss.
- **Fix:** Use `prisma migrate deploy` in production. Ensure all schema changes have proper migration files.

---

## Summary

| Priority | Count |
|----------|-------|
| High | 2 |
| Medium | 5 |
| Low | 5 |
| Frontend Enhancements | 6 |
| Backend Enhancements | 8 |
| **Total** | **26** |