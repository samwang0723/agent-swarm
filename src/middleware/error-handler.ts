import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';
import { ErrorCodes } from '../utils/error-code';
import logger from '../utils/logger';

/**
 * Centralized error handling middleware
 * This should be the last middleware in the chain
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // Log the error for debugging
  logger.error('Error caught by error handler:', {
    error: err.message,
    // stack: err.stack,
    data: req.body,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle ApiError instances
  if (err instanceof ApiError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Handle specific known error types
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation failed',
      code: ErrorCodes.VALIDATION_ERROR,
      details: err.message,
    });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({
      error: 'Invalid data format',
      code: ErrorCodes.VALIDATION_ERROR,
      details: 'Invalid ID format',
    });
    return;
  }

  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Invalid token',
      code: ErrorCodes.INVALID_TOKEN,
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Token expired',
      code: ErrorCodes.INVALID_TOKEN,
    });
    return;
  }

  // Handle rate limiting errors (if using express-rate-limit)
  if (err.message && err.message.includes('Too many requests')) {
    res.status(429).json({
      error: 'Too many requests',
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    });
    return;
  }

  // Default fallback for unhandled errors
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    error: 'Internal server error',
    code: ErrorCodes.INTERNAL_ERROR,
    ...(isDevelopment && {
      details: {
        message: err.message,
        stack: err.stack,
      },
    }),
  });
};

/**
 * Async error wrapper to catch async errors in route handlers
 * Usage: router.get('/route', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Route not found',
    code: ErrorCodes.NOT_FOUND,
    details: `Route ${req.method} ${req.originalUrl} not found`,
  });
};
