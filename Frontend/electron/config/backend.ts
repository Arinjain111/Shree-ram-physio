import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

let cachedBackendUrl: string | null = null;
let cachedApiKey: string | null = null;

function loadEnvFile(filePath: string): Record<string, string> | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const result = dotenv.config({ path: filePath });
  return result.parsed;
}

export function getBackendUrl(): string {
  if (cachedBackendUrl) {
    console.log(` Using cached backend URL: ${cachedBackendUrl}`);
    return cachedBackendUrl;
  }

  let backendUrl = process.env.AZURE_BACKEND_URL;
  console.log(`🔍 Resolving backend URL from env: ${backendUrl || 'NOT SET'}`);

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
    console.log(` Using packaged app fallback: ${backendUrl}`);
  }

  cachedBackendUrl = backendUrl || 'http://localhost:3000';
  console.log(`✅ Final backend URL: ${cachedBackendUrl}`);
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

  cachedApiKey = apiKey || '';
  console.log(`🔑 API Key configured: ${cachedApiKey ? 'YES' : 'NO'}`);
  return cachedApiKey;
}
