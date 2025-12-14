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

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
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
    console.log('🔄 Attempting to connect to Azure SQL...');
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
