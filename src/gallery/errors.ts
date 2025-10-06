import { AppError } from '../utils/errors';

/**
 * Base class for all gallery-related errors
 */
export abstract class GalleryError extends AppError {
  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message, statusCode, isOperational);
    this.name = 'GalleryError';
  }
}

/**
 * Error thrown when thumbnail generation fails
 */
export class ThumbnailGenerationError extends GalleryError {
  public readonly mediaId: string;
  public readonly cause?: Error;

  constructor(mediaId: string, message: string, cause?: Error) {
    super(`Failed to generate thumbnail for media ${mediaId}: ${message}`, 500);
    this.name = 'ThumbnailGenerationError';
    this.mediaId = mediaId;
    this.cause = cause;
  }
}

/**
 * Error thrown when media type is not supported for thumbnail generation
 */
export class UnsupportedMediaTypeError extends GalleryError {
  public readonly mimeType: string;
  public readonly supportedTypes: string[];

  constructor(mimeType: string, supportedTypes: string[]) {
    super(
      `Unsupported media type '${mimeType}' for thumbnail generation. Supported types: ${supportedTypes.join(', ')}`,
      400
    );
    this.name = 'UnsupportedMediaTypeError';
    this.mimeType = mimeType;
    this.supportedTypes = supportedTypes;
  }
}

/**
 * Error thrown when fetching image from R2 fails
 */
export class ImageFetchError extends GalleryError {
  public readonly r2Url: string;
  public readonly cause?: Error;

  constructor(r2Url: string, message: string, cause?: Error) {
    super(`Failed to fetch image from ${r2Url}: ${message}`, 500);
    this.name = 'ImageFetchError';
    this.r2Url = r2Url;
    this.cause = cause;
  }
}

/**
 * Error thrown when uploading thumbnail to R2 fails
 */
export class ThumbnailUploadError extends GalleryError {
  public readonly filename: string;
  public readonly cause?: Error;

  constructor(filename: string, message: string, cause?: Error) {
    super(`Failed to upload thumbnail '${filename}': ${message}`, 500);
    this.name = 'ThumbnailUploadError';
    this.filename = filename;
    this.cause = cause;
  }
}

/**
 * Error thrown when saving thumbnail metadata fails
 */
export class ThumbnailMetadataSaveError extends GalleryError {
  public readonly filename: string;
  public readonly cause?: Error;

  constructor(filename: string, message: string, cause?: Error) {
    super(`Failed to save thumbnail metadata for '${filename}': ${message}`, 500);
    this.name = 'ThumbnailMetadataSaveError';
    this.filename = filename;
    this.cause = cause;
  }
}

/**
 * Error thrown when gallery already exists for a church
 */
export class GalleryAlreadyExistsError extends GalleryError {
  public readonly churchId: string;

  constructor(churchId: string) {
    super(`Gallery already exists for church ${churchId}`, 409);
    this.name = 'GalleryAlreadyExistsError';
    this.churchId = churchId;
  }
}

/**
 * Error thrown when gallery is not found
 */
export class GalleryNotFoundError extends GalleryError {
  public readonly galleryId: string;

  constructor(galleryId: string) {
    super(`Gallery ${galleryId} not found`, 404);
    this.name = 'GalleryNotFoundError';
    this.galleryId = galleryId;
  }
}

/**
 * Error thrown when media item already exists in gallery
 */
export class MediaAlreadyInGalleryError extends GalleryError {
  public readonly galleryId: string;
  public readonly mediaId: string;

  constructor(galleryId: string, mediaId: string) {
    super(`Media ${mediaId} already exists in gallery ${galleryId}`, 409);
    this.name = 'MediaAlreadyInGalleryError';
    this.galleryId = galleryId;
    this.mediaId = mediaId;
  }
}

/**
 * Type guard to check if error is a GalleryError
 */
export function isGalleryError(error: unknown): error is GalleryError {
  return error instanceof GalleryError;
}