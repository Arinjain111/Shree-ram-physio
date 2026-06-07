/**
 * HTTP access-log middleware.
 *
 * Replaces the wall of raw `console.log` lines with a single structured entry
 * per request, including duration, status, and the requesting IP (correctly
 * resolved behind Azure App Service's reverse proxy).
 */

import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

const SENSITIVE_BODY_KEYS = new Set(['password', 'token', 'apikey', 'api_key', 'x-api-key']);

function safeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    out[k] = SENSITIVE_BODY_KEYS.has(k.toLowerCase()) ? '[redacted]' : v;
  }
  return out;
}

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = (value ?? '').split(',')[0]?.trim();
    if (first) return first;
  }
  const ip = req.ip || 'unknown';
  return ip.includes(':') ? (ip.split(':')[0] ?? 'unknown') : ip;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const reqLog = logger.child({ fields: { method: req.method, path: req.path, ip: clientIp(req) } });

  reqLog.debug('http', 'request received', { query: req.query, body: safeBody(req.body) });

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const fields = {
      status: res.statusCode,
      durationMs,
      bytes: Number(res.getHeader('content-length') || 0) || undefined,
    };
    if (res.statusCode >= 500) {
      reqLog.error('http', `${req.method} ${req.path} → ${res.statusCode}`, fields);
    } else if (res.statusCode >= 400) {
      reqLog.warn('http', `${req.method} ${req.path} → ${res.statusCode}`, fields);
    } else {
      reqLog.info('http', `${req.method} ${req.path} → ${res.statusCode}`, fields);
    }
  });

  next();
}
