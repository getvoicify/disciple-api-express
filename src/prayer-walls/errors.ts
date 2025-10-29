import { AppError } from '../utils/errors';

/**
 * Base class for all prayer wall-related errors
 */
export abstract class PrayerWallError extends AppError {
  constructor(message: string, statusCode = 400, isOperational = true) {
    super(message, statusCode, isOperational);
    this.name = 'PrayerWallError';
  }
}

/**
 * Error thrown when prayer wall is not found
 */
export class PrayerWallNotFoundError extends PrayerWallError {
  public readonly wallId: string;

  constructor(wallId: string) {
    super(`Prayer wall with ID '${wallId}' not found`, 404);
    this.name = 'PrayerWallNotFoundError';
    this.wallId = wallId;
  }
}

/**
 * Error thrown when user is not a member of the church
 */
export class NotChurchMemberError extends PrayerWallError {
  public readonly churchId: string;
  public readonly userId: string;

  constructor(userId: string, churchId: string) {
    super('You are not a member of this church', 403);
    this.name = 'NotChurchMemberError';
    this.churchId = churchId;
    this.userId = userId;
  }
}

/**
 * Error thrown when church membership is not active
 */
export class InactiveMembershipError extends PrayerWallError {
  public readonly status: string;

  constructor(status: string) {
    // Sanitize message - don't expose internal status to users
    super('Only active church members can perform this action', 403);
    this.name = 'InactiveMembershipError';
    this.status = status;
  }
}

/**
 * Error thrown when user doesn't have required church role
 */
export class InsufficientChurchRoleError extends PrayerWallError {
  public readonly requiredRoles: string[];
  public readonly userRole?: string;

  constructor(requiredRoles: string[], userRole?: string) {
    const rolesStr = requiredRoles.join(' or ');
    const message = userRole
      ? `Insufficient permissions. Required role: ${rolesStr}. Your role: ${userRole}`
      : `Insufficient permissions. Required role: ${rolesStr}`;
    super(message, 403);
    this.name = 'InsufficientChurchRoleError';
    this.requiredRoles = requiredRoles;
    this.userRole = userRole;
  }
}

/**
 * Error thrown when user is banned from a prayer wall
 */
export class BannedFromWallError extends PrayerWallError {
  public readonly wallId: string;
  public readonly userId: string;

  constructor(userId: string, wallId: string) {
    super('You are banned from this prayer wall', 403);
    this.name = 'BannedFromWallError';
    this.wallId = wallId;
    this.userId = userId;
  }
}

/**
 * Error thrown when only prayer wall members can perform an action
 */
export class WallMembershipRequiredError extends PrayerWallError {
  public readonly wallId: string;
  public readonly action: string;

  constructor(action: string, wallId: string) {
    super(`Only prayer wall members can ${action}`, 403);
    this.name = 'WallMembershipRequiredError';
    this.wallId = wallId;
    this.action = action;
  }
}

/**
 * Error thrown when trying to join a private wall without invitation
 */
export class PrivateWallInvitationRequiredError extends PrayerWallError {
  public readonly wallId: string;

  constructor(wallId: string) {
    super('Cannot join private wall without invitation', 403);
    this.name = 'PrivateWallInvitationRequiredError';
    this.wallId = wallId;
  }
}

/**
 * Error thrown when only the wall creator can perform an action
 */
export class WallCreatorOnlyError extends PrayerWallError {
  public readonly wallId: string;
  public readonly action: string;

  constructor(action: string, wallId: string) {
    super(`Only the wall creator can ${action}`, 403);
    this.name = 'WallCreatorOnlyError';
    this.wallId = wallId;
    this.action = action;
  }
}

/**
 * Error thrown when wall update fails
 */
export class WallUpdateFailedError extends PrayerWallError {
  public readonly wallId: string;

  constructor(wallId: string) {
    super('Failed to update prayer wall', 400);
    this.name = 'WallUpdateFailedError';
    this.wallId = wallId;
  }
}

/**
 * Error thrown when church ID in request body doesn't match the authorized church ID
 */
export class ChurchIdMismatchError extends PrayerWallError {
  public readonly expectedChurchId: string;
  public readonly providedChurchId: string;

  constructor(expectedChurchId: string, providedChurchId: string) {
    super(
      `Church ID mismatch: expected ${expectedChurchId}, got ${providedChurchId}`,
      400
    );
    this.name = 'ChurchIdMismatchError';
    this.expectedChurchId = expectedChurchId;
    this.providedChurchId = providedChurchId;
  }
}

/**
 * Error thrown when prayer request is not found
 */
export class PrayerRequestNotFoundError extends PrayerWallError {
  public readonly prayerId: string;

  constructor(prayerId: string) {
    super(`Prayer request with ID '${prayerId}' not found`, 404);
    this.name = 'PrayerRequestNotFoundError';
    this.prayerId = prayerId;
  }
}

/**
 * Error thrown when user is not authorized to perform an operation
 */
export class UnauthorizedOperationError extends PrayerWallError {
  public readonly action: string;

  constructor(action: string) {
    super(`You are not authorized to ${action}`, 403);
    this.name = 'UnauthorizedOperationError';
    this.action = action;
  }
}

/**
 * Error thrown when edit window has expired
 */
export class EditWindowExpiredError extends PrayerWallError {
  public readonly prayerId: string;
  public readonly windowMinutes: number;

  constructor(prayerId: string, windowMinutes: number) {
    super(`Edit window has expired (${windowMinutes} minutes)`, 403);
    this.name = 'EditWindowExpiredError';
    this.prayerId = prayerId;
    this.windowMinutes = windowMinutes;
  }
}

/**
 * Error thrown when prayer update fails
 */
export class PrayerUpdateFailedError extends PrayerWallError {
  public readonly prayerId: string;

  constructor(prayerId: string) {
    super('Failed to update prayer request', 400);
    this.name = 'PrayerUpdateFailedError';
    this.prayerId = prayerId;
  }
}

/**
 * Error thrown when thread depth exceeds maximum
 */
export class ThreadDepthExceededError extends PrayerWallError {
  public readonly parentId: string;
  public readonly currentDepth: number;

  constructor(parentId: string, currentDepth: number) {
    super(`Maximum thread depth of 3 exceeded (parent at depth ${currentDepth})`, 400);
    this.name = 'ThreadDepthExceededError';
    this.parentId = parentId;
    this.currentDepth = currentDepth;
  }
}

/**
 * Error thrown when prayer content is invalid
 */
export class InvalidContentError extends PrayerWallError {
  public readonly reason: string;

  constructor(reason: string) {
    super(reason, 400);
    this.name = 'InvalidContentError';
    this.reason = reason;
  }
}

/**
 * Error thrown when trying to reply to a deleted prayer
 */
export class CannotReplyToDeletedPrayerError extends PrayerWallError {
  public readonly prayerId: string;

  constructor(prayerId: string) {
    super('Cannot reply to a deleted prayer request', 400);
    this.name = 'CannotReplyToDeletedPrayerError';
    this.prayerId = prayerId;
  }
}

/**
 * Error thrown when flagged content record is not found
 */
export class FlaggedContentNotFoundError extends PrayerWallError {
  public readonly flagId: string;

  constructor(flagId: string) {
    super(`Flagged content with ID '${flagId}' not found`, 404);
    this.name = 'FlaggedContentNotFoundError';
    this.flagId = flagId;
  }
}

/**
 * Error thrown when hiding a prayer request fails
 */
export class PrayerHideFailedError extends PrayerWallError {
  public readonly prayerId: string;

  constructor(prayerId: string, _reason?: string) {
    // Sanitize message - don't expose internal error details to users
    super(`Failed to hide prayer request '${prayerId}'`, 500);
    this.name = 'PrayerHideFailedError';
    this.prayerId = prayerId;
  }
}

/**
 * Error thrown when deleting a prayer request fails
 */
export class PrayerDeleteFailedError extends PrayerWallError {
  public readonly prayerId: string;

  constructor(prayerId: string, _reason?: string) {
    // Sanitize message - don't expose internal error details to users
    super(`Failed to delete prayer request '${prayerId}'`, 500);
    this.name = 'PrayerDeleteFailedError';
    this.prayerId = prayerId;
  }
}

/**
 * Error thrown when restoring a prayer request fails
 */
export class PrayerRestoreFailedError extends PrayerWallError {
  public readonly prayerId: string;

  constructor(prayerId: string, _reason?: string) {
    // Sanitize message - don't expose internal error details to users
    super(`Failed to restore prayer request '${prayerId}'`, 500);
    this.name = 'PrayerRestoreFailedError';
    this.prayerId = prayerId;
  }
}

/**
 * Error thrown when church-wide bans are requested but not supported
 */
export class ChurchWideBansNotSupportedError extends PrayerWallError {
  constructor() {
    super('Church-wide bans are not yet supported. Please ban users individually per wall.', 501);
    this.name = 'ChurchWideBansNotSupportedError';
  }
}

/**
 * Type guard to check if error is a PrayerWallError
 */
export function isPrayerWallError(error: unknown): error is PrayerWallError {
  return error instanceof PrayerWallError;
}