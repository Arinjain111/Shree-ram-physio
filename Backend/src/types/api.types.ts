/**
 * Backend API type definitions for request/response structures.
 */

/**
 * Standard validation error structure (from Zod)
 */
export interface ValidationError {
  path: string;
  message: string;
  code?: string;
}

/**
 * API error response structure
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

/**
 * Options for creating ApiError
 */
export interface ApiErrorOptions {
  code?: string;
  details?: unknown;
}
