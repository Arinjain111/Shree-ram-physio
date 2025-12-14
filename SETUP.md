# Shri Ram Physio - Offline-First Sync Architecture

This application uses an **offline-first architecture** where data is stored locally in SQLite and synced bidirectionally with Azure SQL in the cloud.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                         │
│  ┌──────────────┐        ┌──────────────┐              │
│  │              │        │              │              │
│  │   React UI   │◄──IPC──►│  Main Process│              │
│  │              │        │              │              │
│  └──────────────┘        └───────┬──────┘              │
│                                  │                      │
│                          ┌───────▼──────────┐           │
│                          │  Prisma Client   │           │
│                          │    (SQLite)      │           │
│                          └───────┬──────────┘           │
│                                  │                      │
│                          ┌───────▼──────────┐           │
│                          │   SyncEngine     │           │
│                          │ (Auto + Manual)  │           │
│                          └───────┬──────────┘           │
└──────────────────────────────────┼──────────────────────┘
                                   │ HTTP
                                   │ (axios)
                         ┌─────────▼──────────┐
                         │  Azure Backend     │
                         │  (Express API)     │
                         └─────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │   Azure SQL DB     │
                         │  (Cloud Storage)   │
                         └────────────────────┘
```

## How It Works

### 1. **App Loads (Offline-First)**
- Electron app reads data from **local SQLite database**
- No internet connection required
- Instant access to all patient records and invoices

### 2. **User Creates/Edits Data**
- Data saved immediately to **local SQLite**
- Record marked with `sync_status = 'PENDING'`
- User sees changes instantly (no waiting for cloud)

### 3. **Sync Process**
- **Automatic sync** every 5 minutes (when internet available)
- **Manual sync** via "Sync Now" button
- Sync engine:
  1. Collects all pending local changes
  2. Sends to Azure backend via HTTP POST
  3. Backend stores in Azure SQL Database
  4. Backend returns recent cloud updates
  5. Electron merges cloud updates into local SQLite
  6. Records marked as `sync_status = 'SYNCED'`

### 4. **Multi-Device Sync**
- Device A makes changes → syncs to cloud
- Device B syncs from cloud → gets Device A's changes
- Timestamp-based conflict resolution (last-write-wins)

---

## Setup Instructions

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Azure Account** with:
   - Azure SQL Database
   - Azure App Service
3. **Git** (for deployment)

---

## Part 1: Azure SQL Database Setup

### Step 1: Create Azure SQL Database

1. Go to [Azure Portal](https://portal.azure.com)
2. Create new **SQL Database**:
   - Resource group: `shri-ram-physio-rg`
   - Database name: `shri-ram-physio-db`
   - Server: Create new
     - Server name: `shri-ram-physio-server`
     - Location: Choose nearest region
     - Authentication: SQL authentication
     - Admin username: `adminuser`
     - Password: (strong password)
   - Compute + storage: Basic (5 DTU) for development

### Step 2: Configure Firewall

1. Go to your SQL Server → **Networking**
2. Add firewall rules:
   - Enable "Allow Azure services and resources to access this server"
   - Add your client IP address for local testing

### Step 3: Get Connection String

1. Go to your SQL Database → **Connection strings**
2. Copy the **ADO.NET** connection string
3. It looks like:
   ```
   Server=tcp:shri-ram-physio-server.database.windows.net,1433;
   Initial Catalog=shri-ram-physio-db;
   Persist Security Info=False;
   User ID=adminuser;
   Password={your_password};
   MultipleActiveResultSets=False;
   Encrypt=True;
   TrustServerCertificate=False;
   Connection Timeout=30;
   ```

---

## Part 2: Backend Deployment to Azure App Service

### Deployment Options

You have two options for deploying the backend:

1. **GitHub Actions (Recommended)** - Automated CI/CD
2. **Manual Deployment** - Traditional deployment methods

---

## Option A: GitHub Actions Deployment (Recommended)

### Why GitHub Actions?

✅ **Automated** - Deploy on every push to main  
✅ **CI checks** - Type checking, building, validation on PRs  
✅ **Migrations** - Database migrations run automatically  
✅ **Rollback** - Easy to revert via Git  
✅ **No manual steps** - Everything is automated  

### Setup Steps

1. **Create Azure App Service** (one-time):
   - Go to [Azure Portal](https://portal.azure.com)
   - Create new **App Service**
   - Resource group: `shri-ram-physio-rg`
   - Name: `shri-ram-physio-api`
   - Runtime: Node 18 LTS
   - Region: Same as your database
   - Plan: Basic B1 (or Free F1 for testing)

2. **Configure App Service**:
   - Go to App Service → **Configuration** → **Application settings**
   - Add:
     - `DATABASE_URL` = Your Azure SQL connection string
     - `NODE_ENV` = `production`
     - `ALLOWED_ORIGINS` = `*` (or specific domains)
   - Click **Save**

3. **Download Publish Profile**:
   - Go to App Service → **Overview**
   - Click **Get publish profile**
   - Save the downloaded `.PublishSettings` file

4. **Add GitHub Secrets**:
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Click **New repository secret**
   - Add:
     - Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
     - Value: Contents of the `.PublishSettings` file (entire XML)
   - Add another secret:
     - Name: `DATABASE_URL`
     - Value: Your Azure SQL connection string

5. **Deploy**:
   ```powershell
   git add .
   git commit -m "Deploy to Azure"
   git push origin main
   ```

6. **Monitor Deployment**:
   - Go to GitHub → Actions tab
   - Watch the "Deploy Backend to Azure" workflow
   - Verify deployment succeeds

7. **Verify**:
   ```powershell
   curl https://shri-ram-physio-api.azurewebsites.net/health
   ```

**That's it!** Future deployments happen automatically on every push to main.

See **[.github/ACTIONS_SETUP.md](./.github/ACTIONS_SETUP.md)** for detailed GitHub Actions setup.

---

## Option B: Manual Deployment

### Step 1: Create App Service

1. Go to [Azure Portal](https://portal.azure.com)
2. Create new **App Service**:
   - Resource group: `shri-ram-physio-rg`
   - Name: `shri-ram-physio-api`
   - Publish: **Code**
   - Runtime stack: **Node 18 LTS**
   - Operating System: **Windows**
   - Region: Same as SQL database
   - Plan: Basic B1 (or Free F1 for testing)

### Step 2: Configure Environment Variables (Manual Deployment)

**Note**: If using GitHub Actions, set `DATABASE_URL` as a GitHub secret instead.

1. Go to App Service → **Configuration** → **Application settings**
2. Add the following environment variables:

   | Name | Value |
   |------|-------|
   | `AZURE_SQL_SERVER` | `shri-ram-physio-server.database.windows.net` |
   | `AZURE_SQL_DATABASE` | `shri-ram-physio-db` |
   | `AZURE_SQL_USER` | `adminuser` |
   | `AZURE_SQL_PASSWORD` | `{your_password}` |
   | `NODE_ENV` | `production` |
   | `PORT` | `8080` |
   | `DATABASE_URL` | `sqlserver://your-server.database.windows.net:1433;database=your-db;user=your-user;password=your-password;encrypt=true;trustServerCertificate=false` |
   | `ALLOWED_ORIGINS` | `*` (or specific Electron app origins) |

   **Note**: Prisma uses `DATABASE_URL` instead of separate `AZURE_SQL_*` variables.

3. Click **Save**

### Step 3: Deploy Backend Code

**Option A: Deploy from Local Git**

1. In App Service → **Deployment Center**
2. Choose **Local Git**
3. Copy the Git remote URL
4. In your local Backend folder:
   ```powershell
   # Generate Prisma Client and run migrations
   npm run prisma:generate
   npm run prisma:deploy
   
   # Deploy code
   cd Backend
   git init
   git add .
   git commit -m "Initial backend deployment"
   git remote add azure <paste-git-url-here>
   git push azure main
   ```

**Option B: Deploy from GitHub**

1. In App Service → **Deployment Center**
2. Choose **GitHub**
3. Authorize Azure to access your GitHub
4. Select repository: `Shri-ram-physio`
5. Select branch: `main`
6. Build provider: **App Service build service**
7. Click **Save**

**Option C: Deploy via ZIP**

1. Build the backend locally:
   ```powershell
   # Generate Prisma Client and build
   npm run prisma:generate
   cd Backend
   npm run build
   ```
2. Create deployment package:
   - Include: `dist/`, `node_modules/`, `package.json`, `web.config`
   - Exclude: `src/`, `.env`, `.git/`
3. In App Service → **Deployment Center** → **ZIP Deploy**
4. Upload the ZIP file

### Step 4: Verify Deployment

1. Go to your App Service URL: `https://shri-ram-physio-api.azurewebsites.net`
2. Test health endpoint: `https://shri-ram-physio-api.azurewebsites.net/health`
3. Should return: `{"status":"healthy","timestamp":"..."}`

---

## Part 3: Frontend (Electron App) Configuration

### Step 1: Update Environment Variables

Create `.env` file in `Frontend/` directory:

```env
# Azure Backend URL (your deployed App Service)
AZURE_BACKEND_URL=https://shri-ram-physio-api.azurewebsites.net

# Local development
# AZURE_BACKEND_URL=http://localhost:3000
```

### Step 2: Generate Prisma Client and Migrate

```powershell
cd Frontend

# Generate Prisma Client
npm run prisma:generate

# Create database schema
npm run prisma:migrate
```

### Step 3: Build Electron App

```powershell
# Build includes Prisma Client automatically
npm run build
npm run electron:build
```

### Step 3: Test Sync

1. Launch the Electron app
2. Create a new invoice
3. Check sync status (should show pending changes)
4. Click "Sync Now" or wait 5 minutes
5. Verify data appears in Azure SQL Database

---

## Part 4: Testing Multi-Device Sync

### Test Scenario

1. **Install app on Device A**
   - Create Invoice #001
   - Sync to cloud

2. **Install app on Device B**
   - Open app (empty initially)
   - Trigger sync
   - Should see Invoice #001 from Device A

3. **Edit on Device B**
   - Update Invoice #001
   - Sync to cloud

4. **Sync on Device A**
   - Trigger sync
   - Should see Device B's updates

---

## Prisma ORM Benefits

This application uses **Prisma 7.1.0** for database operations:

✅ **Type Safety** - Auto-generated TypeScript types, catch errors at compile time  
✅ **Unified Schema** - Same schema for Azure SQL and SQLite  
✅ **Automatic Migrations** - Version-controlled schema changes with `prisma migrate`  
✅ **Built-in Relations** - Easy joins with `include` instead of manual SQL  
✅ **Query Builder** - Intuitive API instead of raw SQL strings  
✅ **Prisma Studio** - GUI for viewing/editing database records  

### Key Files

**Backend**
- `prisma/schema.prisma` - Database schema (Azure SQL)
- `src/lib/prisma.ts` - Prisma Client singleton
- `src/routes/syncPrisma.ts` - Sync endpoint using Prisma

**Frontend**
- `prisma/schema.prisma` - Database schema (SQLite)
- `electron/lib/prisma.ts` - Prisma Client with dynamic path
- `electron/sync/prismaSyncEngine.ts` - Sync engine using Prisma
- `electron/mainPrisma.ts` - IPC handlers using Prisma

---

## Database Schema

### Prisma Unified Schema

Both Backend and Frontend use the **same Prisma schema structure**:

### Local SQLite Tables

**patients**
- `id` INTEGER PRIMARY KEY
- `cloud_id` INTEGER (Azure SQL ID)
- `name` TEXT
- `age` INTEGER
- `gender` TEXT
- `phone` TEXT
- `uhid` TEXT UNIQUE
- `sync_status` TEXT ('SYNCED' | 'PENDING' | 'CONFLICT')
- `created_at` TEXT
- `updated_at` TEXT
- `last_sync_at` TEXT

**invoices**
- `id` INTEGER PRIMARY KEY
- `cloud_id` INTEGER
- `patient_id` INTEGER (foreign key)
- `invoice_number` TEXT UNIQUE
- `date` TEXT
- `diagnosis` TEXT
- `total` REAL
- `sync_status` TEXT
- `created_at` TEXT
- `updated_at` TEXT
- `last_sync_at` TEXT

**treatments**
- `id` INTEGER PRIMARY KEY
- `cloud_id` INTEGER
- `invoice_id` INTEGER (foreign key)
- `name` TEXT
- `sessions` INTEGER
- `start_date` TEXT
- `end_date` TEXT
- `amount` REAL
- `sync_status` TEXT
- `created_at` TEXT
- `updated_at` TEXT
- `last_sync_at` TEXT

**sync_logs**
- `id` INTEGER PRIMARY KEY
- `sync_date` TEXT
- `sync_status` TEXT ('success' | 'failed')
- `records_synced` INTEGER
- `error_message` TEXT

### Azure SQL Tables

Same schema as above, but without `cloud_id` (uses `id` as primary key).

---

## Prisma Commands

### Development Commands

```powershell
# Backend or Frontend
cd Backend  # or cd Frontend

# Generate Prisma Client (after schema changes)
npm run prisma:generate

# Create migration in development
npm run prisma:migrate
# or with name: npx prisma migrate dev --name add_field

# Deploy migrations to production
npm run prisma:deploy

# Open Prisma Studio (database GUI)
npm run prisma:studio
# Backend: http://localhost:5555
# Frontend: http://localhost:5556

# Reset database (⚠️ deletes all data)
npx prisma migrate reset
```

### When to Run These Commands

- **After `npm install`**: Run `prisma:generate` to create Prisma Client
- **After schema changes**: Run `prisma:generate` then `prisma:migrate`
- **Before deployment**: Run `prisma:deploy` on production database
- **To view data**: Run `prisma:studio` for visual database browser

---

## IPC Handlers (React ↔ Electron Communication)

### Invoice Operations

```typescript
// Save invoice
window.electron.ipcRenderer.invoke('save-invoice', invoiceData)
  .then(result => console.log(result.success))

// Load all invoices
window.electron.ipcRenderer.invoke('load-invoices')
  .then(result => console.log(result.invoices))
```

### Sync Operations

```typescript
// Manual sync
window.electron.ipcRenderer.invoke('sync-now')
  .then(result => console.log(result.result))

// Get sync status
window.electron.ipcRenderer.invoke('get-sync-status')
  .then(result => {
    console.log('Pending changes:', result.status.pendingChanges)
    console.log('Last sync:', result.status.lastSync)
  })
```

### Patient Operations

```typescript
// Create patient
window.electron.ipcRenderer.invoke('create-patient', {
  name: 'John Doe',
  age: 45,
  gender: 'Male',
  phone: '1234567890',
  uhid: 'UHID001'
})

// Get all patients
window.electron.ipcRenderer.invoke('get-patients')
  .then(result => console.log(result.patients))

// Search patients
window.electron.ipcRenderer.invoke('search-patients', 'John')
  .then(result => console.log(result.patients))
```

---

## Sync Logic Details

### Conflict Resolution

- **Strategy**: Last-write-wins (timestamp-based)
- If local `updated_at` > cloud `updated_at`:
  - Upload local changes to cloud
- If cloud `updated_at` > local `updated_at`:
  - Download cloud changes to local
  - Mark as `CONFLICT` if both changed

### ID Mapping

- Local database uses auto-increment `id`
- Cloud database uses separate auto-increment `id`
- `cloud_id` field maps local records to cloud records
- On first sync: local ID 5 might map to cloud ID 123

### Sync Frequency

- **Auto-sync**: Every 5 minutes (configurable)
- **Manual sync**: Via "Sync Now" button
- **On startup**: Optional (can be enabled)

---

## Troubleshooting

### Prisma Issues

1. **"Cannot find module '@prisma/client'"**:
   ```powershell
   npm run prisma:generate
   ```

2. **Migration failed**:
   ```powershell
   # Development: Reset and retry (⚠️ deletes data)
   npx prisma migrate reset
   
   # Production: Resolve manually
   npx prisma migrate resolve --applied <migration_name>
   ```

3. **Schema drift detected**:
   ```powershell
   # Create new migration to sync
   npx prisma migrate dev --name fix_drift
   ```

4. **TypeScript errors after schema change**:
   ```powershell
   npm run prisma:generate
   # Restart TypeScript server in VS Code
   ```

### Backend Issues

1. **Check App Service logs**:
   - Azure Portal → App Service → **Monitoring** → **Log stream**
   - Or download logs: **Advanced Tools (Kudu)** → **Download logs**

2. **Test database connection with Prisma**:
   ```powershell
   # In Backend directory
   node -e "const { initializeDatabase } = require('./dist/database/connection'); initializeDatabase().catch(console.error);"
   ```

3. **Check environment variables**:
   - Azure Portal → App Service → **Configuration**
   - Ensure all variables are set correctly

### Frontend Issues

1. **SQLite database location**:
   - Windows: `C:\Users\{username}\AppData\Roaming\shri-ram-physio\shri-ram-physio.db`
   - View with Prisma Studio: `cd Frontend && npm run prisma:studio`
   - macOS: `~/Library/Application Support/shri-ram-physio/shri-ram-physio.db`
   - Linux: `~/.config/shri-ram-physio/shri-ram-physio.db`

2. **View sync logs with Prisma Studio**:
   - Run `npm run prisma:studio` in Frontend folder
   - Open http://localhost:5556
   - Browse `sync_logs` table
   
   Or query directly:
   ```sql
   SELECT * FROM sync_logs ORDER BY sync_date DESC LIMIT 10;
   ```

3. **Check pending records**:
   ```sql
   SELECT * FROM patients WHERE sync_status = 'PENDING';
   SELECT * FROM invoices WHERE sync_status = 'PENDING';
   SELECT * FROM treatments WHERE sync_status = 'PENDING';
   ```

### Network Issues

- Sync engine checks connectivity before attempting sync
- Failed syncs are logged in `sync_logs` table
- Retries automatically on next sync interval

---

## Security Considerations

1. **HTTPS Only**: Azure App Service enforces HTTPS
2. **SQL Injection Prevention**: Parameterized queries with `mssql.Input`
3. **Rate Limiting**: 100 requests per 15 minutes per IP
4. **CORS**: Configure `ALLOWED_ORIGINS` to restrict access
5. **Encryption**: Azure SQL uses TLS encryption in transit

---

## Cost Estimates (Azure)

**Development/Testing**:
- Azure SQL: Basic tier (~$5/month)
- App Service: Free F1 or Basic B1 (~$13/month)
- **Total**: ~$18/month

**Production**:
- Azure SQL: Standard S0 (~$15/month)
- App Service: Standard S1 (~$70/month)
- **Total**: ~$85/month

---

## Future Enhancements

1. **User Authentication**: Add Azure AD or Auth0
2. **Role-Based Access**: Admin vs. Staff permissions
3. **Audit Logs**: Track who made what changes
4. **Backup & Restore**: Automated Azure SQL backups
5. **Analytics Dashboard**: Patient trends, revenue reports
6. **Mobile App**: React Native version with same sync engine

---

## Support

For issues or questions:
- Check Azure App Service logs
- Review `sync_logs` table in SQLite
- Verify environment variables
- Test backend health endpoint

---

## Additional Documentation

For detailed Prisma integration information, see:
- **[PRISMA_GUIDE.md](./PRISMA_GUIDE.md)** - Comprehensive Prisma integration guide
- **[PRISMA_QUICKSTART.md](./PRISMA_QUICKSTART.md)** - 5-minute setup guide
- **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Migration details from old system

---

**Last Updated**: December 2024
