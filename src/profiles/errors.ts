import { AppError, NotFoundError, ForbiddenError } from '../utils/errors';

/**
 * Error thrown when a profile is not found
 */
export class ProfileNotFoundError extends NotFoundError {
  constructor(userId?: string) {
    super('Profile', userId);
    this.name = 'ProfileNotFoundError';
  }
}

/**
 * Error thrown when a user is not authorized to access or modify a profile
 */
export class ProfileUnauthorizedError extends ForbiddenError {
  constructor(message: string = 'Unauthorized to access or modify this profile') {
    super(message);
    this.name = 'ProfileUnauthorizedError';
  }
}

/**
 * Error thrown when profile creation fails
 */
export class ProfileCreationError extends AppError {
  constructor(message: string = 'Failed to create profile') {
    super(message, 500);
    this.name = 'ProfileCreationError';
  }
}

/**
 * Error thrown when profile update fails
 */
export class ProfileUpdateError extends AppError {
  constructor(message: string = 'Failed to update profile') {
    super(message, 500);
    this.name = 'ProfileUpdateError';
  }
}
