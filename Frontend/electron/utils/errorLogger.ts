/**
 * Concise Error Logger Utility
 * Formats errors in a readable, minimal format
 *
 * This is a thin compatibility shim around the structured `logger` (../utils/logger).
 * New code should call `logger.error(...)` / `logger.warn(...)` / `logger.info(...)` directly.
 * These helpers are kept for the dozens of existing call sites that already pass
 * `(context, error)` or `(context, message)` shaped arguments.
 */

import { logger } from './logger';

interface ErrorDetails {
  code?: string;
  message: string;
  location?: string;
}

/**
 * Logs errors in a concise format: [ERROR_CODE] Message - Location
 */
export function logError(context: string, error: any): void {
  const details = parseError(error);
  logger.error(context, details.message, {
    code: details.code,
    location: details.location,
  });
}

/**
 * Logs warnings in a concise format
 */
export function logWarning(context: string, message: string): void {
  logger.warn(context, message);
}

/**
 * Logs info in a concise format (only in development)
 */
export function logInfo(context: string, message: string): void {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(context, message);
  }
}

/**
 * Parse error object to extract relevant details
 */
function parseError(error: any): ErrorDetails {
  // Axios errors with API response
  if (error.isAxiosError) {
    // Check if backend sent structured error response
    if (error.response?.data) {
      const apiError = error.response.data;
      return {
        code: apiError.code || `HTTP_${error.response.status}`,
        message: apiError.message || error.message,
        location: error.config?.url
      };
    }

    // Network errors
    if (error.code === 'ECONNREFUSED') {
      return {
        code: 'ECONNREFUSED',
        message: 'Backend server not running',
        location: error.config?.url
      };
    }

    // Other axios errors
    return {
      code: error.code || 'NETWORK_ERROR',
      message: error.message,
      location: error.config?.url
    };
  }

  // Prisma errors
  if (error.code?.startsWith('P')) {
    return {
      code: error.code,
      message: error.message?.split('\n')[0] || 'Database error',
      location: error.meta?.target
    };
  }

  // Standard errors
  return {
    code: error.code || error.name,
    message: error.message || String(error),
    location: error.stack?.split('\n')[1]?.trim()
  };
}

/**
 * Format success message
 */
export function logSuccess(context: string, message: string): void {
  logger.info(context, message);
}
