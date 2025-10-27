import { describe, it, expect } from 'vitest';
import {
  PrayerWallNotFoundError,
  NotChurchMemberError,
  InactiveMembershipError,
  InsufficientChurchRoleError,
  BannedFromWallError,
  PrivateWallInvitationRequiredError,
  WallCreatorOnlyError,
  WallUpdateFailedError,
  WallMembershipRequiredError,
} from '../../prayer-walls/errors';

describe('Prayer Wall Errors', () => {
  // ============================================================================
  // InactiveMembershipError - Message Sanitization Tests
  // ============================================================================

  describe('InactiveMembershipError - Message Sanitization', () => {
    it('should not expose internal status PENDING in message', () => {
      const error = new InactiveMembershipError('PENDING');

      expect(error.message).not.toContain('PENDING');
      expect(error.message).toBe('Only active church members can perform this action');
    });

    it('should not expose internal status SUSPENDED in message', () => {
      const error = new InactiveMembershipError('SUSPENDED');

      expect(error.message).not.toContain('SUSPENDED');
      expect(error.message).toBe('Only active church members can perform this action');
    });

    it('should not expose internal status BANNED in message', () => {
      const error = new InactiveMembershipError('BANNED');

      expect(error.message).not.toContain('BANNED');
      expect(error.message).toBe('Only active church members can perform this action');
    });

    it('should not expose internal status INACTIVE in message', () => {
      const error = new InactiveMembershipError('INACTIVE');

      expect(error.message).not.toContain('INACTIVE');
      expect(error.message).toBe('Only active church members can perform this action');
    });

    it('should keep status property for logging', () => {
      const error = new InactiveMembershipError('PENDING');

      expect(error.status).toBe('PENDING');
    });

    it('should preserve status values for SUSPENDED', () => {
      const error = new InactiveMembershipError('SUSPENDED');

      expect(error.status).toBe('SUSPENDED');
    });

    it('should preserve status values for BANNED', () => {
      const error = new InactiveMembershipError('BANNED');

      expect(error.status).toBe('BANNED');
    });

    it('should have generic user-facing message', () => {
      const error = new InactiveMembershipError('ANY_STATUS');

      expect(error.message).toBe('Only active church members can perform this action');
      expect(error.message).not.toContain('ANY_STATUS');
    });

    it('should have consistent message regardless of status', () => {
      const error1 = new InactiveMembershipError('PENDING');
      const error2 = new InactiveMembershipError('BANNED');
      const error3 = new InactiveMembershipError('SUSPENDED');

      expect(error1.message).toBe(error2.message);
      expect(error2.message).toBe(error3.message);
    });

    it('should be instance of ForbiddenError', () => {
      const error = new InactiveMembershipError('PENDING');

      expect(error.name).toBe('InactiveMembershipError');
      expect(error.statusCode).toBe(403);
    });
  });

  // ============================================================================
  // Other Error Class Tests
  // ============================================================================

  describe('PrayerWallNotFoundError', () => {
    it('should include wallId in error properties', () => {
      const wallId = 'wall-123';
      const error = new PrayerWallNotFoundError(wallId);

      expect(error.wallId).toBe(wallId);
      expect(error.name).toBe('PrayerWallNotFoundError');
      expect(error.statusCode).toBe(404);
    });

    it('should have clear user-facing message', () => {
      const error = new PrayerWallNotFoundError('wall-123');

      expect(error.message).toContain('Prayer wall');
      expect(error.message).toContain('not found');
    });
  });

  describe('NotChurchMemberError', () => {
    it('should include userId and churchId in error properties', () => {
      const userId = 'user-123';
      const churchId = 'church-456';
      const error = new NotChurchMemberError(userId, churchId);

      expect(error.userId).toBe(userId);
      expect(error.churchId).toBe(churchId);
      expect(error.name).toBe('NotChurchMemberError');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('InsufficientChurchRoleError', () => {
    it('should include required roles and optional user role', () => {
      const requiredRoles = ['Owner', 'Manager'];
      const userRole = 'Member';
      const error = new InsufficientChurchRoleError(requiredRoles, userRole);

      expect(error.requiredRoles).toEqual(requiredRoles);
      expect(error.userRole).toBe(userRole);
      expect(error.name).toBe('InsufficientChurchRoleError');
      expect(error.statusCode).toBe(403);
    });

    it('should handle missing userRole', () => {
      const requiredRoles = ['Owner'];
      const error = new InsufficientChurchRoleError(requiredRoles);

      expect(error.requiredRoles).toEqual(requiredRoles);
      expect(error.userRole).toBeUndefined();
    });
  });

  describe('BannedFromWallError', () => {
    it('should include userId and wallId', () => {
      const userId = 'user-123';
      const wallId = 'wall-456';
      const error = new BannedFromWallError(userId, wallId);

      expect(error.userId).toBe(userId);
      expect(error.wallId).toBe(wallId);
      expect(error.name).toBe('BannedFromWallError');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('PrivateWallInvitationRequiredError', () => {
    it('should include wallId', () => {
      const wallId = 'wall-123';
      const error = new PrivateWallInvitationRequiredError(wallId);

      expect(error.wallId).toBe(wallId);
      expect(error.name).toBe('PrivateWallInvitationRequiredError');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('WallCreatorOnlyError', () => {
    it('should include action and wallId', () => {
      const action = 'edit wall details';
      const wallId = 'wall-123';
      const error = new WallCreatorOnlyError(action, wallId);

      expect(error.action).toBe(action);
      expect(error.wallId).toBe(wallId);
      expect(error.message).toContain(action);
      expect(error.name).toBe('WallCreatorOnlyError');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('WallUpdateFailedError', () => {
    it('should include wallId', () => {
      const wallId = 'wall-123';
      const error = new WallUpdateFailedError(wallId);

      expect(error.wallId).toBe(wallId);
      expect(error.name).toBe('WallUpdateFailedError');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('WallMembershipRequiredError', () => {
    it('should include action and wallId', () => {
      const action = 'view the member list';
      const wallId = 'wall-123';
      const error = new WallMembershipRequiredError(action, wallId);

      expect(error.action).toBe(action);
      expect(error.wallId).toBe(wallId);
      expect(error.message).toContain(action);
      expect(error.name).toBe('WallMembershipRequiredError');
      expect(error.statusCode).toBe(403);
    });
  });

  // ============================================================================
  // Error Hierarchy and Status Codes
  // ============================================================================

  describe('Error Status Codes', () => {
    it('should return 404 for NotFound errors', () => {
      const error = new PrayerWallNotFoundError('wall-123');
      expect(error.statusCode).toBe(404);
    });

    it('should return 403 for Forbidden errors', () => {
      const errors = [
        new NotChurchMemberError('user-123', 'church-456'),
        new InactiveMembershipError('PENDING'),
        new InsufficientChurchRoleError(['Owner']),
        new BannedFromWallError('user-123', 'wall-456'),
        new PrivateWallInvitationRequiredError('wall-123'),
        new WallCreatorOnlyError('edit', 'wall-123'),
        new WallMembershipRequiredError('view', 'wall-123'),
      ];

      errors.forEach((error) => {
        expect(error.statusCode).toBe(403);
      });
    });

    it('should return 400 for BadRequest errors', () => {
      const error = new WallUpdateFailedError('wall-123');
      expect(error.statusCode).toBe(400);
    });
  });
});