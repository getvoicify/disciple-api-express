import { AppError, ValidationError } from '../utils/errors';

/**
 * Base class for all R2 storage related errors
 */
export abstract class R2Error extends AppError {
  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message, statusCode, isOperational);
    this.name = 'R2Error';
  }
}

/**
 * Error thrown when R2 configuration is invalid or missing
 */
export class R2ConfigurationError extends R2Error {
  constructor(missingField: string) {
    super(`R2 configuration error: ${missingField} is required`, 500, false);
    this.name = 'R2ConfigurationError';
  }
}

/**
 * Error thrown when file upload to R2 fails
 */
export class R2UploadError extends R2Error {
  public readonly filename?: string;
  public readonly r2Key?: string;

  constructor(message: string, filename?: string, r2Key?: string) {
    super(`Failed to upload file to R2: ${message}`, 500);
    this.name = 'R2UploadError';
    this.filename = filename;
    this.r2Key = r2Key;
  }
}

/**
 * Error thrown when file deletion from R2 fails
 */
export class R2DeleteError extends R2Error {
  public readonly r2Key: string;

  constructor(r2Key: string, message: string) {
    super(`Failed to delete file from R2 (key: ${r2Key}): ${message}`, 500);
    this.name = 'R2DeleteError';
    this.r2Key = r2Key;
  }
}

/**
 * Error thrown when generating presigned URL fails
 */
export class R2PresignedUrlError extends R2Error {
  public readonly filename?: string;

  constructor(message: string, filename?: string) {
    super(`Failed to generate presigned URL: ${message}`, 500);
    this.name = 'R2PresignedUrlError';
    this.filename = filename;
  }
}

/**
 * Error thrown when R2 service is unavailable
 */
export class R2ServiceUnavailableError extends R2Error {
  constructor(message = 'R2 storage service is temporarily unavailable') {
    super(message, 503);
    this.name = 'R2ServiceUnavailableError';
  }
}

/**
 * Error thrown when R2 operation times out
 */
export class R2TimeoutError extends R2Error {
  public readonly operation: string;
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`R2 operation '${operation}' timed out after ${timeoutMs}ms`, 504);
    this.name = 'R2TimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when R2 credentials are invalid
 */
export class R2AuthenticationError extends R2Error {
  constructor(message = 'Invalid R2 credentials') {
    super(message, 401);
    this.name = 'R2AuthenticationError';
  }
}

/**
 * Error thrown when R2 access is denied
 */
export class R2AccessDeniedError extends R2Error {
  public readonly resource?: string;

  constructor(resource?: string) {
    const message = resource
      ? `Access denied to R2 resource: ${resource}`
      : 'Access denied to R2 resource';
    super(message, 403);
    this.name = 'R2AccessDeniedError';
    this.resource = resource;
  }
}

/**
 * Error thrown when file validation fails
 */
export class FileValidationError extends ValidationError {
  public readonly filename?: string;
  public readonly reason: string;

  constructor(reason: string, filename?: string) {
    const message = filename
      ? `File validation failed for '${filename}': ${reason}`
      : `File validation failed: ${reason}`;
    super(message);
    this.name = 'FileValidationError';
    this.filename = filename;
    this.reason = reason;
  }
}

/**
 * Error thrown when file size exceeds limit
 */
export class FileSizeExceededError extends FileValidationError {
  public readonly maxSize: number;
  public readonly actualSize: number;

  constructor(maxSize: number, actualSize: number, filename?: string) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    const actualSizeMB = (actualSize / (1024 * 1024)).toFixed(2);
    super(`File size ${actualSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB`, filename);
    this.name = 'FileSizeExceededError';
    this.maxSize = maxSize;
    this.actualSize = actualSize;
  }
}

/**
 * Error thrown when file type is not allowed
 */
export class UnsupportedFileTypeError extends FileValidationError {
  public readonly mimeType: string;
  public readonly allowedTypes?: string[];

  constructor(mimeType: string, allowedTypes?: string[], filename?: string) {
    const typesMessage = allowedTypes ? `. Allowed types: ${allowedTypes.join(', ')}` : '';
    super(`Unsupported file type '${mimeType}'${typesMessage}`, filename);
    this.name = 'UnsupportedFileTypeError';
    this.mimeType = mimeType;
    this.allowedTypes = allowedTypes;
  }
}

/**
 * Error thrown when filename is invalid
 */
export class InvalidFilenameError extends FileValidationError {
  constructor(filename: string, reason = 'contains invalid characters') {
    super(reason, filename);
    this.name = 'InvalidFilenameError';
  }
}

/**
 * Type guard to check if error is an R2Error
 */
export function isR2Error(error: unknown): error is R2Error {
  return error instanceof R2Error;
}

/**
 * Type guard to check if error is a file validation error
 */
export function isFileValidationError(error: unknown): error is FileValidationError {
  return error instanceof FileValidationError;
}

/**
 * Helper to extract error message from unknown error type
 */
export function extractR2ErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}