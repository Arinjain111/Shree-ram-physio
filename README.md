# Shree Ram Physiotherapy and Rehabilitation Center - Invoice Management System

A modern, offline-first Electron application for physiotherapy clinic management, featuring robust local SQLite storage and seamless cloud synchronization via PostgreSQL and Prisma ORM.

## 🚀 Quick Start

### 1. Installation
```powershell
# Install Backend Dependencies
cd Backend
npm install

# Install Frontend Dependencies
cd ../Frontend
npm install
```

### 2. Environment Setup
Create `.env` files in both directories based on `.env.example`:

**Backend (`Backend/.env`):**
```env
DATABASE_URL="postgresql://user:password@host:5432/dbname"
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=*
```

**Frontend (`Frontend/.env`):**
```env
AZURE_BACKEND_URL=http://localhost:3000
```

### 3. Development
Run these commands in separate terminals:

**Backend:**
```powershell
cd Backend
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

**Frontend:**
```powershell
cd Frontend
npm run prisma:generate
npm run dev
```

### 4. Production Build
```powershell
cd Frontend
npm run build
npm run electron:build
```

---

## 🏗️ Architecture

**Offline-First Sync System**
- **Frontend (Desktop):** Electron 39, React 18, Vite 7, Tailwind CSS 4, SQLite (via `better-sqlite3`)
- **Backend (API):** Node.js 22+, Express, PostgreSQL
- **ORM:** Prisma 7.8.0 used universally across both environments
- **Sync:** Bidirectional last-write-wins (Auto every 5 mins + Manual)

---

## 📂 High-Level Structure

```text
Shri-ram-physio/
├── Backend/               # Express API & PostgreSQL sync logic
│   ├── prisma/            # PostgreSQL Database Schema
│   └── src/               # Controllers, Routes, and Server
└── Frontend/              # Electron App & React UI
    ├── electron/          # Main process, SQLite adapter, Sync Engine
    ├── prisma/            # SQLite Database Schema
    └── src/               # React components and pages
```

---

## 💾 Prisma Commands
Used in both `Backend/` and `Frontend/`:
- `npm run prisma:generate` - Update Prisma Client after schema changes
- `npm run prisma:migrate` - Apply schema changes to database
- `npm run prisma:studio` - Open visual database browser

---

## 📝 Logging

Both processes share a single, structured logger (`logger.debug|info|warn|error` with a `context` prefix and a `fields` object).

- **Backend:** `Backend/src/utils/logger.ts` — JSON in `NODE_ENV=production`, human in dev, level filter via `LOG_LEVEL` (`debug|info|warn|error|silent`). Helpers: `logger.with({ ... })` to attach default fields, `logger.child({ level, fields })` to override, `logger.time(ctx, label, fn)` to time a block.
- **Backend HTTP:** `Backend/src/middleware/requestLogger.ts` — single line per request (IP, method, URL, status, duration, redacted body). Registered before all routes in `Backend/src/server.ts`.
- **Electron main:** `Frontend/electron/utils/logger.ts` — same surface; `forwardToRenderer: true` routes `warn`/`error` to the renderer via the `app:log` IPC channel.
- **Renderer:** `Frontend/src/utils/logger.ts` — `logger` (static, no React) and `useLogger()` (hook, raises a toast for `warn`/`error`).
- **Bridge:** `Frontend/src/components/ui/UILogBridge.tsx` — single side-effect component mounted inside `<UIProvider>`. Subscribes to `app:log` and exposes a `window.__uiBridge.showToast` shim for non-React code.

Sensitive field names (`password`, `token`, `apikey`, `api_key`, `x-api-key`) are redacted automatically.

Example:
```ts
import { logger } from '@/utils/logger';
logger.info('sync', 'Sync completed', { uploaded: 12, downloaded: 3, durationMs: 1420 });
```

---

## ☁️ Deployment

**Automated (Recommended):**
The project uses GitHub Actions for CI/CD. Pushing to `main` automatically builds and deploys the backend to Azure App Service using the `AZURE_WEBAPP_PUBLISH_PROFILE` and `DATABASE_URL` repository secrets.

**Manual Backend Deployment:**
Zip the `Backend/dist`, `node_modules`, and `package.json` and upload via Azure App Service Kudu or deploy via local Git.
