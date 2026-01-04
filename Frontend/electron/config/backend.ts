import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

let cachedBackendUrl: string | null = null;

function loadEnvValue(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const result = dotenv.config({ path: filePath });
  return result.parsed?.AZURE_BACKEND_URL;
}

export function getBackendUrl(): string {
  if (cachedBackendUrl) {
    console.log(`🔗 Using cached backend URL: ${cachedBackendUrl}`);
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
      backendUrl = loadEnvValue(candidate);
    }
  }

  if (!backendUrl && app?.isPackaged) {
    backendUrl = 'https://shree-ram-physio-backend.azurewebsites.net';
    console.log(`🌐 Using packaged app fallback: ${backendUrl}`);
  }

  cachedBackendUrl = backendUrl || 'http://localhost:3000';
  console.log(`✅ Final backend URL: ${cachedBackendUrl}`);
  return cachedBackendUrl;
}
