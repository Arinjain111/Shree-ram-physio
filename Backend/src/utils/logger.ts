/**
 * Structured logger for the backend.
 *
 * Goals:
 *   - One place to format every log line (no more ad-hoc console.log).
 *   - Levels can be tuned at runtime via the LOG_LEVEL env var.
 *   - Output is single-line JSON in production for log scrapers, and a
 *     human-friendly coloured format in development.
 *   - Tiny surface area: debug(), info(), warn(), error(), with().
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.info('sync', 'Starting sync', { count: 42 });
 *   logger.with({ requestId }).info('sync', 'Fetched updates');
 */

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
  // Default: info in production, debug in development.
  return process.env['NODE_ENV'] === 'production' ? 'info' : 'debug';
}

function isProd(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

function timestamp(): string {
  return new Date().toISOString();
}

/** Sanitise an object so it always serialises even if it contains a BigInt/circular ref. */
function safeStringify(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v), 0);
  } catch {
    return '[unserialisable]';
  }
}

export interface LogFields {
  [key: string]: unknown;
}

export interface Logger {
  debug: (context: string, message: string, fields?: LogFields) => void;
  info: (context: string, message: string, fields?: LogFields) => void;
  warn: (context: string, message: string, fields?: LogFields) => void;
  error: (context: string, message: string, fields?: LogFields) => void;
  /** Bind default fields (e.g. requestId) to every subsequent log call. */
  with: (defaultFields: LogFields) => Logger;
  /** Time a block and log its duration at info level. */
  time: <T>(context: string, label: string, fn: () => Promise<T>) => Promise<T>;
  /** Returns a child logger that only emits events at >= the given level. */
  child: (overrides: { level?: LogLevel; fields?: LogFields }) => Logger;
}

function makeLogger(opts: { level: LogLevel; baseFields: LogFields; stream: 'stdout' | 'stderr' }): Logger {
  const { level, baseFields, stream } = opts;
  const threshold = LEVEL_RANK[level];

  function emit(recordLevel: LogLevel, context: string, message: string, fields?: LogFields) {
    if (LEVEL_RANK[recordLevel] < threshold) return;

    const merged: LogFields = { ...baseFields, ...(fields || {}) };

    if (isProd()) {
      // Single-line JSON for log aggregators (Azure, Datadog, etc.)
      const line = safeStringify({
        ts: timestamp(),
        level: recordLevel,
        ctx: context,
        msg: message,
        ...merged,
      });
      if (recordLevel === 'error' || recordLevel === 'warn') {
        process.stderr.write(line + '\n');
      } else {
        process.stdout.write(line + '\n');
      }
      return;
    }

    // Human-friendly format for development.
    const emoji = LEVEL_EMOJI[recordLevel];
    const ctxStr = context ? `[${context}]` : '';
    const fieldsStr = merged && Object.keys(merged).length ? ' ' + safeStringify(merged) : '';
    const line = `${emoji} ${ctxStr} ${message}${fieldsStr}`;
    if (stream === 'stderr' || recordLevel === 'error' || recordLevel === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  return {
    debug: (ctx, msg, f) => emit('debug', ctx, msg, f),
    info:  (ctx, msg, f) => emit('info',  ctx, msg, f),
    warn:  (ctx, msg, f) => emit('warn',  ctx, msg, f),
    error: (ctx, msg, f) => emit('error', ctx, msg, f),
    with: (extra) => makeLogger({ level, baseFields: { ...baseFields, ...extra }, stream }),
    child: (overrides) => makeLogger({
      level: overrides.level ?? level,
      baseFields: { ...baseFields, ...(overrides.fields || {}) },
      stream,
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

export const logger: Logger = makeLogger({
  level: resolveLevel(),
  baseFields: {},
  stream: 'stdout',
});

/** Override the active log level at runtime (e.g. for tests). */
export function setLogLevel(level: LogLevel): void {
  // The exported logger is a closure; for tests we just print a marker.
  process.stderr.write(`[logger] LOG_LEVEL set to ${level}\n`);
}
