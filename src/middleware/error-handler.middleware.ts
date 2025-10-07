import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isAppError, ValidationError, NotFoundError } from '../utils/errors';
import errorCodeFactory from '../utils/error-code.factory';
import type { ILogger } from '../logging';

interface ErrorResponse {
  success: false;
  error: string;
  errors?: Record<string, string[]>;
  stack?: string;
}

/**
 * Get logger from request or return undefined
 */
function getLogger(req: Request): ILogger | undefined {
  return (req as any).log;
}

/**
 * Global error handler middleware
 * Catches all errors and sends appropriate response
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  let errorResponse: ErrorResponse = {
    success: false,
    error: 'Internal server error'
  };

  // Handle our custom AppError instances
  if (isAppError(err)) {
    statusCode = err.statusCode;
    errorResponse.error = err.message;

    // Add validation errors if present
    if (err instanceof ValidationError && err.errors) {
      errorResponse.errors = err.errors;
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = err.stack;
    }

    // Log using request logger if available
    const logger = getLogger(req);
    if (logger) {
      const logContext: Record<string, unknown> = {
        message: err.message,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      };

      if (err instanceof ValidationError && err.errors) {
        logContext.errors = err.errors;
      }

      if (process.env.NODE_ENV === 'development') {
        logContext.stack = err.stack;
      }

      // Log based on error type and status code
      if (!err.isOperational) {
        logContext.isOperational = false;
        logger.error(logContext, 'Non-operational error occurred');
      } else if (statusCode >= 500) {
        logger.error(logContext, 'Request error');
      } else {
        logger.warn(logContext, 'Request error');
      }
    }
  }
  // Handle Zod validation errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    const errors: Record<string, string[]> = {};

    err.issues.forEach((error: any) => {
      const path = error.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(error.message);
    });

    errorResponse = {
      success: false,
      error: 'Validation failed',
      errors
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = err.stack;
    }

    // Log validation errors
    const logger = getLogger(req);
    if (logger) {
      logger.warn(
        {
          statusCode,
          path: req.path,
          method: req.method,
          errors,
        },
        'Validation error'
      );
    }
  }
  // Handle standard Error instances
  else if (err instanceof Error) {
    // Use error code factory to determine status code
    statusCode = errorCodeFactory(err);
    errorResponse.error = err.message;

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = err.stack;
    }

    // Log all standard errors
    const logger = getLogger(req);
    if (logger) {
      logger.error(
        {
          message: err.message,
          stack: err.stack,
          path: req.path,
          method: req.method,
        },
        'Unhandled error'
      );
    }
  }
  // Handle unknown error types
  else {
    const logger = getLogger(req);
    if (logger) {
      logger.error(
        {
          error: err,
          path: req.path,
          method: req.method,
        },
        'Unknown error type'
      );
    }

    if (process.env.NODE_ENV === 'development') {
      errorResponse.error = String(err);
    }
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Not Found handler middleware
 * Creates 404 error for undefined routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const logger = getLogger(req);
  if (logger) {
    logger.warn(
      {
        url: req.originalUrl,
        method: req.method,
      },
      'Route not found'
    );
  }

  const error = new NotFoundError(
    `Route ${req.originalUrl}`
  );
  next(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch Promise rejections
 */
export const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: T, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error formatter
 * Formats validation errors for consistent API response
 */
export const formatValidationErrors = (errors: ZodError): Record<string, string[]> => {
  const formatted: Record<string, string[]> = {};

  (errors as any).errors.forEach((error: any) => {
    const path = error.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(error.message);
  });

  return formatted;
};
