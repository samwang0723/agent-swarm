import { ErrorCodes, ErrorMessages } from '@/shared/utils/error-code';

/**
 * Custom API Error class for consistent error handling
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCodes;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    errorCode: ErrorCodes,
    message?: string,
    details?: any,
    isOperational = true
  ) {
    // Use predefined message if not provided
    const errorMessage = message || ErrorMessages[errorCode];
    super(errorMessage);

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Convert error to JSON format for API responses
   */
  toJSON() {
    return {
      error: this.message,
      code: this.errorCode,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Factory functions for common error types
 */
export class AuthError extends ApiError {
  constructor(errorCode: ErrorCodes, message?: string, details?: any) {
    super(401, errorCode, message, details);
  }
}

export class ValidationError extends ApiError {
  constructor(message?: string, details?: any) {
    super(400, ErrorCodes.VALIDATION_ERROR, message, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(message?: string, details?: any) {
    super(404, ErrorCodes.NOT_FOUND, message, details);
  }
}

export class InternalError extends ApiError {
  constructor(message?: string, details?: any) {
    super(500, ErrorCodes.INTERNAL_ERROR, message, details);
  }
}

/**
 * Helper function to create authentication errors
 */
export const createAuthError = (
  errorCode: ErrorCodes,
  message?: string,
  details?: any
): AuthError => {
  return new AuthError(errorCode, message, details);
};

/**
 * Helper function to create server errors
 */
export const createServerError = (
  errorCode: ErrorCodes,
  message?: string,
  details?: any
): ApiError => {
  return new ApiError(500, errorCode, message, details);
};
