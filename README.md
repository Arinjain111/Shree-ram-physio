# Shree Ram Physiotherapy and Rehabilitation Center - Invoice Management System

## Quick Start

### Development Setup

1. **Install Dependencies**

   ```powershell
   # Backend
   cd Backend
   npm install
   
   # Frontend
   cd ..\Frontend
   npm install
   ```

2. **Backend Development** (Local Testing)

   ```powershell
   cd Backend
   
   # Create .env file
   copy .env.example .env
   # Edit .env with your Azure SQL credentials
   # DATABASE_URL="sqlserver://server:1433;database=db;user=user;password=pass;encrypt=true"
   
   # Generate Prisma Client
   npm run prisma:generate
   
   # Create database schema
   npm run prisma:migrate
   
   # Run development server
   npm run dev
   ```

   Backend runs on http://localhost:3000

3. **Frontend Development** (Electron App)

   ```powershell
   cd Frontend
   
   # Create .env file
   copy .env.example .env
   # Edit .env - set AZURE_BACKEND_URL=http://localhost:3000 for local testing
   
   # Generate Prisma Client
   npm run prisma:generate
   
   # Create database schema
   npm run prisma:migrate
   
   # Run development mode
   npm run dev
   ```

### Production Build

1. **Build Backend**

   ```powershell
   cd Backend
   npm run build
   npm start
   ```

2. **Build Electron App**

   ```powershell
   cd Frontend
   npm run build
   npm run electron:build
   ```

   Distributable app will be in `Frontend/dist-electron/`

---

## Architecture

**Offline-First Sync System with Prisma ORM**

- **Local Storage**: SQLite with Prisma Client (embedded in Electron app)
- **Cloud Storage**: Azure SQL Database with Prisma Client
- **ORM**: Prisma 7.1.0 for type-safe database operations
- **Sync**: Bidirectional, every 5 minutes (auto) + manual trigger
- **Migrations**: Prisma Migrate for versioned schema changes

### Data Flow

```
React UI → IPC → Electron Main → Prisma Client (SQLite)
                                         ↓
                                   Sync Engine
                                         ↓
                              Azure Backend API
                                         ↓
                              Prisma Client (Azure SQL)
                                         ↓
                                  Azure SQL DB
```

---

## Features

✅ Patient management (CRUD)  
✅ Invoice generation with treatments  
✅ Session-based calculations  
✅ Custom invoice layout (logo, colors, fonts)  
✅ Print to PDF  
✅ Offline-first (works without internet)  
✅ Cloud sync (multi-device support)  

---

## Key Files

### Frontend
- `prisma/schema.prisma` - Database schema (SQLite)
- `electron/lib/prisma.ts` - Prisma Client with dynamic SQLite path
- `electron/mainPrisma.ts` - Electron main process with IPC handlers using Prisma
- `electron/sync/prismaSyncEngine.ts` - Sync logic using Prisma (local ↔ cloud)
- `src/` - React UI components

### Backend (MVC Architecture)
- `prisma/schema.prisma` - Database schema (Azure SQL)
- `src/lib/prisma.ts` - Prisma Client singleton
- `src/controllers/` - Business logic controllers
  - `syncController.ts` - Sync logic with Prisma
  - `patient.ts` - Patient CRUD operations
  - `invoice.ts` - Invoice CRUD operations
- `src/routes/` - HTTP route definitions
  - `syncPrisma.ts` - Sync routes (`/api/sync`)
  - `patient.ts` - Patient routes (`/api/patients`)
  - `invoice.ts` - Invoice routes (`/api/invoices`)
- `src/server.ts` - Express server setup

### Documentation
- `PRISMA_GUIDE.md` - Comprehensive Prisma integration guide
- `PRISMA_QUICKSTART.md` - 5-minute setup guide
- `MIGRATION_SUMMARY.md` - Migration details and comparison
- `SETUP.md` - Azure deployment guide
- `Backend/API_DOCUMENTATION.md` - Complete REST API reference
- `Backend/REFACTORING_SUMMARY.md` - Backend refactoring details

---

## IPC Commands (Frontend ↔ Backend)

### Invoices
- `save-invoice` - Save invoice to SQLite
- `load-invoices` - Load all invoices

### Patients
- `create-patient` - Create new patient
- `get-patients` - Get all patients
- `search-patients` - Search by name/UHID
- `update-patient` - Update patient info

### Sync
- `sync-now` - Trigger manual sync
- `get-sync-status` - Get pending changes & last sync time

### UI
- `print-invoice` - Print invoice
- `save-layout` - Save layout config (logo, colors, fonts)
- `load-layout` - Load layout config
- `select-logo` - Open file dialog for logo upload

---

## Environment Variables

### Backend (.env)
```env
# Prisma Database URL (Azure SQL)
DATABASE_URL="sqlserver://your-server.database.windows.net:1433;database=your-db;user=your-user;password=your-password;encrypt=true;trustServerCertificate=false"

PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=*
```

### Frontend (.env)
```env
AZURE_BACKEND_URL=https://your-app.azurewebsites.net

# For local testing:
# AZURE_BACKEND_URL=http://localhost:3000
```

---

## Deployment

### Automated Deployment (Recommended)

This project uses **GitHub Actions** for CI/CD:

1. **Setup GitHub Secrets** (one-time):
   - `AZURE_WEBAPP_PUBLISH_PROFILE` - Download from Azure Portal
   - `DATABASE_URL` - Your Azure SQL connection string

2. **Deploy**:
   ```powershell
   git push origin main  # Triggers automatic deployment
   ```

3. **Monitor**: GitHub → Actions tab

See **[.github/ACTIONS_SETUP.md](./.github/ACTIONS_SETUP.md)** for detailed setup instructions.

### Manual Deployment

See **[SETUP.md](./SETUP.md)** for manual Azure deployment including:
- Azure SQL Database setup
- Azure App Service manual deployment
- Multi-device sync testing
- Troubleshooting guide

---

## Tech Stack

**Frontend**
- Electron 27
- React 18
- TypeScript
- Vite
- Tailwind CSS 4
- **Prisma 7.1.0** (ORM for SQLite)
- axios (HTTP requests)

**Backend**
- Node.js 18+
- Express
- TypeScript
- **Prisma 7.1.0** (ORM for Azure SQL)
- Azure SQL Database

---

## Database Schema

### Prisma Unified Schema

Both Backend (Azure SQL) and Frontend (SQLite) use **the same Prisma schema**:

**Patient** - Patient information
- `id` (Int) - Primary key (auto-increment)
- `name`, `age`, `gender`, `phone`, `uhid` - Patient details
- `cloudId` (Frontend only) - Maps to Azure SQL ID
- `syncStatus` (Frontend only) - 'PENDING' | 'SYNCED' | 'CONFLICT'
- `createdAt`, `updatedAt` - Auto-managed timestamps with `@updatedAt`
- Relations: `invoices[]`

**Invoice** - Invoice records
- `id` (Int) - Primary key
- `invoiceNumber`, `patientId`, `date`, `diagnosis`, `total`
- `cloudId`, `syncStatus` (Frontend only)
- `createdAt`, `updatedAt`
- Relations: `patient`, `treatments[]`

**Treatment** - Treatment details
- `id` (Int) - Primary key
- `invoiceId`, `name`, `sessions`, `startDate`, `endDate`, `amount`
- `cloudId`, `syncStatus` (Frontend only)
- `createdAt`, `updatedAt`
- Relations: `invoice`

**SyncMetadata** (Backend) / **SyncLog** (Frontend) - Sync tracking

### Benefits
- ✅ **Type-safe queries** with auto-generated TypeScript types
- ✅ **Automatic migrations** with Prisma Migrate
- ✅ **Built-in relations** - no manual joins needed
- ✅ **@updatedAt decorator** - auto-updates timestamps

---

## Prisma Commands

### Backend
```powershell
cd Backend

# Generate Prisma Client (after schema changes)
npm run prisma:generate

# Create migration (development)
npm run prisma:migrate
# or: npx prisma migrate dev --name description

# Deploy migrations (production)
npm run prisma:deploy

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Reset database (⚠️ deletes all data)
npx prisma migrate reset
```

### Frontend
```powershell
cd Frontend

# Same commands as Backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

### When to Run
- `prisma:generate` - After editing `schema.prisma` or installing dependencies
- `prisma:migrate` - When creating/modifying database schema
- `prisma:studio` - To view/edit database records in GUI

---

## Development Tips

1. **Test Locally First**
   - Run backend with `npm run dev` in Backend/
   - Run frontend with `npm run dev` in Frontend/
   - Set `AZURE_BACKEND_URL=http://localhost:3000`
   - Ensure both Prisma Clients are generated first

2. **Check Sync Status**
   - Open Electron DevTools (Ctrl+Shift+I)
   - Call: `await window.electron.ipcRenderer.invoke('get-sync-status')`

3. **View Databases with Prisma Studio**
   - **Backend**: `cd Backend && npm run prisma:studio` (http://localhost:5555)
   - **Frontend**: `cd Frontend && npm run prisma:studio` (http://localhost:5556)
   - Or use [DB Browser for SQLite](https://sqlitebrowser.org/) for SQLite
   - SQLite location: `%APPDATA%\shri-ram-physio\shri-ram-physio.db`

4. **Backend Logs**
   - Local: Check terminal output
   - Azure: Portal → App Service → Log stream

5. **Schema Changes**
   - Edit `prisma/schema.prisma` in both Backend and Frontend
   - Run `npm run prisma:generate` to update Prisma Client
   - Run `npm run prisma:migrate` to apply changes to database
   - TypeScript will auto-detect new fields!

---

## Troubleshooting

**"Cannot find module '@prisma/client'"**
- Run `npm run prisma:generate` in Backend/ or Frontend/
- Ensure Prisma Client is generated after `npm install`

**"Cannot find module" errors**
- Run `npm install` in both Backend/ and Frontend/
- Rebuild: `npm run build` in affected directory

**Migration errors**
- Check DATABASE_URL format in .env
- For development: `npx prisma migrate reset` (⚠️ deletes data)
- For production: `npx prisma migrate resolve --applied <migration_name>`

**Sync not working**
- Check `AZURE_BACKEND_URL` in Frontend/.env
- Verify backend is running (test /health endpoint)
- Open Prisma Studio: `npm run prisma:studio` and check sync_logs table
- Check Electron DevTools console for errors

**Print not working**
- Ensure invoice data includes all required fields
- Check Electron DevTools console for errors

**Azure deployment fails**
- Verify DATABASE_URL in App Service Configuration (not AZURE_SQL_*)
- Run `npm run prisma:deploy` to apply migrations
- Check deployment logs in Kudu (Advanced Tools)

**TypeScript errors after schema change**
- Run `npm run prisma:generate` to regenerate types
- Restart TypeScript server in VS Code (Ctrl+Shift+P → "TypeScript: Restart TS Server")

---

## License

MIT

## Support

For setup help, see [SETUP.md](./SETUP.md)
