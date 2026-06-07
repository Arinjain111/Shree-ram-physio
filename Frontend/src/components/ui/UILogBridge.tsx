/**
 * Wires the Electron main process log channel into the renderer's
 * UIContext. Mounted once inside <UIProvider> as a side-effect component.
 */

import { useEffect } from 'react';
import { useUI } from '@/context/UIContext';
import type { ToastType } from '@/types/ui.types';

interface MainLogPayload {
  level: 'warn' | 'error';
  context: string;
  message: string;
  timestamp: string;
  fields?: Record<string, unknown>;
}

const TOAST_TYPE: Record<'warn' | 'error', ToastType> = {
  warn: 'warning',
  error: 'error',
};

export function UILogBridge() {
  const { showToast } = useUI();

  useEffect(() => {
    // Expose a bridge for the static logger (used in non-React code).
    (window as any).__uiBridge = {
      showToast: (level: 'warn' | 'error', _context: string, message: string) => {
        showToast(TOAST_TYPE[level], message, level === 'error' ? 6000 : 4000);
      },
    };

    const api = (window as any).electronAPI;
    if (!api?.on) return;

    const unsubscribe = api.on('app:log', (payload: MainLogPayload) => {
      if (!payload || (payload.level !== 'warn' && payload.level !== 'error')) return;
      const userMessage = formatMainLogForToast(payload);
      showToast(TOAST_TYPE[payload.level], userMessage, payload.level === 'error' ? 6000 : 4000);
    });

    return () => {
      unsubscribe?.();
      delete (window as any).__uiBridge;
    };
  }, [showToast]);

  return null;
}

function formatMainLogForToast(payload: MainLogPayload): string {
  // Keep the message short — full details remain in DevTools / log file.
  return payload.message;
}
