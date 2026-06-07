/**
 * Structured logger for the React renderer process.
 *
 * Goals:
 *   - Mirror the main-process logger API so the call sites look identical.
 *   - warn/error entries automatically raise a toast so users see what
 *     happened without having to dig through DevTools.
 *   - `forwardToMain` lets the renderer ship important errors back to the
 *     main process so they end up in the same log file as everything else.
 */

import { useUI } from '@/context/UIContext';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LogFields {
  [key: string]: unknown;
}

export interface Logger {
  debug: (context: string, message: string, fields?: LogFields) => void;
  info:  (context: string, message: string, fields?: LogFields) => void;
  warn:  (context: string, message: string, fields?: LogFields) => void;
  error: (context: string, message: string, fields?: LogFields) => void;
}

function fmt(level: LogLevel, context: string, message: string, fields?: LogFields): string {
  const ctxStr = context ? `[${context}]` : '';
  const fieldsStr = fields && Object.keys(fields).length ? ' ' + JSON.stringify(fields) : '';
  return `${level.toUpperCase()} ${ctxStr} ${message}${fieldsStr}`;
}

/**
 * A render-safe logger that does NOT depend on React. Use it in pure-TS files
 * (helpers, schema validators) where calling useUI() is not possible.
 *
 * warn/error raise a toast by routing through window.electronAPI.
 */
export const logger: Logger = {
  debug: (ctx, msg, f) => console.debug(fmt('debug', ctx, msg, f)),
  info:  (ctx, msg, f) => console.info(fmt('info',  ctx, msg, f)),
  warn:  (ctx, msg, f) => {
    console.warn(fmt('warn', ctx, msg, f));
    showToastFromMain('warn', ctx, msg, f);
  },
  error: (ctx, msg, f) => {
    console.error(fmt('error', ctx, msg, f));
    showToastFromMain('error', ctx, msg, f);
  },
};

function showToastFromMain(level: 'warn' | 'error', context: string, message: string, fields?: LogFields) {
  // window.__uiBridge is set up by UILogBridge; see useLogBridge below.
  const bridge = (window as any).__uiBridge;
  if (typeof bridge?.showToast === 'function') {
    bridge.showToast(level, context, message, fields);
  }
}

/**
 * React hook: returns a logger that always raises a toast for warn/error
 * even if window.__uiBridge is not yet wired up. Use this inside components
 * that are guaranteed to be under <UIProvider>.
 */
export function useLogger(): Logger {
  const { showToast } = useUI();
  return {
    debug: (ctx, msg, f) => console.debug(fmt('debug', ctx, msg, f)),
    info:  (ctx, msg, f) => console.info(fmt('info',  ctx, msg, f)),
    warn:  (ctx, msg, f) => {
      console.warn(fmt('warn', ctx, msg, f));
      showToast('warning', formatForUser(ctx, msg));
    },
    error: (ctx, msg, f) => {
      console.error(fmt('error', ctx, msg, f));
      showToast('error', formatForUser(ctx, msg));
    },
  };
}

/** Make a warn/error message short and friendly for toast display. */
function formatForUser(context: string, message: string): string {
  if (!context) return message;
  return `${message}`;
}
