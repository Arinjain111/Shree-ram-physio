# Feature Checklist & Roadmap

## ✅ Implemented Features (Version 2.1.2 Current)

### Invoice Generator
- ✅ Patient information form (name, age, gender, phone, address)
- ✅ Multiple treatment items with quantity and rate
- ✅ Automatic amount calculation
- ✅ Total calculation
- ✅ **Invoice-level discount** (amount or percentage) — optional, collapsible like UHID
- ✅ Payment method selection
- ✅ Notes/Prescription field
- ✅ Print functionality using Windows default printer
- ✅ Save invoice data locally
- ✅ Preview before printing
- ✅ Date picker with current date default
- ✅ Form validation
- ✅ Responsive design
- ✅ **Diagnosis autocomplete** with next-word prediction (bigram + trigram NGram model over 147 presets)

### Database Find
- ✅ Search patients by name, age, phone, invoice ID
- ✅ Display all patient records
- ✅ Group invoices by patient
- ✅ View patient details modal
- ✅ Treatment history display
- ✅ Visit count tracking
- ✅ Last visit date
- ✅ Detailed invoice view per patient
- ✅ Responsive search interface

### Invoice Customizer
- ✅ Clinic name customization
- ✅ Clinic address field
- ✅ Phone number field
- ✅ Email field
- ✅ Doctor name field
- ✅ Registration number field
- ✅ Logo upload functionality
- ✅ Header alignment options (left/center/right)
- ✅ Logo position options
- ✅ Font size options (small/medium/large)
- ✅ Border toggle
- ✅ Live preview
- ✅ Save/Load configuration
- ✅ Reset to default option

### UI/UX
- ✅ Minimal, clean design
- ✅ Light background gradients
- ✅ Responsive layout
- ✅ Smooth transitions
- ✅ Professional color scheme
- ✅ Intuitive navigation
- ✅ Modal dialogs
- ✅ Form validation feedback
- ✅ Hover effects
- ✅ Mobile-friendly (for future web version)

### Technical & Architecture
- ✅ Electron framework (v39+)
- ✅ Offline-First Architecture (SQLite via better-sqlite3)
- ✅ Cloud Sync (PostgreSQL / Supabase via Prisma)
- ✅ TypeScript support
- ✅ IPC communication
- ✅ File system operations
- ✅ Print API integration
- ✅ PDF generation and auto-save functionality
- ✅ Error handling
- ✅ Build scripts
- ✅ **Unified structured logger** (backend + Electron main + renderer) with level filtering, field redaction, and `with/child/time` helpers
- ✅ **Toast bridge** — `warn`/`error` entries in main process auto-raise renderer toasts via the `app:log` IPC channel
- ✅ **HTTP access log** middleware — single line per request (IP, method, URL, status, duration)
- ✅ **ErrorBoundary** routes React render errors through the new logger
- ✅ **Inventory Management** — Product/Supply tracking with stock levels, cost/selling prices, purchase (restock) and sale (outflow) recording, full cloud sync

---

## 🚧 Planned Features (Version 2.2)

### PDF Export Enhancements ( deferred currently )
- ⬜ Email PDF directly
- ⬜ Custom PDF templates

### Reporting
- ✅ Analytics & Business Intelligence
- ✅ Daily revenue report
- ✅ Weekly summary
- ✅ Monthly financial report
- ✅ Patient visit trends
- ✅ Treatment type statistics
- ✅ Payment method breakdown
- ✅ Export reports to CSV

---

## 🎯 Future Enhancements (Version 3.0)

### Advanced Patient Management
- ⬜ Patient Treatment Session Tracking
- ⬜ Treatment Progress Notes with rich text
- ⬜ Medical history tracking
- ⬜ Treatment progress tracking
- ⬜ Custom patient fields

### Prescription Management
- ⬜ Prescription templates library
- ⬜ Exercise database with images
- ⬜ Custom prescription builder
- ⬜ Print exercise sheets
- ⬜ Digital prescription sharing

### Financial Features
- ✅ Discount management (amount/percentage, with subtotal/discount/final total on printed invoice)
- ✅ Outstanding Payments & Billing Tracker
- ✅ Multiple payment methods per invoice
- ✅ Partial payment tracking
- ⬜ Credit/Debit notes
- ✅ Expense tracking (clinic expenses by category with amounts and notes)
- ✅ Profit/Loss statements
- ⬜ Tax reports

### Inventory Management
- ✅ Product/Supply tracking (stock, cost/selling price, purchase/sale recording)
- ✅ Inventory transactions with purchase (restock) and sale (outflow) types
- ✅ Bidirectional cloud sync for inventory items and transactions

### Cloud Features
- ⬜ Offline Queue Management & Conflict Resolution
- ⬜ Backend and database status monitoring
- ⬜ Cloud backup
- ⬜ Multi-device sync
- ⬜ Cloud storage integration

### Communication
- ⬜ SMS integration
- ⬜ WhatsApp notifications
- ⬜ Feedback collection

---


## 🛠️ Technical Debt & Infrastructure (Planned)

### Frontend Enhancements
- ⬜ Keyboard Navigation & Accessibility (ARIA labels)
- ✅ React Error Boundary implementation
- ✅ Toast Notification System Enhancement (auto-dismiss, stacking) — `UIProvider` already raises toasts from the new `useLogger().error(...)` automatically
- ⬜ Print Preview Improvements
- ⬜ Form Auto-Save Drafts

### Backend Enhancements
- ✅ Structured Logging (in-house `logger` with JSON / human modes, level filtering, redaction, `with/child/time`)
- ⬜ API Versioning (/api/v1/)
- ⬜ Health Check Enhancements (DB status, disk space)
- ✅ Request Validation Middleware (Zod) — already used in controllers; logging now reports parsed errors
- ⬜ Database Indexing optimizations
- ⬜ Graceful Degradation for Sync Failures
- ⬜ Database Migration Strategy optimization

## 🐛 Bug Fixes & Known Issues

### Resolved (v2.1.2)
- ✅ **Sync deduplication** — Patient 4-way match (cloudId → uhid → identity → create) + treatment 3-way match prevent infinite duplicates from records lacking both cloudId and uhid.
- ✅ **Finances page crashes** — Fixed `parseISO` on Date objects, rendering Date as React child, invalid `h-75` Tailwind class, and string-date comparison bugs.
- ✅ **Diagnosis autocomplete** — Wire up the existing `DiagnosisAutocomplete` component (NGram bigram/trigram) in the Invoice Generator. Previously a plain `<textarea>` was rendered instead.
- ✅ **Inventory sync & validation** — Added bidirectional cloud sync for inventory items/transactions, Zod validation on all IPC handlers, shared types replacing `any[]` in Finances, and a migration file for clean installs.

### Current Issues
- None reported (Initial release)

### To Be Tested
- Network connectivity for future cloud features

---

## 💡 User-Requested Features

*This section will be updated based on user feedback*

---

## 📊 Performance Goals

### Current Performance (v2.1.0)
- Startup time: < 3 seconds
- Search response: Instant (< 100ms)
- Print dialog: < 1 second
- Data save: < 500ms
- Offline mode: Fully operational without network

### Target Performance (v3.0)
- Support 10,000+ invoices without performance degradation
- Search across large datasets: < 200ms
- Cloud sync: < 5 seconds
- Report generation: < 2 seconds

---

## 🔐 Security Enhancements (Future)

- ⬜ Data encryption at rest
- ⬜ Automatic backups
- ⬜ Data export/import
- ⬜ GDPR compliance features
- ⬜ Audit trails
- ⬜ Secure cloud storage

---

## 📱 Platform Expansion

### Desktop
- ✅ Windows (Current)

### Web
- ⬜ Progressive Web App (PWA)
- ⬜ Browser-based version

### Mobile
- ⬜ Android app

---

## 🎨 UI/UX Improvements (Ongoing)

- ⬜ Quick actions menu
- ⬜ Drag-and-drop file uploads
- ⬜ Context menus
- ⬜ Tooltips and help system

---

## 📚 Documentation

### Completed
- ✅ README.md
- ✅ Quick Start Guide
- ✅ Invoice Template Reference
- ✅ Sample Data

---

## 📅 Release Schedule

- **v1.0** - January 2025 (Initial Release)
- **v2.0** - May 2026 (Offline-first, PostgreSQL, Prisma Sync)
- **v2.1.0** - June 2026 (Current - Security & Dependency Updates)
- **v2.1.1** - June 2026 (Unified logging system, structured logger, toast bridge, access log middleware)
- **v2.1.2** - June 2026 (Invoice discount, diagnosis autocomplete, sync dedup fix, Finances page fix)
- **v2.2** - Q3 2026 (Reporting & Advanced Settings)
- **v3.0** - 2027 (Major Cloud & Portal Update)

---

*Last Updated: June 7, 2026*
