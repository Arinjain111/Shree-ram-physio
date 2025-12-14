import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import { app } from 'electron';
import * as path from 'path';

// Create Prisma Client with dynamic SQLite path
let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    // Set database path dynamically
    const dbPath = path.join(app.getPath('userData'), 'shri-ram-physio.db');
    const url = `file:${dbPath}`;
    
    // Create Prisma adapter for libSQL (Prisma 7)
    const adapter = new PrismaLibSql({ url });
    
    prismaClient = new PrismaClient({
      adapter,
      // Minimal logging - only errors
      log: ['error'],
    });
  }
  
  return prismaClient;
}

export async function disconnectPrisma() {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}

export default getPrismaClient;
