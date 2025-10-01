import { AppError, NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';

/**
 * Base class for all post-related errors
 */
export abstract class PostError extends AppError {
  constructor(message: string, statusCode = 400, isOperational = true) {
    super(message, statusCode, isOperational);
    this.name = 'PostError';
  }
}

/**
 * Error thrown when post is not found
 */
export class PostNotFoundError extends NotFoundError {
  public readonly postId: string;

  constructor(postId: string) {
    super('Post', postId);
    this.name = 'PostNotFoundError';
    this.postId = postId;
  }
}

/**
 * Error thrown when user is not authorized to perform post action
 */
export class PostUnauthorizedError extends ForbiddenError {
  public readonly postId: string;
  public readonly action: string;

  constructor(action: string, postId: string) {
    super(`Unauthorized: You can only ${action} your own posts`);
    this.name = 'PostUnauthorizedError';
    this.postId = postId;
    this.action = action;
  }
}

/**
 * Error thrown when user doesn't have required church role
 */
export class InsufficientChurchRoleError extends ForbiddenError {
  public readonly requiredRoles: string[];
  public readonly userRole?: string;

  constructor(requiredRoles: string[], userRole?: string) {
    const rolesStr = requiredRoles.join(' or ');
    const message = userRole
      ? `Insufficient permissions. Required role: ${rolesStr}. Your role: ${userRole}`
      : `Insufficient permissions. Required role: ${rolesStr}`;
    super(message);
    this.name = 'InsufficientChurchRoleError';
    this.requiredRoles = requiredRoles;
    this.userRole = userRole;
  }
}

/**
 * Error thrown when user is not a church member
 */
export class NotChurchMemberError extends ForbiddenError {
  public readonly churchId: string;
  public readonly userId: string;

  constructor(userId: string, churchId: string) {
    super('User is not a member of this church');
    this.name = 'NotChurchMemberError';
    this.churchId = churchId;
    this.userId = userId;
  }
}

/**
 * Error thrown when church membership is not active
 */
export class InactiveMembershipError extends ForbiddenError {
  public readonly status: string;

  constructor(status: string) {
    super(`User membership is not active. Current status: ${status}`);
    this.name = 'InactiveMembershipError';
    this.status = status;
  }
}

/**
 * Error thrown when trying to publish an already published post
 */
export class PostAlreadyPublishedError extends BadRequestError {
  public readonly postId: string;

  constructor(postId: string) {
    super('Post is already published');
    this.name = 'PostAlreadyPublishedError';
    this.postId = postId;
  }
}

/**
 * Error thrown when trying to unpublish a draft post
 */
export class PostAlreadyDraftError extends BadRequestError {
  public readonly postId: string;

  constructor(postId: string) {
    super('Post is already a draft');
    this.name = 'PostAlreadyDraftError';
    this.postId = postId;
  }
}

/**
 * Error thrown when post status transition is invalid
 */
export class InvalidPostStatusTransitionError extends BadRequestError {
  public readonly currentStatus: string;
  public readonly targetStatus: string;

  constructor(currentStatus: string, targetStatus: string) {
    super(`Invalid status transition from '${currentStatus}' to '${targetStatus}'`);
    this.name = 'InvalidPostStatusTransitionError';
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
  }
}

/**
 * Type guard to check if error is a PostError
 */
export function isPostError(error: unknown): error is PostError {
  return error instanceof PostError;
}