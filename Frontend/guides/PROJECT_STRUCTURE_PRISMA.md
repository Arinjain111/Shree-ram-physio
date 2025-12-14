# 📁 Project Structure - Shri Ram Physio Frontend

## Overview

This Electron app uses:
- **React 18** for UI
- **Prisma ORM** for database (SQLite)
- **Vite** for fast development
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling

---

## Folder Structure

```
Frontend/
├── prisma/
│   ├── schema.prisma          # Database schema (SQLite)
│   └── migrations/            # Migration history
│
├── electron/
│   ├── mainPrisma.ts         # ✅ Main Electron process (Prisma)
│   ├── main.ts               # ⚠️ Old implementation (deprecated)
│   ├── lib/
│   │   └── prisma.ts         # Prisma Client with dynamic path
│   ├── sync/
│   │   ├── prismaSyncEngine.ts  # ✅ Sync engine (Prisma)
│   │   └── syncEngine.ts        # ⚠️ Old sync (deprecated)
│   └── database/
│       └── schema.ts         # ⚠️ Old SQLite wrapper (deprecated)
│
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Main React app with routing
│   ├── index.css             # Tailwind imports
│   ├── types.ts              # TypeScript type definitions
│   │
│   ├── pages/
│   │   ├── Home.tsx          # Home page
│   │   ├── InvoiceGenerator.tsx  # Create invoices
│   │   ├── DatabaseFind.tsx      # Search patients
│   │   └── InvoiceCustomizer.tsx # Customize layouts
│   │
│   ├── components/
│   │   ├── invoice/          # Invoice-related components
│   │   ├── customizer/       # Customizer components
│   │   └── layout/           # Layout components
│   │
│   ├── hooks/
│   │   └── useInvoiceLayout.ts  # Custom hook for layouts
│   │
│   ├── types/
│   │   └── invoice.types.ts  # Invoice type definitions
│   │
│   └── utils/
│       └── invoiceGenerator.ts  # Invoice generation logic
│
├── dist-electron/            # Built Electron files
│   ├── mainPrisma.js        # ✅ Compiled main process
│   ├── lib/
│   │   └── prisma.js
│   └── sync/
│       └── prismaSyncEngine.js
│
├── guides/                   # Documentation
│   ├── QUICK_START.md
│   ├── GETTING_STARTED.md
│   ├── PROJECT_STRUCTURE.md
│   └── ...
│
├── package.json             # Dependencies & scripts
├── .env                     # Environment variables
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript (React)
├── tsconfig.electron.json   # TypeScript (Electron)
└── README.md                # Main documentation
```

---

## Key Files

### Entry Points

| File | Purpose | Status |
|------|---------|--------|
| `package.json` main | Points to `dist-electron/mainPrisma.js` | ✅ Active |
| `src/main.tsx` | React app entry point | ✅ Active |
| `electron/mainPrisma.ts` | Electron main process (Prisma) | ✅ Active |
| `electron/main.ts` | Old Electron main (better-sqlite3) | ⚠️ Deprecated |

### Database Layer

| File | Purpose | Status |
|------|---------|--------|
| `prisma/schema.prisma` | Database schema definition | ✅ Active |
| `electron/lib/prisma.ts` | Prisma Client initialization | ✅ Active |
| `electron/sync/prismaSyncEngine.ts` | Sync engine with Prisma | ✅ Active |
| `electron/database/schema.ts` | Old SQLite wrapper | ⚠️ Deprecated |
| `electron/sync/syncEngine.ts` | Old sync engine | ⚠️ Deprecated |

### UI Components

| Directory | Purpose |
|-----------|----------|
| `src/pages/` | Main application pages |
| `src/components/invoice/` | Invoice creation components |
| `src/components/customizer/` | Layout customization |
| `src/hooks/` | React custom hooks |
| `src/types/` | TypeScript type definitions |

---

## Data Flow

```
React UI (src/pages/)
    ↓
    IPC Call (ipcRenderer.invoke)
    ↓
Electron Main (electron/mainPrisma.ts)
    ↓
    IPC Handler (ipcMain.handle)
    ↓
Prisma Client (electron/lib/prisma.ts)
    ↓
SQLite Database (~/.../shri-ram-physio.db)
    ↓
Sync Engine (electron/sync/prismaSyncEngine.ts)
    ↓
    HTTP Request (axios)
    ↓
Backend API (Azure)
    ↓
Azure SQL Database
```

---

## IPC Communication

### Invoice Operations
- `save-invoice` - Save invoice with patient & treatments
- `load-invoices` - Load all invoices with relations

### Patient Operations
- `create-patient` - Create new patient
- `get-patients` - Get all patients
- `search-patients` - Search by name/UHID
- `update-patient` - Update patient info

### Sync Operations
- `sync-now` - Trigger manual sync
- `get-sync-status` - Get pending changes count

### UI Operations
- `print-invoice` - Print invoice to PDF
- `save-layout` - Save custom layout config
- `load-layout` - Load saved layout
- `select-logo` - File dialog for logo upload

---

## Build Process

### Development Build

```powershell
npm run dev
```

1. Vite compiles React app → `dist/`
2. Electron loads from Vite dev server
3. Hot module replacement enabled

### Production Build

```powershell
npm run build
npm run build:electron
npm run electron:build
```

1. `prisma generate` → Generate Prisma Client
2. `tsc` → Compile TypeScript
3. `vite build` → Build React app → `dist/`
4. `tsc -p tsconfig.electron.json` → Build Electron → `dist-electron/`
5. `electron-builder` → Package into installer

---

## Database Location

### Development
- SQLite file: `prisma/dev.db`

### Production (Packaged App)
- **Windows**: `C:\Users\{username}\AppData\Roaming\shri-ram-physio\shri-ram-physio.db`
- **macOS**: `~/Library/Application Support/shri-ram-physio/shri-ram-physio.db`
- **Linux**: `~/.config/shri-ram-physio/shri-ram-physio.db`

---

## Configuration Files

| File | Purpose |
|------|----------|
| `package.json` | Dependencies, scripts, Electron config |
| `.env` | Environment variables (AZURE_BACKEND_URL) |
| `vite.config.ts` | Vite bundler configuration |
| `tsconfig.json` | TypeScript config for React |
| `tsconfig.electron.json` | TypeScript config for Electron |
| `prisma.config.ts` | Prisma configuration |
| `prisma/schema.prisma` | Database schema |

---

## Deprecated Files (Removed)

⚠️ These files were removed from the codebase:

- ~~`src/main.ts`~~ - Conflicted with React entry point (main.tsx)
- ~~`src/services/google-sheets.ts`~~ - Placeholder with no implementation
- `electron/main.ts` - Old Electron main (better-sqlite3) - *To be removed*
- `electron/database/schema.ts` - Old SQLite wrapper - *To be removed*
- `electron/sync/syncEngine.ts` - Old sync engine - *To be removed*

✅ The app now uses **Prisma ORM** for all database operations.

---

## Scripts Reference

```powershell
# Development
npm run dev              # Start dev server + Electron
npm run build            # Build React app
npm run build:electron   # Build Electron main process

# Prisma
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Create migration
npm run prisma:studio    # Open Prisma Studio GUI

# Production
npm run electron:build   # Package Electron app
```

---

**Status**: ✅ Current structure with Prisma ORM integration complete
