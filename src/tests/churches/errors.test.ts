import { describe, expect, it } from 'vitest';
import {
  ChurchNotFoundError,
  ChurchNotApprovedError,
  MemberBannedError,
  NotChurchMemberError,
  InactiveMembershipError,
  InsufficientChurchRoleError,
  OwnerInviteError,
  NoInvitationFoundError,
  NoPendingInvitationError,
  OwnerCannotLeaveError,
  TargetNotChurchMemberError,
  CannotRemoveOwnerError,
  CannotBanOwnerError,
  InvalidRoleError,
  CannotChangeOwnerRoleError,
  CannotPromoteToOwnerError,
  MemberAlreadyActiveError,
  MemberInvitedError,
  MembershipUpdateFailedError,
} from '../../churches/errors';

describe('Church Membership Errors', () => {
  const mockChurchId = '550e8400-e29b-41d4-a716-446655440001';
  const mockUserId = '550e8400-e29b-41d4-a716-446655440002';
  const mockTargetUserId = '550e8400-e29b-41d4-a716-446655440003';

  describe('404 Not Found Errors', () => {
    it('ChurchNotFoundError should have correct status code and properties', () => {
      const error = new ChurchNotFoundError(mockChurchId);

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Church not found');
      expect(error.churchId).toBe(mockChurchId);
    });

    it('NoInvitationFoundError should have correct status code and properties', () => {
      const error = new NoInvitationFoundError(mockChurchId, mockUserId);

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('No invitation found');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.userId).toBe(mockUserId);
    });

    it('NoPendingInvitationError should have correct status code and properties', () => {
      const error = new NoPendingInvitationError(mockChurchId, mockUserId);

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('No pending invitation found');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.userId).toBe(mockUserId);
    });

    it('TargetNotChurchMemberError should have correct status code and properties', () => {
      const error = new TargetNotChurchMemberError(mockChurchId, mockTargetUserId);

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Target user is not a member of this church');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.targetUserId).toBe(mockTargetUserId);
    });
  });

  describe('400 Bad Request Errors', () => {
    it('ChurchNotApprovedError should have correct status code and properties', () => {
      const error = new ChurchNotApprovedError(mockChurchId, 'Pending');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Cannot join church that is not approved');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.approvalStatus).toBe('Pending');
    });

    it('OwnerInviteError should have correct status code and properties', () => {
      const error = new OwnerInviteError(mockChurchId);

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Cannot invite user as Owner. Use ownership transfer instead');
      expect(error.churchId).toBe(mockChurchId);
    });

    it('OwnerCannotLeaveError should have correct status code and properties', () => {
      const error = new OwnerCannotLeaveError(mockChurchId, mockUserId);

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Owner cannot leave church without transferring ownership first');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.userId).toBe(mockUserId);
    });

    it('InvalidRoleError should have correct status code and properties', () => {
      const error = new InvalidRoleError('InvalidRole');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid role');
      expect(error.role).toBe('InvalidRole');
    });

    it('CannotPromoteToOwnerError should have correct status code and properties', () => {
      const error = new CannotPromoteToOwnerError(mockChurchId, mockTargetUserId);

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Cannot promote to owner role. Use ownership transfer instead');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.targetUserId).toBe(mockTargetUserId);
    });
  });

  describe('403 Forbidden Errors', () => {
    it('MemberBannedError should have correct status code and properties', () => {
      const error = new MemberBannedError(mockChurchId, mockUserId);

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('You are banned from this church');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.userId).toBe(mockUserId);
    });

    it('NotChurchMemberError should have correct status code and properties', () => {
      const error = new NotChurchMemberError(mockChurchId, mockUserId);

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('You are not a member of this church');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.userId).toBe(mockUserId);
    });

    it('InactiveMembershipError should have correct status code and properties', () => {
      const error = new InactiveMembershipError(mockChurchId, mockUserId);

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Only active church members can invite users');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.userId).toBe(mockUserId);
    });

    it('InsufficientChurchRoleError should have correct status code and properties', () => {
      const error = new InsufficientChurchRoleError(
        'remove members',
        'Owner or Manager',
        'Member',
        mockChurchId,
        mockUserId
      );

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Only owner or manager can remove members');
      expect(error.action).toBe('remove members');
      expect(error.requiredRole).toBe('Owner or Manager');
      expect(error.actualRole).toBe('Member');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.userId).toBe(mockUserId);
    });

    it('CannotRemoveOwnerError should have correct status code and properties', () => {
      const error = new CannotRemoveOwnerError(mockChurchId, mockTargetUserId);

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Cannot remove church owner');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.targetUserId).toBe(mockTargetUserId);
    });

    it('CannotBanOwnerError should have correct status code and properties', () => {
      const error = new CannotBanOwnerError(mockChurchId, mockTargetUserId);

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Cannot ban church owner');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.targetUserId).toBe(mockTargetUserId);
    });

    it('CannotChangeOwnerRoleError should have correct status code and properties', () => {
      const error = new CannotChangeOwnerRoleError(mockChurchId, mockTargetUserId);

      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Cannot change church owner role');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.targetUserId).toBe(mockTargetUserId);
    });
  });

  describe('409 Conflict Errors', () => {
    it('MemberAlreadyActiveError should have correct status code and properties', () => {
      const error = new MemberAlreadyActiveError(mockChurchId, mockUserId);

      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('User is already a member of this church');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.userId).toBe(mockUserId);
    });

    it('MemberInvitedError should have correct status code and properties', () => {
      const error = new MemberInvitedError(mockChurchId, mockUserId);

      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('User already has a pending invitation to this church');
      expect(error.churchId).toBe(mockChurchId);
      expect(error.userId).toBe(mockUserId);
    });
  });

  describe('500 Internal Server Errors', () => {
    it('MembershipUpdateFailedError should have correct status code and properties', () => {
      const membershipId = 'membership-123';
      const error = new MembershipUpdateFailedError(membershipId, 'update membership status');

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Failed to update membership status');
      expect(error.membershipId).toBe(membershipId);
      expect(error.operation).toBe('update membership status');
    });
  });
});
