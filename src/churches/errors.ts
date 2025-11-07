import { AppError } from '../utils/errors';

/**
 * Church-specific error classes for ChurchMembershipService
 */

// 404 Not Found Errors
export class ChurchNotFoundError extends AppError {
  public readonly churchId?: string;

  constructor(churchId?: string) {
    super('Church not found', 404);
    this.name = 'ChurchNotFoundError';
    this.churchId = churchId;
  }
}

export class NoInvitationFoundError extends AppError {
  public readonly churchId: string;
  public readonly userId: string;

  constructor(churchId: string, userId: string) {
    super('No invitation found', 404);
    this.name = 'NoInvitationFoundError';
    this.churchId = churchId;
    this.userId = userId;
  }
}

export class NoPendingInvitationError extends AppError {
  public readonly churchId: string;
  public readonly userId: string;

  constructor(churchId: string, userId: string) {
    super('No pending invitation found', 404);
    this.name = 'NoPendingInvitationError';
    this.churchId = churchId;
    this.userId = userId;
  }
}

export class TargetNotChurchMemberError extends AppError {
  public readonly churchId: string;
  public readonly targetUserId: string;

  constructor(churchId: string, targetUserId: string) {
    super('Target user is not a member of this church', 404);
    this.name = 'TargetNotChurchMemberError';
    this.churchId = churchId;
    this.targetUserId = targetUserId;
  }
}

// 400 Bad Request Errors
export class ChurchNotApprovedError extends AppError {
  public readonly churchId: string;
  public readonly approvalStatus: string;

  constructor(churchId: string, approvalStatus: string) {
    super('Cannot join church that is not approved', 400);
    this.name = 'ChurchNotApprovedError';
    this.churchId = churchId;
    this.approvalStatus = approvalStatus;
  }
}

export class OwnerInviteError extends AppError {
  public readonly churchId: string;

  constructor(churchId: string) {
    super('Cannot invite user as Owner. Use ownership transfer instead', 400);
    this.name = 'OwnerInviteError';
    this.churchId = churchId;
  }
}

export class OwnerCannotLeaveError extends AppError {
  public readonly churchId: string;
  public readonly userId: string;

  constructor(churchId: string, userId: string) {
    super('Owner cannot leave church without transferring ownership first', 400);
    this.name = 'OwnerCannotLeaveError';
    this.churchId = churchId;
    this.userId = userId;
  }
}

export class InvalidRoleError extends AppError {
  public readonly role: string;

  constructor(role: string) {
    super('Invalid role', 400);
    this.name = 'InvalidRoleError';
    this.role = role;
  }
}

export class CannotPromoteToOwnerError extends AppError {
  public readonly churchId: string;
  public readonly targetUserId: string;

  constructor(churchId: string, targetUserId: string) {
    super('Cannot promote to owner role. Use ownership transfer instead', 400);
    this.name = 'CannotPromoteToOwnerError';
    this.churchId = churchId;
    this.targetUserId = targetUserId;
  }
}

// 403 Forbidden Errors
export class MemberBannedError extends AppError {
  public readonly churchId: string;
  public readonly userId: string;

  constructor(churchId: string, userId: string) {
    super('You are banned from this church', 403);
    this.name = 'MemberBannedError';
    this.churchId = churchId;
    this.userId = userId;
  }
}

export class NotChurchMemberError extends AppError {
  public readonly churchId: string;
  public readonly userId: string;

  constructor(churchId: string, userId: string) {
    super('You are not a member of this church', 403);
    this.name = 'NotChurchMemberError';
    this.churchId = churchId;
    this.userId = userId;
  }
}

export class InactiveMembershipError extends AppError {
  public readonly churchId: string;
  public readonly userId: string;

  constructor(churchId: string, userId: string) {
    super('Only active church members can invite users', 403);
    this.name = 'InactiveMembershipError';
    this.churchId = churchId;
    this.userId = userId;
  }
}

export class InsufficientChurchRoleError extends AppError {
  public readonly action: string;
  public readonly requiredRole: string;
  public readonly actualRole: string;
  public readonly churchId: string;
  public readonly userId: string;

  constructor(action: string, requiredRole: string, actualRole: string, churchId: string, userId: string) {
    // If the role contains "or", don't add 's' to pluralize (e.g., "Owner or Manager" -> "owner or manager")
    // Otherwise add 's' for single roles (e.g., "Owner" -> "owners")
    const roleLower = requiredRole.toLowerCase();
    const roleText = roleLower.includes(' or ') ? roleLower : `${roleLower}s`;
    super(`Only ${roleText} can ${action}`, 403);
    this.name = 'InsufficientChurchRoleError';
    this.action = action;
    this.requiredRole = requiredRole;
    this.actualRole = actualRole;
    this.churchId = churchId;
    this.userId = userId;
  }
}

export class CannotRemoveOwnerError extends AppError {
  public readonly churchId: string;
  public readonly targetUserId: string;

  constructor(churchId: string, targetUserId: string) {
    super('Cannot remove church owner', 403);
    this.name = 'CannotRemoveOwnerError';
    this.churchId = churchId;
    this.targetUserId = targetUserId;
  }
}

export class CannotBanOwnerError extends AppError {
  public readonly churchId: string;
  public readonly targetUserId: string;

  constructor(churchId: string, targetUserId: string) {
    super('Cannot ban church owner', 403);
    this.name = 'CannotBanOwnerError';
    this.churchId = churchId;
    this.targetUserId = targetUserId;
  }
}

export class CannotChangeOwnerRoleError extends AppError {
  public readonly churchId: string;
  public readonly targetUserId: string;

  constructor(churchId: string, targetUserId: string) {
    super('Cannot change church owner role', 403);
    this.name = 'CannotChangeOwnerRoleError';
    this.churchId = churchId;
    this.targetUserId = targetUserId;
  }
}

// 409 Conflict Errors
export class MemberAlreadyActiveError extends AppError {
  public readonly churchId: string;
  public readonly userId: string;

  constructor(churchId: string, userId: string) {
    super('User is already a member of this church', 409);
    this.name = 'MemberAlreadyActiveError';
    this.churchId = churchId;
    this.userId = userId;
  }
}

export class MemberInvitedError extends AppError {
  public readonly churchId: string;
  public readonly userId: string;

  constructor(churchId: string, userId: string) {
    super('User already has a pending invitation to this church', 409);
    this.name = 'MemberInvitedError';
    this.churchId = churchId;
    this.userId = userId;
  }
}

// 500 Internal Server Errors
export class MembershipUpdateFailedError extends AppError {
  public readonly membershipId: string;
  public readonly operation: string;

  constructor(membershipId: string, operation: string) {
    super(`Failed to ${operation}`, 500);
    this.name = 'MembershipUpdateFailedError';
    this.membershipId = membershipId;
    this.operation = operation;
  }
}
