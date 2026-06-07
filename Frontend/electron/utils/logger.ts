/**
 * Structured logger for the Electron main process.
 *
 * Goals:
 *   - Single source of truth for log formatting in the main process.
 *   - Sends warn/error to the renderer as a toast (when a window exists)
 *     so users see a friendly notification, not a wall of console output.
 *   - Tames the existing log spam: each entry is one line, with a context
 *     prefix, level emoji, and a JSON metadata block (when fields are
 *     provided).
 */

import { BrowserWindow } from 'electron';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const LEVEL_EMOJI: Record<LogLevel, string> = {
  debug: '·',
  info: 'ℹ',
  warn: '⚠',
  error: '✖',
  silent: '',
};

function resolveLevel(): LogLevel {
  const raw = (process.env['LOG_LEVEL'] || '').toLowerCase() as LogLevel;
  if (raw in LEVEL_RANK) return raw;
  return process.env['NODE_ENV'] === 'production' ? 'info' : 'debug';
}

function timestamp(): string {
  return new Date().toISOString();
}

function safeStringify(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 0);
  } catch {
    return '[unserialisable]';
  }
}

export interface LogFields {
  [key: string]: unknown;
}

export interface Logger {
  debug: (context: string, message: string, fields?: LogFields) => void;
  info:  (context: string, message: string, fields?: LogFields) => void;
  warn:  (context: string, message: string, fields?: LogFields) => void;
  error: (context: string, message: string, fields?: LogFields) => void;
  with:  (defaultFields: LogFields) => Logger;
  child: (overrides: { level?: LogLevel; fields?: LogFields }) => Logger;
  /** Time a block and log duration at info level. */
  time:  <T>(context: string, label: string, fn: () => Promise<T>) => Promise<T>;
}

interface LoggerOptions {
  level: LogLevel;
  baseFields: LogFields;
  /** When true, warn/error entries are also sent to the renderer as a toast. */
  forwardToRenderer: boolean;
}

function makeLogger(opts: LoggerOptions): Logger {
  const { level, baseFields } = opts;
  const threshold = LEVEL_RANK[level];

  function emit(recordLevel: LogLevel, context: string, message: string, fields?: LogFields) {
    if (LEVEL_RANK[recordLevel] < threshold) return;

    const merged: LogFields = { ...baseFields, ...(fields || {}) };
    const emoji = LEVEL_EMOJI[recordLevel];
    const ctxStr = context ? `[${context}]` : '';
    const fieldsStr = merged && Object.keys(merged).length ? ' ' + safeStringify(merged) : '';

    const line = `${timestamp()} ${emoji} ${ctxStr} ${message}${fieldsStr}`;

    if (recordLevel === 'error') {
      console.error(line);
    } else if (recordLevel === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }

    if (opts.forwardToRenderer && (recordLevel === 'warn' || recordLevel === 'error')) {
      sendToastToRenderer(recordLevel, context, message, merged);
    }
  }

  return {
    debug: (ctx, msg, f) => emit('debug', ctx, msg, f),
    info:  (ctx, msg, f) => emit('info',  ctx, msg, f),
    warn:  (ctx, msg, f) => emit('warn',  ctx, msg, f),
    error: (ctx, msg, f) => emit('error', ctx, msg, f),
    with: (extra) => makeLogger({ ...opts, baseFields: { ...baseFields, ...extra } }),
    child: (overrides) => makeLogger({
      ...opts,
      level: overrides.level ?? level,
      baseFields: { ...baseFields, ...(overrides.fields || {}) },
    }),
    time: async <T,>(ctx: string, label: string, fn: () => Promise<T>): Promise<T> => {
      const start = Date.now();
      try {
        const result = await fn();
        emit('info', ctx, `${label} completed`, { durationMs: Date.now() - start });
        return result;
      } catch (err) {
        emit('error', ctx, `${label} failed`, {
          durationMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
  };
}

/**
 * Sends a toast-style notification to every open renderer.
 * Silently no-ops if no window is open (e.g. during early boot).
 */
function sendToastToRenderer(level: 'warn' | 'error', context: string, message: string, fields: LogFields) {
  try {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) return;
    const payload = {
      level,
      context,
      message,
      fields: redactFields(fields),
      timestamp: new Date().toISOString(),
    };
    for (const w of windows) {
      if (!w.isDestroyed()) {
        w.webContents.send('app:log', payload);
      }
    }
  } catch {
    // Logging must never throw.
  }
}

const REDACT_KEYS = new Set(['password', 'token', 'apikey', 'api_key', 'x-api-key']);
function redactFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[redacted]' : v;
  }
  return out;
}

export const logger: Logger = makeLogger({
  level: resolveLevel(),
  baseFields: {},
  forwardToRenderer: true,
});

/** A logger variant that never sends toasts. Useful in tight loops / hot paths. */
export const silentLogger: Logger = makeLogger({
  level: resolveLevel(),
  baseFields: {},
  forwardToRenderer: false,
});
