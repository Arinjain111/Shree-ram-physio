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
import diagnosisRoutes from './routes/diagnosis';
import resetRoutes from './routes/reset';
import prisma from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { requireApiKey } from './middleware/auth';
import { logger } from './utils/logger';

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

// Request access log (after body parsing so we can log safe body summaries)
app.use(requestLogger);

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
app.use('/api/diagnosis', requireApiKey, diagnosisRoutes);
app.use('/api/database', requireApiKey, resetRoutes);

// Centralized error handler (must be after routes)
app.use(errorHandler);

// Start server
async function startServer() {
  // Start server immediately regardless of DB status
  app.listen(PORT, () => {
    logger.info('server', `Listening on port ${PORT}`, { env: process.env['NODE_ENV'] || 'development' });
  });

  try {
    // Test Prisma connection in background
    const dbUrl = process.env['DATABASE_URL'] || 'NOT_SET';
    logger.info('db', 'Connecting to database', { urlPrefix: dbUrl.substring(0, 50) + '...' });
    await prisma.$connect();
    logger.info('db', 'Database connection established');
  } catch (error) {
    logger.error('db', 'Database connection failed at startup (server still listening)', {
      error: error instanceof Error ? error.message : String(error),
    });
    // We do NOT exit the process, allowing the server to handle requests
    // Requests requiring DB will fail with 500s, which is expected behavior
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('server', 'Received SIGINT, shutting down');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('server', 'Received SIGTERM, shutting down');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
