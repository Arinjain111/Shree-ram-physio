import { Request, Response, NextFunction } from 'express';
import { ApiError } from './errorHandler';

const API_KEY = process.env.API_KEY;

export function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  if (!API_KEY) {
    return next();
  }

  const providedKey = req.headers['x-api-key'] as string;

  if (!providedKey || providedKey !== API_KEY) {
    throw new ApiError(401, 'Unauthorized: Invalid or missing API key', { code: 'INVALID_API_KEY' });
  }

  next();
}
