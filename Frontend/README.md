# Shri Ram Physiotherapy Clinic - Electron App

A modern **offline-first** Electron desktop application for physiotherapy clinic management, built with **React**, **TypeScript**, **Prisma ORM**, and **Tailwind CSS v4**.

## Overview

This Electron app provides a complete invoice management system with:

- ✅ **Offline-first architecture** - Works without internet
- ✅ **Local SQLite database** - Instant data access with Prisma
- ✅ **Cloud sync** - Bidirectional sync with Azure SQL
- ✅ **Multi-device support** - Sync across multiple computers
- ✅ **Type-safe queries** - Full TypeScript integration

## Features

### 1. Invoice Generator
- Create custom invoices with patient details
- Add multiple treatment items with sessions and rates
- Automatic calculation of totals
- Print invoices using Windows default print system
- Save invoice data locally (instant)
- Add diagnosis and prescription notes
- Live invoice preview before printing
- **Offline-first**: Create invoices without internet

### 2. Patient Management
- Create and edit patient records
- Search patients by name, phone, or UHID
- View complete patient treatment history
- Track number of visits per patient
- View all invoices for each patient
- UHID uniqueness validation
- **Auto-sync**: Changes sync to cloud automatically

### 3. Database Sync
- **Automatic sync** every 5 minutes (when online)
- **Manual sync** via "Sync Now" button
- **Bidirectional sync** (local ↔ cloud)
- **Conflict resolution** (timestamp-based)
- **Sync status tracking** (pending/synced/conflict)
- **Multi-device support** - Work on multiple computers

### 4. Invoice Customizer
- Customize clinic information (name, address, phone, email)
- Upload and position clinic logo
- Customize header alignment
- Adjust font sizes
- Toggle invoice borders
- Add doctor name and registration number
- Live preview of invoice layout
- Save and reset layout configurations

## Architecture

**Offline-First with Prisma ORM**

```
React UI → IPC → Electron Main → Prisma Client (SQLite)
                                        ↓
                                  Sync Engine
                                        ↓ (HTTP)
                              Backend API (Azure)
                                        ↓
                            Prisma Client (Azure SQL)
```

### Data Flow

1. **User creates invoice** → Saved to local SQLite (instant)
2. **Record marked** → `syncStatus = 'PENDING'`
3. **Sync engine** → Uploads to Azure SQL every 5 minutes
4. **Downloads changes** → From other devices
5. **Updates local DB** → Marks as `syncStatus = 'SYNCED'`

## Tech Stack

- **Electron 27.1.3** - Desktop application framework
- **React 18.2.0** - UI library with TypeScript
- **Prisma 7.1.0** - Modern ORM for SQLite
- **Vite 5.0.8** - Fast build tool with HMR
- **Tailwind CSS v4.0.0-alpha.25** - Utility-first CSS
- **React Router 6.21.0** - Client-side routing
- **TypeScript** - Type-safe development
- **SQLite** - Embedded local database

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm (comes with Node.js)

### Setup Steps

1. **Install Dependencies**
```powershell
npm install
```

2. **Configure Backend URL**

Create `.env` file:

```env
AZURE_BACKEND_URL=https://shri-ram-physio-api.azurewebsites.net

# For local testing:
# AZURE_BACKEND_URL=http://localhost:3000
```

3. **Generate Prisma Client**

```powershell
npm run prisma:generate
```

4. **Create Database Schema**

```powershell
npm run prisma:migrate
```

5. **Run Development Build**

```powershell
npm run dev
```

This will:
- Start Vite dev server on http://localhost:5173
- Launch Electron window
- Enable hot module replacement for instant updates

6. **Build for Production**

```powershell
npm run build
npm run electron:build
```

Distributable app will be in `dist-electron/`

## Project Structure

```
Frontend/
├── prisma/
│   ├── schema.prisma           # Database schema (SQLite)
│   └── migrations/             # Migration history
├── electron/
│   ├── lib/
│   │   └── prisma.ts          # Prisma Client with dynamic path
│   ├── sync/
│   │   └── prismaSyncEngine.ts # Sync logic
│   ├── mainPrisma.ts          # Main process with Prisma IPC handlers
│   └── preload.ts             # IPC bridge
├── src/                       # React application
│   ├── pages/                 # Page components
│   │   ├── Home.tsx          # Home page
│   │   ├── InvoiceGenerator.tsx
│   │   ├── DatabaseFind.tsx
│   │   └── InvoiceCustomizer.tsx
│   ├── hooks/                # Custom React hooks
│   ├── App.tsx               # Main app component with routing
│   ├── main.tsx              # React entry point
│   └── index.css             # Tailwind imports
├── dist/                     # Build output (renderer)
├── dist-electron/            # Build output (main process + packaged app)
├── index.html                # HTML template
├── vite.config.ts            # Vite configuration
├── package.json              # Dependencies and scripts
└── README.md
```

## Available Scripts

### Development

```powershell
npm run dev              # Start dev server + Electron (HMR enabled)
npm run build            # Build React app for production
npm run build:electron   # Build Electron main process
npm run electron:build   # Package Electron app (creates .exe/.dmg)
npm run type-check       # TypeScript type checking
```

### Prisma Commands

```powershell
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Create migration
npm run prisma:studio    # Open Prisma Studio GUI (port 5556)
```

### When to Run Prisma Commands

- `prisma:generate` - After editing `schema.prisma` or `npm install`
- `prisma:migrate` - When creating/modifying database schema
- `prisma:studio` - To view/edit local SQLite data in GUI

## IPC Communication

The application uses Electron IPC for communication between renderer and main process:

### Patient Management
- `create-patient` - Create new patient (saves to SQLite)
- `get-patients` - Get all patients from local DB
- `search-patients` - Search patients by name/phone/UHID
- `update-patient` - Update patient info
- `delete-patient` - Delete patient (if no invoices)

### Invoice Management
- `save-invoice` - Save invoice with treatments (SQLite)
- `load-invoices` - Load all invoices with patient info
- `get-invoice-by-id` - Get specific invoice
- `update-invoice` - Update invoice details
- `delete-invoice` - Delete invoice

### Sync Operations
- `sync-now` - Trigger manual sync with cloud
- `get-sync-status` - Get pending changes count & last sync time
- `get-sync-logs` - Get sync operation history

### UI Operations
- `print-invoice` - Print invoice to PDF
- `save-layout` - Save custom invoice layout config
- `load-layout` - Load saved layout config
- `select-logo` - Open file dialog for logo upload

## Database Schema

### Local SQLite (with Prisma)

**Patient**
- `id` (Int) - Local ID
- `cloudId` (Int?) - Azure SQL ID (after sync)
- `name`, `age`, `gender`, `phone`, `uhid` - Patient info
- `syncStatus` - 'PENDING' | 'SYNCED' | 'CONFLICT'
- `createdAt`, `updatedAt` - Auto-managed timestamps

**Invoice**
- `id` (Int) - Local ID
- `cloudId` (Int?) - Azure SQL ID
- `patientId` (Int) - Foreign key
- `invoiceNumber`, `date`, `diagnosis`, `total`
- `syncStatus`
- `createdAt`, `updatedAt`

**Treatment**
- `id` (Int) - Local ID
- `cloudId` (Int?) - Azure SQL ID
- `invoiceId` (Int) - Foreign key
- `name`, `sessions`, `startDate`, `endDate`, `amount`
- `syncStatus`
- `createdAt`, `updatedAt`

**SyncLog**
- `id` (Int)
- `operation` - 'SYNC' | 'PULL' | 'PUSH'
- `status` - 'SUCCESS' | 'ERROR'
- `recordsUploaded`, `recordsDownloaded`
- `errorMessage`
- `timestamp`

### Database Location

SQLite database is created at:
- **Windows**: `C:\Users\{username}\AppData\Roaming\shri-ram-physio\shri-ram-physio.db`
- **macOS**: `~/Library/Application Support/shri-ram-physio/shri-ram-physio.db`
- **Linux**: `~/.config/shri-ram-physio/shri-ram-physio.db`

## Usage Guide

### Creating an Invoice (Offline)

1. Click "Invoice Generator" on the home page
2. Fill in patient information (or select existing patient)
3. Add treatment items with sessions, dates, and amounts
4. Add diagnosis notes
5. Review total calculation
6. Click "Save & Print" to save and print
7. Invoice saved locally (instant, no internet needed)
8. Syncs to cloud automatically every 5 minutes

### Searching Patient Records

1. Click "Database Find" on the home page
2. Use search bar to find patients by name, phone, or UHID
3. Browse patient cards showing visit counts
4. Click on patient card to view detailed history
5. View all past invoices and treatments
6. All data loads instantly from local SQLite

### Manual Sync

1. Click "Sync Now" button in the app
2. Watch sync status indicator
3. See pending changes count
4. View last sync timestamp
5. Check sync logs for errors

### Viewing Database (Prisma Studio)

```powershell
npm run prisma:studio
```

Opens at http://localhost:5556 - view/edit local SQLite data with GUI

### Customizing Invoice Layout

1. Click "Invoice Customizer" on the home page
2. Fill in your clinic information (left panel)
3. Upload your clinic logo (supports common image formats)
4. Adjust layout settings (alignment, font size, borders)
5. See live preview update in real-time (right panel)
6. Click "Save Layout" to apply changes to all future invoices
7. Use "Reset to Default" to restore original settings
8. Layout config saved locally and syncs to cloud

## Sync Architecture

### How Sync Works

1. **Local Changes** → Marked as `syncStatus = 'PENDING'`
2. **Auto-Sync** → Every 5 minutes (when online)
3. **Upload** → Pending records sent to Azure SQL
4. **Download** → Changes from other devices retrieved
5. **Update Local** → Records marked as `SYNCED`
6. **Conflict Resolution** → Latest timestamp wins

### Sync Status Indicators

- 🟢 **Synced** - All changes uploaded to cloud
- 🟡 **Pending** - Local changes waiting to sync
- 🔴 **Error** - Sync failed (check logs)
- ⚪ **Offline** - No internet connection

### Testing Multi-Device Sync

1. Install app on **Device A**
2. Create invoice → Sync to cloud
3. Install app on **Device B**
4. Trigger sync → See Device A's invoice
5. Edit on Device B → Sync
6. Sync on Device A → See Device B's changes

## Data Storage

### Local Database (SQLite)
- Located in OS-specific app data folder
- Managed by Prisma ORM
- Instant access (no network latency)
- Type-safe queries

### Cloud Database (Azure SQL)
- Centralized data for all devices
- Backend API handles sync operations
- Automatic migrations via GitHub Actions

### Layout Config
- `layout.json` - Clinic branding, logo, formatting
- Logo images stored as base64 data URLs

## Development Notes

- **TypeScript** - Full type safety with auto-generated Prisma types
- **Tailwind CSS v4** - New syntax (`@import "tailwindcss"`)
- **Vite HMR** - Hot module replacement on port 5173
- **Prisma Client** - Auto-generated after schema changes
- **SQLite** - Embedded database (no server required)
- **Electron** - Cross-platform desktop app

## Troubleshooting

### "Cannot find module '@prisma/client'"

```powershell
npm run prisma:generate
```

### Sync Not Working

1. Check Backend URL in `.env`
2. Test backend health: `curl https://your-backend.azurewebsites.net/health`
3. Open DevTools (Ctrl+Shift+I) → Console for errors
4. Run Prisma Studio to check sync_logs table:
   ```powershell
   npm run prisma:studio
   ```

### Database Errors

```powershell
# Reset database (⚠️ deletes all local data)
npx prisma migrate reset

# Or delete database file manually:
# Windows: C:\Users\{username}\AppData\Roaming\shri-ram-physio\shri-ram-physio.db
```

### Build Errors

```powershell
# Clean and rebuild
Remove-Item -Recurse -Force node_modules, dist, dist-electron
npm install
npm run prisma:generate
npm run build
npm run build:electron
```

### TypeScript Errors

```powershell
# Ensure Prisma Client is generated
npm run prisma:generate

# Restart TypeScript server in VS Code
# Ctrl+Shift+P → "TypeScript: Restart TS Server"
```

### Print Not Working

- Ensure default printer configured in Windows
- Check printer drivers are up to date
- Try "Preview" option first to verify rendering

### Application Won't Start

1. Check Node.js version: `node --version` (must be 18+)
2. Reinstall dependencies: `npm install`
3. Check DevTools console (Ctrl+Shift+I)
4. Check Electron logs in terminal

## Production Build

### Building Installer

```powershell
# Build React app + Electron main process
npm run build
npm run build:electron

# Package into installer
npm run electron:build
```

Output:
- Windows: `dist-electron/shri-ram-physio-setup.exe`
- macOS: `dist-electron/shri-ram-physio.dmg`
- Linux: `dist-electron/shri-ram-physio.AppImage`

### Distribution

1. The installer includes:
   - React app (built with Vite)
   - Electron runtime
   - Prisma Client + SQLite driver
   - All dependencies bundled

2. Database created on first run in user's app data folder

3. Users just run the installer - no Node.js required!

## Documentation

- **[../README.md](../README.md)** - Main project overview
- **[../SETUP.md](../SETUP.md)** - Azure deployment guide
- **[../PRISMA_GUIDE.md](../PRISMA_GUIDE.md)** - Comprehensive Prisma guide
- **[../PRISMA_QUICKSTART.md](../PRISMA_QUICKSTART.md)** - 5-minute Prisma setup
- **[../Backend/API_DOCUMENTATION.md](../Backend/API_DOCUMENTATION.md)** - REST API reference

## Support

For issues or feature requests, please contact the development team.

## License

Private - Shri Ram Physiotherapy Clinic

---

**Shri Ram Physiotherapy Clinic** - Making patient management simple and efficient with offline-first architecture.
