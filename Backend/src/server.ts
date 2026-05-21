import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import syncRoutes from './routes/syncPrisma';
import patientRoutes from './routes/patient';
import invoiceRoutes from './routes/invoice';
import treatmentPresetRoutes from './routes/treatmentPreset';
import resetRoutes from './routes/reset';
import prisma from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';
import { requireApiKey } from './middleware/auth';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - Required for Azure App Service
// Set to 1 to trust the first hop (Azure App Service)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || false,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting with custom key generator for Azure App Service
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 100);

const rateLimitConfig = {
  windowMs: RATE_LIMIT_WINDOW_MS,
  message: 'Too many requests from this IP, please try again later.',
  keyGenerator: (req: Request): string => {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      const clientIp = ips?.split(',')[0]?.trim()?.split(':')[0];
      if (clientIp) return clientIp;
    }
    const ip = req.ip || 'unknown';
    const cleanIp = ip.includes(':') ? ip.split(':')[0] : ip;
    return cleanIp || 'unknown';
  },
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
};

// Sync endpoint: higher limit (large payloads, less frequent)
const syncLimiter = rateLimit({ ...rateLimitConfig, windowMs: 15 * 60 * 1000, max: 30 });

// Standard endpoints: normal limit
const standardLimiter = rateLimit({ ...rateLimitConfig, max: RATE_LIMIT_MAX });

// Reset endpoint: very strict limit (dangerous operation)
const resetLimiter = rateLimit({ ...rateLimitConfig, windowMs: 60 * 60 * 1000, max: 5 });

app.use('/api/sync', syncLimiter);
app.use('/api/database', resetLimiter);
app.use('/api/', standardLimiter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/sync', syncRoutes);
app.use('/api/patients', requireApiKey, patientRoutes);
app.use('/api/invoices', requireApiKey, invoiceRoutes);
app.use('/api/presets', requireApiKey, treatmentPresetRoutes);
app.use('/api/database', requireApiKey, resetRoutes);

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
    console.log('🔄 Attempting to connect to Supabase through Prisma accelerate...');
    console.log('📊 DATABASE_URL configured:', dbUrl.substring(0, 50) + '...');
    await prisma.$connect();
    console.log('✅ Prisma connected to Supabase');
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
