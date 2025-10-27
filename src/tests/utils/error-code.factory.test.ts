import { describe, it, expect } from 'vitest';
import errorCodeFactory from '../../utils/error-code.factory';
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from '../../utils/errors';
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

describe('errorCodeFactory', () => {
  // ============================================================================
  // Base Error Classes - Status Code Mapping
  // ============================================================================

  describe('Base Error Classes', () => {
    it('should return 404 for NotFoundError', () => {
      const error = new NotFoundError('Resource not found');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(404);
    });

    it('should return 401 for UnauthorizedError', () => {
      const error = new UnauthorizedError('User not authenticated');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(401);
    });

    it('should return 403 for ForbiddenError', () => {
      const error = new ForbiddenError('Access denied');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(403);
    });

    it('should return 400 for BadRequestError', () => {
      const error = new BadRequestError('Invalid request');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(400);
    });

    it('should return 409 for ConflictError', () => {
      const error = new ConflictError('Resource already exists');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(409);
    });

    it('should return custom status code from AppError', () => {
      const error = new AppError('Custom error', 418);
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(418);
    });
  });

  // ============================================================================
  // Prayer Wall Custom Errors - Status Code Mapping
  // ============================================================================

  describe('Prayer Wall Custom Errors', () => {
    it('should return 404 for PrayerWallNotFoundError', () => {
      const error = new PrayerWallNotFoundError('wall-123');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(404);
    });

    it('should return 403 for NotChurchMemberError', () => {
      const error = new NotChurchMemberError('user-123', 'church-456');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(403);
    });

    it('should return 403 for InactiveMembershipError', () => {
      const error = new InactiveMembershipError('PENDING');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(403);
    });

    it('should return 403 for InsufficientChurchRoleError', () => {
      const error = new InsufficientChurchRoleError(['Owner'], 'Member');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(403);
    });

    it('should return 403 for BannedFromWallError', () => {
      const error = new BannedFromWallError('user-123', 'wall-456');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(403);
    });

    it('should return 403 for PrivateWallInvitationRequiredError', () => {
      const error = new PrivateWallInvitationRequiredError('wall-123');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(403);
    });

    it('should return 403 for WallCreatorOnlyError', () => {
      const error = new WallCreatorOnlyError('delete', 'wall-123');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(403);
    });

    it('should return 400 for WallUpdateFailedError', () => {
      const error = new WallUpdateFailedError('wall-123');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(400);
    });

    it('should return 403 for WallMembershipRequiredError', () => {
      const error = new WallMembershipRequiredError('view', 'wall-123');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(403);
    });
  });

  // ============================================================================
  // Objects with statusCode Property
  // ============================================================================

  describe('Objects with statusCode Property', () => {
    it('should return statusCode from plain object', () => {
      const error = {
        message: 'Some error',
        statusCode: 422,
      };

      const statusCode = errorCodeFactory(error);
      expect(statusCode).toBe(422);
    });

    it('should return statusCode from Error-like object', () => {
      const error = {
        name: 'CustomError',
        message: 'Something went wrong',
        statusCode: 503,
      };

      const statusCode = errorCodeFactory(error);
      expect(statusCode).toBe(503);
    });

    it('should prefer statusCode over message patterns', () => {
      const error = {
        message: 'Resource not found', // Would normally map to 404
        statusCode: 500, // But explicit statusCode should win
      };

      const statusCode = errorCodeFactory(error);
      expect(statusCode).toBe(500);
    });
  });

  // ============================================================================
  // Message Pattern Matching (Backward Compatibility)
  // ============================================================================

  describe('Message Pattern Matching', () => {
    describe('404 Not Found Patterns', () => {
      it('should return 404 for "not found" message (lowercase)', () => {
        const error = new Error('resource not found');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(404);
      });

      it('should return 404 for "not found" message (uppercase)', () => {
        const error = new Error('Resource NOT FOUND');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(404);
      });

      it('should return 404 for "not found" message (mixed case)', () => {
        const error = new Error('Prayer Wall Not Found');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(404);
      });

      it('should return 404 when "not found" appears in middle of message', () => {
        const error = new Error('The requested prayer wall was not found in the database');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(404);
      });
    });

    describe('401 Unauthorized Patterns', () => {
      it('should return 401 for "unauthorized" message', () => {
        const error = new Error('unauthorized');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(401);
      });

      it('should return 401 for "UNAUTHORIZED" message', () => {
        const error = new Error('UNAUTHORIZED');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(401);
      });

      it('should return 401 when "unauthorized" appears in message', () => {
        const error = new Error('User is unauthorized to access this resource');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(401);
      });
    });

    describe('403 Forbidden Patterns', () => {
      it('should return 403 for "forbidden" message', () => {
        const error = new Error('forbidden');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(403);
      });

      it('should return 403 for "FORBIDDEN" message', () => {
        const error = new Error('FORBIDDEN');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(403);
      });

      it('should return 403 when "forbidden" appears in message', () => {
        const error = new Error('Access forbidden: insufficient permissions');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(403);
      });
    });

    describe('409 Conflict Patterns', () => {
      it('should return 409 for "version conflict" message', () => {
        const error = new Error('version conflict detected');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(409);
      });

      it('should return 409 for "version mismatch" message', () => {
        const error = new Error('version mismatch');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(409);
      });

      it('should return 409 for "already exists" message', () => {
        const error = new Error('Resource already exists');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(409);
      });

      it('should return 409 for "ALREADY EXISTS" message', () => {
        const error = new Error('Prayer wall ALREADY EXISTS');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(409);
      });
    });

    describe('400 Bad Request Patterns', () => {
      it('should return 400 for "validation" message', () => {
        const error = new Error('validation error');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(400);
      });

      it('should return 400 for "invalid" message', () => {
        const error = new Error('invalid input');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(400);
      });

      it('should return 400 for "VALIDATION" message', () => {
        const error = new Error('VALIDATION FAILED');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(400);
      });

      it('should return 400 for "INVALID" message', () => {
        const error = new Error('INVALID REQUEST');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(400);
      });

      it('should return 400 when "validation" appears in message', () => {
        const error = new Error('Form validation failed: name is required');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(400);
      });

      it('should return 400 when "invalid" appears in message', () => {
        const error = new Error('The provided email is invalid');
        const statusCode = errorCodeFactory(error);

        expect(statusCode).toBe(400);
      });
    });
  });

  // ============================================================================
  // Default Behavior for Unknown Errors
  // ============================================================================

  describe('Default Behavior', () => {
    it('should return 400 for generic Error without pattern', () => {
      const error = new Error('Something went wrong');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(400);
    });

    it('should return 400 for Error with empty message', () => {
      const error = new Error('');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(400);
    });

    it('should return 400 for null', () => {
      const statusCode = errorCodeFactory(null);
      expect(statusCode).toBe(400);
    });

    it('should return 400 for undefined', () => {
      const statusCode = errorCodeFactory(undefined);
      expect(statusCode).toBe(400);
    });

    it('should return 400 for plain string', () => {
      const statusCode = errorCodeFactory('An error occurred');
      expect(statusCode).toBe(400);
    });

    it('should return 400 for plain number', () => {
      const statusCode = errorCodeFactory(42);
      expect(statusCode).toBe(400);
    });

    it('should return 400 for plain object without statusCode', () => {
      const statusCode = errorCodeFactory({ message: 'Some error' });
      expect(statusCode).toBe(400);
    });

    it('should return 400 for array', () => {
      const statusCode = errorCodeFactory(['error1', 'error2']);
      expect(statusCode).toBe(400);
    });
  });

  // ============================================================================
  // Priority/Precedence Tests
  // ============================================================================

  describe('Priority/Precedence', () => {
    it('should prioritize AppError statusCode over message patterns', () => {
      // Create an AppError with status 500 but message containing "not found"
      const error = new AppError('Resource not found', 500);
      const statusCode = errorCodeFactory(error);

      // Should return 500 (from statusCode), not 404 (from message pattern)
      expect(statusCode).toBe(500);
    });

    it('should prioritize explicit statusCode property over message patterns', () => {
      const error = {
        message: 'Validation failed', // Would normally map to 400
        statusCode: 422, // But explicit statusCode should win
      };

      const statusCode = errorCodeFactory(error);
      expect(statusCode).toBe(422);
    });

    it('should use message pattern when no statusCode is available', () => {
      const error = new Error('Resource not found');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(404);
    });

    it('should fallback to 400 when no statusCode or message pattern matches', () => {
      const error = new Error('Unexpected error occurred');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(400);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle TypeError', () => {
      const error = new TypeError('Cannot read property of undefined');
      const statusCode = errorCodeFactory(error);

      // Should return 400 since no pattern matches
      expect(statusCode).toBe(400);
    });

    it('should handle RangeError', () => {
      const error = new RangeError('Index out of range');
      const statusCode = errorCodeFactory(error);

      // Should return 400 since no pattern matches
      expect(statusCode).toBe(400);
    });

    it('should handle SyntaxError', () => {
      const error = new SyntaxError('Unexpected token');
      const statusCode = errorCodeFactory(error);

      // Should return 400 (could match "invalid" pattern)
      expect(statusCode).toBe(400);
    });

    it('should handle Error with "not found" at start of message', () => {
      const error = new Error('Not found: prayer wall does not exist');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(404);
    });

    it('should handle Error with "not found" at end of message', () => {
      const error = new Error('The requested resource was not found');
      const statusCode = errorCodeFactory(error);

      expect(statusCode).toBe(404);
    });

    it('should handle Error with multiple pattern matches (first match wins)', () => {
      // Message contains both "not found" (404) and "invalid" (400)
      const error = new Error('Invalid request: resource not found');
      const statusCode = errorCodeFactory(error);

      // Should return 404 because "not found" is checked first in the function
      expect(statusCode).toBe(404);
    });

    it('should handle Error with statusCode as string', () => {
      const error: any = {
        message: 'Some error',
        statusCode: '422', // String instead of number
      };

      const statusCode = errorCodeFactory(error);
      // Type guard should catch this as a number
      expect(statusCode).toBe(422);
    });

    it('should handle Error with non-numeric statusCode', () => {
      const error: any = {
        message: 'validation error',
        statusCode: 'invalid', // Non-numeric string
      };

      const statusCode = errorCodeFactory(error);
      // Should fallback to message pattern matching
      expect(statusCode).toBe(400);
    });
  });
});