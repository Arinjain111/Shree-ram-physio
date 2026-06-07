import { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodIssue } from 'zod';
import type { ApiErrorOptions } from '../types';
import { logger } from '../utils/logger';

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

function mapZodIssues(issues: ZodIssue[]) {
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
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const ctx = 'http';

  // Zod validation errors
  if (err instanceof ZodError) {
    logger.warn(ctx, 'Validation failed', {
      path: req.path,
      issueCount: err.issues.length,
      issues: mapZodIssues(err.issues),
    });
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: mapZodIssues(err.issues),
    });
  }

  // Intentionally thrown API errors
  if (err instanceof ApiError) {
    const level = err.statusCode >= 500 ? 'error' : 'warn';
    logger[level](ctx, err.message, {
      path: req.path,
      statusCode: err.statusCode,
      code: err.code,
    });
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

    if (process.env['NODE_ENV'] === 'development' && (err as Error).stack) {
      payload.stack = (err as Error).stack;
    }

    return res.status(err.statusCode).json(payload);
  }

  // Any other/unexpected error
  const message = err instanceof Error ? err.message : 'Internal server error';
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(ctx, message, {
    path: req.path,
    stack,
  });

  return res.status(500).json({
    success: false,
    message,
  });
}
