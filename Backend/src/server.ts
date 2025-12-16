import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import syncRoutes from './routes/syncPrisma';
import patientRoutes from './routes/patient';
import invoiceRoutes from './routes/invoice';
import treatmentPresetRoutes from './routes/treatmentPreset';
import prisma from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - Required for Azure App Service
// Set to 1 to trust the first hop (Azure App Service)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting with custom key generator for Azure App Service
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  // Custom key generator to handle Azure's X-Forwarded-For format
  keyGenerator: (req: Request): string => {
    // Get the leftmost IP from X-Forwarded-For header (the real client IP)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      // Extract first IP and remove port if present
      const clientIp = ips?.split(',')[0]?.trim()?.split(':')[0];
      if (clientIp) return clientIp;
    }
    // Fallback to req.ip, removing port if present
    const ip = req.ip || 'unknown';
    const cleanIp = ip.includes(':') ? ip.split(':')[0] : ip;
    return cleanIp || 'unknown';
  },
  // Skip validation warnings for production environment
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});
app.use('/api/', limiter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/sync', syncRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/presets', treatmentPresetRoutes);

// Centralized error handler (must be after routes)
app.use(errorHandler);

// Start server
async function startServer() {
  // Start server immediately regardless of DB status
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  try {
    // Test Prisma connection in background
    const dbUrl = process.env.DATABASE_URL || 'NOT_SET';
    console.log('🔄 Attempting to connect to Azure SQL...');
    console.log('📊 DATABASE_URL configured:', dbUrl.substring(0, 50) + '...');
    await prisma.$connect();
    console.log('✅ Prisma connected to Azure SQL');
  } catch (error) {
    console.error('⚠️  Database connection failed at startup (Server is still running):');
    console.error(error instanceof Error ? error.message : error);
    // We do NOT exit the process, allowing the server to handle requests
    // Requests requiring DB will fail with 500s, which is expected behavior
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
