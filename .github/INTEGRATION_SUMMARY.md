# Backend ↔ Frontend Integration Summary

## Current Integration Status

### ✅ What's Working

#### Frontend → Backend Communication
- **Sync Endpoint**: `POST https://shree-ram-physio-backend.azurewebsites.net/api/sync`
- **Presets Endpoint**: `GET https://shree-ram-physio-backend.azurewebsites.net/api/presets`
- **CORS**: Backend accepts requests from any origin (`*`)
- **Auto-sync**: Frontend syncs every 30 minutes automatically

#### Configuration
- Frontend reads backend URL from `.env`: `AZURE_BACKEND_URL`
- Backend accepts cross-origin requests
- Rate limiting: 100 requests per 15 minutes per IP

---

## ⚠️ Current Issues

### 1. Backend Database Connection Error
**Error:** `Login failed for user 'sa'`

**Root Cause:** GitHub secret `DATABASE_URL` is not set, so the deployment uses default local dev credentials.

**Fix Required:**
1. Add `DATABASE_URL` secret in GitHub (see [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md))
2. OR run `Backend/update-azure-config.ps1` to manually update Azure

---

## Integration Flow

### Sync Process (Frontend → Backend)

```
┌─────────────────┐
│  Frontend       │
│  (Electron)     │
│                 │
│  PrismaSyncEngine
│  └─ SQLite DB   │
└────────┬────────┘
         │
         │ POST /api/sync
         │ {patients, invoices, treatments}
         │
         ▼
┌─────────────────┐
│  Backend        │
│  (Azure App)    │
│                 │
│  syncController │
│  └─ Azure SQL   │
└─────────────────┘
```

### Data Sync Algorithm

1. **Frontend collects** pending changes (syncStatus='PENDING')
2. **Sends to Backend** with lastSyncTime
3. **Backend processes**:
   - Creates/updates patients, invoices, treatments
   - Detects conflicts (duplicate invoice numbers)
   - Returns cloud IDs and updates
4. **Frontend updates** local records with cloud IDs
5. **Marks as synced** (syncStatus='SYNCED')

---

## API Endpoints Used

### 1. Sync Endpoint
**URL:** `POST /api/sync`  
**Request Body:**
```json
{
  "lastSyncTime": "2025-12-14T12:18:28.166Z",
  "patients": [...],
  "invoices": [...],
  "treatments": [...]
}
```

**Response:**
```json
{
  "synced": {
    "patients": [{localId: 1, cloudId: 100}],
    "invoices": [...],
    "treatments": [...]
  },
  "updates": {
    "patients": [...],
    "invoices": [...],
    "treatments": [...]
  }
}
```

### 2. Treatment Presets
**URL:** `GET /api/presets`  
**Response:**
```json
[
  {
    "id": 1,
    "name": "Ultrasound Therapy",
    "defaultSessions": 10,
    "pricePerSession": 150
  }
]
```

### 3. Health Check
**URL:** `GET /health`  
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-15T14:30:00.000Z"
}
```

---

## Environment Variables

### Frontend (.env)
```env
AZURE_BACKEND_URL=https://shree-ram-physio-backend.azurewebsites.net
DATABASE_URL=file:./dev.db
```

### Backend (Azure App Service Settings)
```env
DATABASE_URL=sqlserver://shree-ram-physio-server.database.windows.net:1433;...
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=*
```

---

## Data Models Sync

### Patient
- **Frontend**: SQLite with cloudId, syncStatus
- **Backend**: Azure SQL (authoritative)
- **Sync**: Bidirectional

### Invoice
- **Frontend**: SQLite with cloudId, syncStatus
- **Backend**: Azure SQL (authoritative)
- **Conflict Resolution**: Invoice number duplicates get new numbers
- **Sync**: Bidirectional

### Treatment
- **Frontend**: SQLite with cloudId, syncStatus
- **Backend**: Azure SQL (authoritative)
- **Sync**: Bidirectional

### Treatment Presets
- **Frontend**: SQLite (read-only from backend)
- **Backend**: Azure SQL (source of truth)
- **Sync**: One-way (Backend → Frontend)

---

## Security & Performance

### Rate Limiting
- **Limit**: 100 requests per 15 minutes per IP
- **Scope**: All `/api/*` endpoints
- **Response**: 429 Too Many Requests

### CORS
- **Current**: Allows all origins (`*`)
- **Production**: Should restrict to specific origins

### Authentication
- **Current**: None (public API)
- **Future**: Consider adding API keys or JWT

### Data Validation
- **Frontend**: Zod schemas in `schemas/validation.schema.ts`
- **Backend**: Zod schemas in `src/schemas/validation.schema.ts`
- **Ensures**: Type-safe data exchange

---

## Troubleshooting

### Sync Fails with 500 Error
1. Check Azure App Service logs
2. Verify DATABASE_URL is set correctly
3. Check SQL Server firewall rules
4. Restart Azure App Service

### Preset Sync Fails
1. Verify backend is running
2. Check CORS configuration
3. Ensure Azure SQL is accessible

### Frontend Can't Connect
1. Verify backend URL in `.env`
2. Check internet connection
3. Test backend health: `curl https://shree-ram-physio-backend.azurewebsites.net/health`

---

## Next Steps to Fix Current Issue

1. **Add GitHub Secret** (Recommended):
   - Go to GitHub repository settings
   - Add `DATABASE_URL` secret with Azure SQL connection string
   - See [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md) for details

2. **OR Update Azure Directly**:
   ```powershell
   cd Backend
   .\update-azure-config.ps1
   ```

3. **Verify Fix**:
   - Test sync from Frontend
   - Check for "Login failed for user 'sa'" error should be gone
   - Sync should succeed
