import { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import type { ApiErrorOptions } from '../types';

/**
 * Central API error type used across the backend.
 * All intentional HTTP errors should throw ApiError so that
 * the global error handler can format them consistently.
 */
export class ApiError extends Error {
  public statusCode: number;
  public code?: string | undefined;
  public details?: unknown;

  constructor(statusCode: number, message: string, options?: ApiErrorOptions) {
    super(message);
    this.statusCode = statusCode;
    this.code = options?.code;
    this.details = options?.details;

    // Set the prototype explicitly when targeting ES5
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Helper to wrap async route handlers and forward errors
 * to Express' error pipeline instead of needing try/catch
 * in every controller.
 */
export const asyncHandler = <TRequest extends Request = Request, TResponse extends Response = Response>(
  fn: (req: TRequest, res: TResponse, next: NextFunction) => Promise<unknown>
) => {
  return (req: TRequest, res: TResponse, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

function mapZodIssues(issues: z.core.$ZodIssue[]) {
  return issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Global Express error handler.
 * This should be the single place that turns errors into HTTP responses.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Log error concisely in development
  if (process.env.NODE_ENV === 'development') {
    if (err instanceof ApiError) {
      console.error(`[${err.code || 'API_ERROR'}] ${err.statusCode}: ${err.message}`);
    } else if (err instanceof ZodError) {
      console.error(`[VALIDATION_ERROR] 400: ${err.issues.length} validation issues`);
    } else {
      console.error(`[SERVER_ERROR] 500: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: mapZodIssues(err.issues),
    });
  }

  // Intentionally thrown API errors
  if (err instanceof ApiError) {
    const payload: Record<string, unknown> = {
      success: false,
      message: err.message,
    };

    if (err.code) {
      payload.code = err.code;
    }
    if (err.details) {
      payload.details = err.details;
    }

    if (process.env.NODE_ENV !== 'production' && (err as Error).stack) {
      payload.stack = (err as Error).stack;
    }

    return res.status(err.statusCode).json(payload);
  }

  // Any other/unexpected error
  const message = err instanceof Error ? err.message : 'Internal server error';

  return res.status(500).json({
    success: false,
    message,
  });
}
