import { AppError, NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';

/**
 * Base class for all series-related errors
 */
export abstract class SeriesError extends AppError {
  constructor(message: string, statusCode = 400, isOperational = true) {
    super(message, statusCode, isOperational);
    this.name = 'SeriesError';
  }
}

/**
 * Error thrown when series is not found
 */
export class SeriesNotFoundError extends NotFoundError {
  public readonly seriesId: string;

  constructor(seriesId: string) {
    super('Series', seriesId);
    this.name = 'SeriesNotFoundError';
    this.seriesId = seriesId;
  }
}

/**
 * Error thrown when user is not authorized to perform series action
 */
export class SeriesUnauthorizedError extends ForbiddenError {
  public readonly seriesId: string;
  public readonly action: string;

  constructor(action: string, seriesId: string) {
    super(`Unauthorized: You can only ${action} your own series`);
    this.name = 'SeriesUnauthorizedError';
    this.seriesId = seriesId;
    this.action = action;
  }
}

/**
 * Error thrown when trying to publish an already published series
 */
export class SeriesAlreadyPublishedError extends BadRequestError {
  public readonly seriesId: string;

  constructor(seriesId: string) {
    super('Series is already published');
    this.name = 'SeriesAlreadyPublishedError';
    this.seriesId = seriesId;
  }
}

/**
 * Error thrown when trying to unpublish a draft series
 */
export class SeriesAlreadyDraftError extends BadRequestError {
  public readonly seriesId: string;

  constructor(seriesId: string) {
    super('Series is already a draft');
    this.name = 'SeriesAlreadyDraftError';
    this.seriesId = seriesId;
  }
}

/**
 * Type guard to check if error is a SeriesError
 */
export function isSeriesError(error: unknown): error is SeriesError {
  return error instanceof SeriesError;
}