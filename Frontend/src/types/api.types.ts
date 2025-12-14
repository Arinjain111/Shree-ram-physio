/**
 * API and IPC response type definitions for communication
 * between Electron renderer and main process, as well as HTTP APIs.
 */

import type { ToastType } from './ui.types';

/**
 * Standard IPC response format used across Electron IPC handlers
 */
export interface IPCResponse<T = unknown> {
  success: boolean;
  error?: string;
  statusCode?: number;
  data?: T;
}

/**
 * Normalized API error structure for frontend error handling
 */
export interface NormalizedApiError {
  status?: number;
  code?: string;
  message: string;
  details?: unknown;
  isNetworkError?: boolean;
  isValidationError?: boolean;
  raw?: unknown;
}

/**
 * Function signature for showing toasts (used in error handlers)
 */
export type ShowToastFn = (type: ToastType, message: string, duration?: number) => void;

/**
 * Backend validation error structure (from Zod)
 */
export interface ValidationError {
  path: string;
  message: string;
  code?: string;
}

/**
 * Backend API error response structure
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  details?: {
    errors?: ValidationError[];
  };
}

/**
 * Generic success API response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
