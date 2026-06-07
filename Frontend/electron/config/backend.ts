import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { logger } from '../utils/logger';

let cachedBackendUrl: string | null = null;
let cachedApiKey: string | null = null;

function loadEnvFile(filePath: string): Record<string, string> | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const result = dotenv.config({ path: filePath });
  return result.parsed;
}

export function getBackendUrl(): string {
  if (cachedBackendUrl) {
    logger.debug('config', 'Using cached backend URL', { url: cachedBackendUrl });
    return cachedBackendUrl;
  }

  let backendUrl = process.env.AZURE_BACKEND_URL;
  logger.debug('config', 'Resolving backend URL from env', { env: backendUrl || 'NOT SET' });

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.production')
  ];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, '.env'));
    candidates.push(path.join(process.resourcesPath, '.env.production'));
  }

  for (const candidate of candidates) {
    if (!backendUrl) {
      const parsed = loadEnvFile(candidate);
      if (parsed?.AZURE_BACKEND_URL) {
        backendUrl = parsed.AZURE_BACKEND_URL;
      }
    }
  }

  if (!backendUrl && app?.isPackaged) {
    backendUrl = 'https://shree-ram-physio-backend.azurewebsites.net';
    logger.debug('config', 'Using packaged app fallback', { url: backendUrl });
  }

  cachedBackendUrl = backendUrl || 'http://localhost:3000';
  logger.info('config', 'Final backend URL', { url: cachedBackendUrl });
  return cachedBackendUrl;
}

export function getApiKey(): string {
  if (cachedApiKey !== null) {
    return cachedApiKey;
  }

  let apiKey = process.env.BACKEND_API_KEY;

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.production')
  ];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, '.env'));
    candidates.push(path.join(process.resourcesPath, '.env.production'));
  }

  for (const candidate of candidates) {
    if (!apiKey) {
      const parsed = loadEnvFile(candidate);
      if (parsed?.BACKEND_API_KEY) {
        apiKey = parsed.BACKEND_API_KEY;
      }
    }
  }

  if (!apiKey && app?.isPackaged) {
    apiKey = '134a56b2cc6b4aab2bdf0b2361b7b5d5428c12bc31a146752f6bf5810b59b2c3';
  }

  cachedApiKey = apiKey || '';
  logger.debug('config', 'API Key configured', { configured: !!cachedApiKey });
  return cachedApiKey;
}
