import { PrismaClient } from '../generated/prisma';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Creates a Prisma client appropriate for the current DATABASE_URL:
 *
 *  - prisma://  → Prisma Accelerate (production / Supabase)
 *               Uses HTTP transport; no local driver adapter needed.
 *
 *  - postgresql:// → Plain PostgreSQL (local Docker dev)
 *               Uses the pg driver adapter required by Prisma v7.
 *
 * The return type is cast to PrismaClient so that the rest of the codebase
 * sees a stable, consistent type regardless of which branch is taken.
 * The $extends(withAccelerate()) call is transparent at runtime — all Prisma
 * Client methods still work identically; Accelerate just adds caching.
 */
function createPrismaClient(): PrismaClient {
  const dbUrl = process.env['DATABASE_URL'] ?? '';

  if (dbUrl.startsWith('prisma://')) {
    // Production: Prisma Accelerate proxy (HTTP-based, no pg adapter needed)
    return new PrismaClient({ accelerateUrl: dbUrl })
      .$extends(withAccelerate()) as unknown as PrismaClient;
  }

  // Local Docker / direct PostgreSQL: Prisma v7 requires a driver adapter.
  const adapter = new PrismaPg({ connectionString: dbUrl });
  return new PrismaClient({ adapter });
}

// Prevent multiple PrismaClient instances in development (hot-reload safe).
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;