# Docker Setup for Shri Ram Physio Backend

This directory contains Docker configuration for running the backend with a local SQL Server database.

## Quick Start

### 1. Start Everything (Database + Backend)

```powershell
# Start SQL Server and Backend
docker-compose up -d

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

### 2. Start Only SQL Server (for local development)

```powershell
# Start only SQL Server
docker-compose up -d sqlserver

# Run backend locally
npm run dev
```

## Configuration

### Local Development (Default)
- **Database**: Docker SQL Server on `localhost:1433`
- **Database Name**: `shri_ram_physio_dev`
- **User**: `sa`
- **Password**: `YourStrong@Passw0rd`
- **Backend**: http://localhost:3000

### Production (Azure)
Update `.env` to use Azure SQL connection string:
```env
DATABASE_URL="sqlserver://shree-ram-physio-server.database.windows.net:1433;database=shree-ram-physio-db;user=adminUser;password=YOUR_PASSWORD;encrypt=true;trustServerCertificate=false"
```

## Docker Commands

### Development Workflow

```powershell
# Start services
docker-compose up -d

# Initialize database schema
docker-compose exec backend npx prisma db push

# View backend logs
docker-compose logs -f backend

# View SQL Server logs
docker-compose logs -f sqlserver

# Restart backend only
docker-compose restart backend

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes database data)
docker-compose down -v
```

### Building Images

```powershell
# Build backend image
docker-compose build backend

# Build without cache
docker-compose build --no-cache backend

# Build production image
docker-compose -f docker-compose.prod.yml build
```

### Database Management

```powershell
# Connect to SQL Server container
docker exec -it shri-ram-physio-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd"

# Run SQL queries
docker exec -it shri-ram-physio-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -Q "SELECT name FROM sys.databases"

# Backup database
docker exec -it shri-ram-physio-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -Q "BACKUP DATABASE shri_ram_physio_dev TO DISK = '/var/opt/mssql/backup/db.bak'"
```

## Environment Variables

### Backend Container

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQL Server connection string | `sqlserver://sqlserver:1433;database=shri_ram_physio_dev;...` |
| `PORT` | Backend port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `ALLOWED_ORIGINS` | CORS origins | `http://localhost:5173,http://localhost:3000` |

### SQL Server Container

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCEPT_EULA` | Accept SQL Server license | `Y` |
| `MSSQL_SA_PASSWORD` | SA password | `YourStrong@Passw0rd` |
| `MSSQL_PID` | SQL Server edition | `Developer` |

## Volumes

- **sqlserver_data**: Persists SQL Server database files
  - Location: Docker volume `sqlserver_data`
  - Survives container restarts
  - Deleted with `docker-compose down -v`

## Networks

- **backend-network**: Bridge network for backend-sqlserver communication

## Health Checks

### SQL Server
- **Test**: `sqlcmd -S localhost -U sa -P "..." -Q "SELECT 1"`
- **Interval**: 10s
- **Retries**: 10
- **Start Period**: 10s

### Backend
- **Test**: HTTP GET to `/health`
- **Interval**: 30s
- **Retries**: 3
- **Start Period**: 10s

## Troubleshooting

### Backend can't connect to SQL Server

```powershell
# Check if SQL Server is healthy
docker-compose ps

# Check SQL Server logs
docker-compose logs sqlserver

# Test connection manually
docker exec -it shri-ram-physio-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -Q "SELECT 1"
```

### Database schema not created

```powershell
# Run Prisma push manually
docker-compose exec backend npx prisma db push

# Or from host (if running SQL Server in Docker only)
npm run prisma:push
```

### Port already in use

```powershell
# Change ports in docker-compose.yml
ports:
  - "1434:1433"  # SQL Server
  - "3001:3000"  # Backend

# Update DATABASE_URL in .env accordingly
```

### Reset database

```powershell
# Stop and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

## Production Deployment

### Using docker-compose.prod.yml

```powershell
# Build production image
docker-compose -f docker-compose.prod.yml build

# Start production container
docker-compose -f docker-compose.prod.yml up -d

# Set environment variables
export DATABASE_URL="sqlserver://..."
export ALLOWED_ORIGINS="https://yourdomain.com"
```

### Deploy to Azure Container Instances

```powershell
# Build and push image
docker build -t yourusername/shri-ram-physio-backend:latest .
docker push yourusername/shri-ram-physio-backend:latest

# Create container instance
az container create \
  --resource-group shri-ram-physio-rg \
  --name shri-ram-physio-backend \
  --image yourusername/shri-ram-physio-backend:latest \
  --dns-name-label shri-ram-physio-api \
  --ports 3000 \
  --environment-variables \
    PORT=3000 \
    NODE_ENV=production \
  --secure-environment-variables \
    DATABASE_URL="sqlserver://..." \
  --cpu 1 --memory 1
```

## Architecture

```
┌─────────────────────────────────────┐
│         Docker Compose              │
│                                     │
│  ┌─────────────┐  ┌──────────────┐ │
│  │   Backend   │  │  SQL Server  │ │
│  │  (Node.js)  │──│  (MSSQL 2022)│ │
│  │   :3000     │  │   :1433      │ │
│  └─────────────┘  └──────────────┘ │
│         │                │          │
│         └────────────────┘          │
│       backend-network               │
└─────────────────────────────────────┘
           │
           ▼
    http://localhost:3000
```

## Best Practices

1. **Use Docker for local development** - Consistent environment across team
2. **Use Azure SQL for production** - Managed service with backups
3. **Keep volumes** - Don't use `docker-compose down -v` unless resetting
4. **Monitor logs** - Use `docker-compose logs -f` to debug issues
5. **Health checks** - Ensure services are healthy before testing

## Next Steps

1. Start Docker services: `docker-compose up -d`
2. Verify backend health: `curl http://localhost:3000/health`
3. Test API endpoints with Postman or curl
4. View database with Prisma Studio: `npm run prisma:studio`
5. Configure Frontend to use `http://localhost:3000`
