// Vite injects env vars under import.meta.env; cast to avoid TS complaints in build
const env = (import.meta as any).env || {};
export const BACKEND_URL = env.VITE_API_BASE_URL || 'http://localhost:3000';
