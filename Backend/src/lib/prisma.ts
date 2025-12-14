import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import * as mssql from 'mssql';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Parse DATABASE_URL to extract connection parameters
// Format: sqlserver://HOST:PORT;database=DB;user=USER;password=PASS;encrypt=true;trustServerCertificate=true
const connectionString = process.env.DATABASE_URL || '';
const urlMatch = connectionString.match(/sqlserver:\/\/([^:;]+)(?::(\d+))?/);
const host = urlMatch?.[1] || 'localhost';
const port = urlMatch?.[2] ? parseInt(urlMatch[2]) : 1433;

// Extract parameters from semicolon-separated format
const params = new Map<string, string>();
const paramString = connectionString.split(';').slice(1).join(';'); // Skip the host part
paramString.split(';').forEach(param => {
  const [key, value] = param.split('=');
  if (key && value) {
    params.set(key.toLowerCase(), value);
  }
});

const config: mssql.config = {
  server: host,
  port: port,
  database: params.get('database') || 'shri_ram_physio_dev',
  user: params.get('user') || 'sa',
  password: params.get('password') || 'YourStrong@Passw0rd',
  options: {
    encrypt: params.get('encrypt') === 'true',
    trustServerCertificate: params.get('trustservercertificate') === 'true',
  },
};

const adapter = new PrismaMssql(config);

export const prisma = globalForPrisma.prisma || new PrismaClient({ 
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
