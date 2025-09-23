/**
 * Base class for all application errors
 */
export abstract class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends AppError {
  public readonly errors?: Record<string, string[]>;

  constructor(message: string, errors?: Record<string, string[]>) {
    super(message, 400);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when user is not authenticated
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Error thrown when user doesn't have permission to perform an action
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Error thrown when there's a version conflict (optimistic locking)
 */
export class ConflictError extends AppError {
  constructor(message = 'Version conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Error thrown for bad requests
 */
export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

/**
 * Error thrown for internal server errors
 */
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, false);
    this.name = 'InternalServerError';
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
    this.name = 'TooManyRequestsError';
  }
}

/**
 * Error thrown for business logic violations
 */
export class BusinessLogicError extends AppError {
  constructor(message: string, statusCode = 400) {
    super(message, statusCode);
    this.name = 'BusinessLogicError';
  }
}

/**
 * Error thrown when an entity already exists
 */
export class DuplicateError extends AppError {
  constructor(resource: string, field?: string) {
    const message = field
      ? `${resource} with this ${field} already exists`
      : `${resource} already exists`;
    super(message, 409);
    this.name = 'DuplicateError';
  }
}

export class KeycloakAuthError extends AppError {
	constructor(message: string, statusCode: number) {
		super(message, statusCode);
		this.name = 'KeycloakAuthError';
	}
}

/**
 * Error thrown when required data is missing
 */
export class MissingRequiredFieldError extends ValidationError {
  constructor(field: string) {
    super(`${field} is required`);
    this.name = 'MissingRequiredFieldError';
  }
}

/**
 * Error thrown when data format is invalid
 */
export class InvalidFormatError extends ValidationError {
  constructor(field: string, expectedFormat: string) {
    super(`Invalid ${field} format. Expected: ${expectedFormat}`);
    this.name = 'InvalidFormatError';
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error has a status code
 */
export function hasStatusCode(error: unknown): error is { statusCode: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as any).statusCode === 'number'
  );
}
