import * as dotenv from 'dotenv';

dotenv.config();

export function getBackendUrl(): string {
  return process.env.AZURE_BACKEND_URL || 'http://localhost:3000';
}
