# 🚀 Quick Start Guide - Backend Setup

Choose your setup method based on your environment:

## 🐳 Option 1: Docker (Recommended - Easiest)

**Best for**: Local development, team consistency, no Azure account needed

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
- Node.js 18+ installed

### Steps

1. **Clone and Navigate**
   ```powershell
   cd Backend
   ```

2. **Install Dependencies**
   ```powershell
   npm install
   ```

3. **Start SQL Server**
   ```powershell
   .\start-db.ps1
   ```
   
   This starts a local SQL Server in Docker. Wait ~30 seconds for it to be healthy.

4. **Initialize Database**
   ```powershell
   npm run prisma:push
   ```

5. **Start Backend**
   ```powershell
   npm run dev
   ```

6. **Test It**
   ```powershell
   curl http://localhost:3000/health
   ```

✅ **Done!** Your backend is running with a local database.

### Docker Commands

```powershell
# Start SQL Server only
docker-compose up -d sqlserver

# Start everything (SQL Server + Backend)
docker-compose up -d

# Stop everything
docker-compose down

# View logs
docker-compose logs -f

# Restart backend
docker-compose restart backend
```

---

## ☁️ Option 2: Azure SQL (Production)

**Best for**: Production deployment, cloud-first approach

### Prerequisites
- Azure account with SQL Database created
- Node.js 18+ installed

### Steps

1. **Create Azure SQL Database**
   - Go to [Azure Portal](https://portal.azure.com)
   - Create SQL Database (Basic tier for dev)
   - Note connection details

2. **Configure Environment**
   
   Edit `.env`:
   ```env
   DATABASE_URL="sqlserver://your-server.database.windows.net:1433;database=your-db;user=adminuser;password=YourPassword;encrypt=true;trustServerCertificate=false"
   PORT=3000
   NODE_ENV=development
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
   ```

3. **Install Dependencies**
   ```powershell
   npm install
   ```

4. **Initialize Database**
   ```powershell
   npm run prisma:push
   ```

5. **Start Backend**
   ```powershell
   npm run dev
   ```

---

## 🧪 Verify Setup

### Test Endpoints

```powershell
# Health check
curl http://localhost:3000/health

# Create a patient
curl -X POST http://localhost:3000/api/patients -H "Content-Type: application/json" -d "{\"name\":\"Test Patient\",\"age\":30,\"gender\":\"Male\",\"phone\":\"1234567890\",\"uhid\":\"TEST001\"}"

# Get all patients
curl http://localhost:3000/api/patients
```

### View Database

```powershell
npm run prisma:studio
```

Opens http://localhost:5555 - GUI for viewing/editing database records

---

## 🐞 Troubleshooting

### Docker not starting

**Error**: `Docker is not running`

**Solution**:
1. Start Docker Desktop
2. Wait for it to fully start (whale icon in system tray)
3. Run `.\start-db.ps1` again

### Port already in use

**Error**: `Port 1433 is already allocated`

**Solution**:
```powershell
# Stop the container
docker-compose down

# Or change port in docker-compose.yml
ports:
  - "1434:1433"
```

### Database connection failed

**Error**: `Can't reach database server`

**Solutions**:

**For Docker**:
```powershell
# Check if container is running
docker ps

# Check health status
docker inspect --format='{{.State.Health.Status}}' shri-ram-physio-sqlserver

# View logs
docker-compose logs sqlserver
```

**For Azure SQL**:
1. Check firewall rules in Azure Portal
2. Add your IP address to allowed IPs
3. Enable "Allow Azure services"
4. Verify connection string format

### Prisma Client not generated

**Error**: `Cannot find module '@prisma/client'`

**Solution**:
```powershell
npm run prisma:generate
```

---

## 📝 Environment Variables

### Development (.env)

```env
# Docker SQL Server (default)
DATABASE_URL="sqlserver://localhost:1433;database=shri_ram_physio_dev;user=sa;password=YourStrong@Passw0rd;encrypt=true;trustServerCertificate=true"

PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Production (.env)

```env
# Azure SQL
DATABASE_URL="sqlserver://your-server.database.windows.net:1433;database=your-db;user=adminuser;password=YourPassword;encrypt=true;trustServerCertificate=false"

PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com
```

---

## 🎯 Next Steps

1. ✅ Backend running
2. 📱 Setup Frontend (see `../Frontend/README.md`)
3. 🔄 Test sync between Frontend and Backend
4. 🚀 Deploy to production (see `SETUP.md`)

---

## 📚 Documentation

- **[README.md](./README.md)** - Complete API documentation
- **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** - Docker detailed guide
- **[../SETUP.md](../SETUP.md)** - Azure deployment guide
- **[API Endpoints](./README.md#api-endpoints)** - REST API reference

---

## 💡 Tips

- Use Docker for local dev (easier, faster, no cloud costs)
- Use Azure SQL for production (managed, backups, scaling)
- Run `npm run prisma:studio` to view/edit data visually
- Check `docker-compose logs -f` if services don't start
- Keep `.env` out of git (already in `.gitignore`)

---

## 🆘 Need Help?

1. Check Docker Desktop is running
2. Verify port 1433 is available
3. Review logs: `docker-compose logs sqlserver`
4. Test connection: See DOCKER_SETUP.md troubleshooting section
5. For Azure SQL: Check firewall rules and connection string

---

**Estimated Setup Time**: 5-10 minutes with Docker | 15-20 minutes with Azure SQL
