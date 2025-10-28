import { describe, it, expect } from 'vitest';
import type { PrayerRequest, PrayerWall } from '../../prayer-walls/types/prayer-wall.types';
import { AnonymityLevel } from '../../prayer-walls/types/prayer-wall.types';
import type { EndpointRequest } from '../../types/endpoint-handler';
import type { AuthorInfo, RequestingUser } from '../../prayer-walls/utils/anonymity.util';
import {
  applyAnonymityToPrayer,
  applyAnonymityToPrayers,
  getUserRoleFromRequest,
} from '../../prayer-walls/utils/apply-anonymity.util';

describe('Apply Anonymity Utility - Response Helpers', () => {
  // ============================================================================
  // Test Data Fixtures
  // ============================================================================

  const createMockPrayer = (overrides: Partial<PrayerRequest> = {}): PrayerRequest => ({
    id: 'prayer-123',
    wall_id: 'wall-123',
    author_id: 'author-123',
    parent_id: null,
    thread_depth: 0,
    content: 'Please pray for my family',
    anonymity_level: AnonymityLevel.IDENTIFIED,
    has_attachment: false,
    created_at: new Date('2025-01-15T10:00:00Z'),
    updated_at: new Date('2025-01-15T10:00:00Z'),
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  });

  const createMockWall = (isPrivate: boolean): Pick<PrayerWall, 'is_private'> => ({
    is_private: isPrivate,
  });

  const memberUser: RequestingUser = { userId: 'member-456', isPastor: false };
  const pastorUser: RequestingUser = { userId: 'pastor-789', isPastor: true };

  // ============================================================================
  // applyAnonymityToPrayer - Single Prayer Transformation
  // ============================================================================

  describe('applyAnonymityToPrayer', () => {
    it('should remove author_id from response', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.IDENTIFIED,
        author_id: 'user-123',
      });
      const wall = createMockWall(false);

      const result = applyAnonymityToPrayer(prayer, memberUser, wall);

      expect(result).not.toHaveProperty('author_id');
      expect('author_id' in result).toBe(false);
    });

    it('should add author object with anonymity applied for identified prayer', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.IDENTIFIED,
        author_id: 'user-123',
      });
      const wall = createMockWall(false);

      const result = applyAnonymityToPrayer(prayer, memberUser, wall);

      expect(result.author).toBeDefined();
      expect(result.author.authorId).toBe('user-123');
      expect(result.author.isAnonymous).toBe(false);
    });

    it('should add author object with anonymity applied for anonymous_to_members prayer (member viewing)', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        author_id: 'secret-user-123',
      });
      const wall = createMockWall(false);

      const result = applyAnonymityToPrayer(prayer, memberUser, wall);

      expect(result.author).toBeDefined();
      expect(result.author.authorId).toBeUndefined();
      expect(result.author.authorName).toBe('Anonymous Member');
      expect(result.author.isAnonymous).toBe(true);
    });

    it('should add author object with anonymity applied for anonymous_to_members prayer (pastor viewing)', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        author_id: 'secret-user-123',
      });
      const wall = createMockWall(false);

      const result = applyAnonymityToPrayer(prayer, pastorUser, wall);

      expect(result.author).toBeDefined();
      expect(result.author.authorId).toBe('secret-user-123');
      expect(result.author.isAnonymous).toBe(false);
    });

    it('should add author object with anonymity applied for fully_anonymous prayer', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: 'ultra-secret-123',
      });
      const wall = createMockWall(false);

      const resultForMember = applyAnonymityToPrayer(prayer, memberUser, wall);
      const resultForPastor = applyAnonymityToPrayer(prayer, pastorUser, wall);

      expect(resultForMember.author.authorId).toBeUndefined();
      expect(resultForMember.author.authorName).toBe('Anonymous');
      expect(resultForMember.author.isAnonymous).toBe(true);

      expect(resultForPastor.author.authorId).toBeUndefined();
      expect(resultForPastor.author.authorName).toBe('Anonymous');
      expect(resultForPastor.author.isAnonymous).toBe(true);
    });

    it('should preserve all other prayer fields', () => {
      const prayer = createMockPrayer({
        id: 'prayer-456',
        wall_id: 'wall-789',
        parent_id: 'parent-123',
        thread_depth: 2,
        content: 'Test prayer content',
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        has_attachment: true,
        deleted_at: new Date('2025-01-16T10:00:00Z'),
        deleted_by: 'user-999',
      });
      const wall = createMockWall(false);

      const result = applyAnonymityToPrayer(prayer, memberUser, wall);

      expect(result.id).toBe('prayer-456');
      expect(result.wall_id).toBe('wall-789');
      expect(result.parent_id).toBe('parent-123');
      expect(result.thread_depth).toBe(2);
      expect(result.content).toBe('Test prayer content');
      expect(result.anonymity_level).toBe(AnonymityLevel.ANONYMOUS_TO_MEMBERS);
      expect(result.has_attachment).toBe(true);
      expect(result.deleted_at).toEqual(new Date('2025-01-16T10:00:00Z'));
      expect(result.deleted_by).toBe('user-999');
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should work with private wall override', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: 'revealed-user-123',
      });
      const wall = createMockWall(true);

      const result = applyAnonymityToPrayer(prayer, memberUser, wall);

      expect(result.author.authorId).toBe('revealed-user-123');
      expect(result.author.isAnonymous).toBe(false);
      expect('author_id' in result).toBe(false);
    });

    it('should handle null parent_id correctly', () => {
      const prayer = createMockPrayer({
        parent_id: null,
        anonymity_level: AnonymityLevel.IDENTIFIED,
      });
      const wall = createMockWall(false);

      const result = applyAnonymityToPrayer(prayer, memberUser, wall);

      expect(result.parent_id).toBeNull();
      expect(result.author).toBeDefined();
    });

    it('should handle thread responses (with parent_id)', () => {
      const prayer = createMockPrayer({
        parent_id: 'parent-prayer-123',
        thread_depth: 1,
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
      });
      const wall = createMockWall(false);

      const result = applyAnonymityToPrayer(prayer, pastorUser, wall);

      expect(result.parent_id).toBe('parent-prayer-123');
      expect(result.thread_depth).toBe(1);
      expect(result.author.isAnonymous).toBe(false);
    });
  });

  // ============================================================================
  // applyAnonymityToPrayers - Multiple Prayers Transformation
  // ============================================================================

  describe('applyAnonymityToPrayers', () => {
    it('should transform array of prayers', () => {
      const prayers: PrayerRequest[] = [
        createMockPrayer({
          id: 'prayer-1',
          author_id: 'user-1',
          anonymity_level: AnonymityLevel.IDENTIFIED,
        }),
        createMockPrayer({
          id: 'prayer-2',
          author_id: 'user-2',
          anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        }),
        createMockPrayer({
          id: 'prayer-3',
          author_id: 'user-3',
          anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        }),
      ];
      const wall = createMockWall(false);

      const results = applyAnonymityToPrayers(prayers, memberUser, wall);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('prayer-1');
      expect(results[1].id).toBe('prayer-2');
      expect(results[2].id).toBe('prayer-3');

      expect('author_id' in results[0]).toBe(false);
      expect('author_id' in results[1]).toBe(false);
      expect('author_id' in results[2]).toBe(false);
    });

    it('should handle empty array', () => {
      const prayers: PrayerRequest[] = [];
      const wall = createMockWall(false);

      const results = applyAnonymityToPrayers(prayers, memberUser, wall);

      expect(results).toEqual([]);
      expect(results).toHaveLength(0);
    });

    it('should independently anonymize each prayer', () => {
      const prayers: PrayerRequest[] = [
        createMockPrayer({
          id: 'prayer-1',
          author_id: 'user-1',
          anonymity_level: AnonymityLevel.IDENTIFIED,
        }),
        createMockPrayer({
          id: 'prayer-2',
          author_id: 'user-2',
          anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        }),
      ];
      const wall = createMockWall(false);

      const results = applyAnonymityToPrayers(prayers, memberUser, wall);

      // First prayer should show author ID
      expect(results[0].author.authorId).toBe('user-1');
      expect(results[0].author.isAnonymous).toBe(false);

      // Second prayer should hide author ID from member
      expect(results[1].author.authorId).toBeUndefined();
      expect(results[1].author.authorName).toBe('Anonymous Member');
      expect(results[1].author.isAnonymous).toBe(true);
    });

    it('should apply different anonymity for pastor vs member on same prayers', () => {
      const prayers: PrayerRequest[] = [
        createMockPrayer({
          id: 'prayer-1',
          author_id: 'user-1',
          anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        }),
      ];
      const wall = createMockWall(false);

      const memberResults = applyAnonymityToPrayers(prayers, memberUser, wall);
      const pastorResults = applyAnonymityToPrayers(prayers, pastorUser, wall);

      expect(memberResults[0].author.isAnonymous).toBe(true);
      expect(memberResults[0].author.authorId).toBeUndefined();

      expect(pastorResults[0].author.isAnonymous).toBe(false);
      expect(pastorResults[0].author.authorId).toBe('user-1');
    });

    it('should preserve array order', () => {
      const prayers: PrayerRequest[] = [
        createMockPrayer({ id: 'prayer-1', created_at: new Date('2025-01-15T10:00:00Z') }),
        createMockPrayer({ id: 'prayer-2', created_at: new Date('2025-01-15T11:00:00Z') }),
        createMockPrayer({ id: 'prayer-3', created_at: new Date('2025-01-15T12:00:00Z') }),
      ];
      const wall = createMockWall(false);

      const results = applyAnonymityToPrayers(prayers, memberUser, wall);

      expect(results[0].id).toBe('prayer-1');
      expect(results[1].id).toBe('prayer-2');
      expect(results[2].id).toBe('prayer-3');
    });

    it('should handle single prayer in array', () => {
      const prayers: PrayerRequest[] = [
        createMockPrayer({
          id: 'prayer-1',
          anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        }),
      ];
      const wall = createMockWall(false);

      const results = applyAnonymityToPrayers(prayers, memberUser, wall);

      expect(results).toHaveLength(1);
      expect(results[0].author.isAnonymous).toBe(true);
    });
  });

  // ============================================================================
  // getUserRoleFromRequest - Extract User Info from Express Request
  // ============================================================================

  describe('getUserRoleFromRequest', () => {
    it('should extract userId correctly from req.user', () => {
      const mockRequest = {
        user: [
          undefined,
          {
            payload: {
              sub: 'user-123-from-jwt',
              email: 'test@example.com',
            },
          },
        ],
      } as unknown as EndpointRequest;

      const result = getUserRoleFromRequest(mockRequest);

      expect(result.userId).toBe('user-123-from-jwt');
    });

    it('should identify pastor role correctly', () => {
      const mockRequest = {
        user: [
          undefined,
          {
            payload: {
              sub: 'pastor-123',
              realm_access: {
                roles: ['member', 'pastor', 'user'],
              },
            },
          },
        ],
      } as unknown as EndpointRequest;

      const result = getUserRoleFromRequest(mockRequest);

      expect(result.userId).toBe('pastor-123');
      expect(result.isPastor).toBe(true);
    });

    it('should identify admin as pastor', () => {
      const mockRequest = {
        user: [
          undefined,
          {
            payload: {
              sub: 'admin-123',
              realm_access: {
                roles: ['admin', 'user'],
              },
            },
          },
        ],
      } as unknown as EndpointRequest;

      const result = getUserRoleFromRequest(mockRequest);

      expect(result.userId).toBe('admin-123');
      expect(result.isPastor).toBe(true);
    });

    it('should handle missing role information', () => {
      const mockRequest = {
        user: [
          undefined,
          {
            payload: {
              sub: 'user-123',
              // No realm_access
            },
          },
        ],
      } as unknown as EndpointRequest;

      const result = getUserRoleFromRequest(mockRequest);

      expect(result.userId).toBe('user-123');
      expect(result.isPastor).toBe(false);
    });

    it('should handle empty roles array', () => {
      const mockRequest = {
        user: [
          undefined,
          {
            payload: {
              sub: 'user-123',
              realm_access: {
                roles: [],
              },
            },
          },
        ],
      } as unknown as EndpointRequest;

      const result = getUserRoleFromRequest(mockRequest);

      expect(result.userId).toBe('user-123');
      expect(result.isPastor).toBe(false);
    });

    it('should handle roles array without pastor or admin', () => {
      const mockRequest = {
        user: [
          undefined,
          {
            payload: {
              sub: 'user-123',
              realm_access: {
                roles: ['member', 'user', 'viewer'],
              },
            },
          },
        ],
      } as unknown as EndpointRequest;

      const result = getUserRoleFromRequest(mockRequest);

      expect(result.userId).toBe('user-123');
      expect(result.isPastor).toBe(false);
    });

    it('should handle undefined user payload', () => {
      const mockRequest = {
        user: undefined,
      } as unknown as EndpointRequest;

      const result = getUserRoleFromRequest(mockRequest);

      expect(result.userId).toBe('');
      expect(result.isPastor).toBe(false);
    });

    it('should handle malformed user array', () => {
      const mockRequest = {
        user: [undefined],
      } as unknown as EndpointRequest;

      const result = getUserRoleFromRequest(mockRequest);

      expect(result.userId).toBe('');
      expect(result.isPastor).toBe(false);
    });

    it('should handle missing sub field', () => {
      const mockRequest = {
        user: [
          undefined,
          {
            payload: {
              email: 'test@example.com',
              // No sub field
            },
          },
        ],
      } as unknown as EndpointRequest;

      const result = getUserRoleFromRequest(mockRequest);

      expect(result.userId).toBe('');
      expect(result.isPastor).toBe(false);
    });

    it('should be case-sensitive for role names', () => {
      const mockRequest = {
        user: [
          undefined,
          {
            payload: {
              sub: 'user-123',
              realm_access: {
                roles: ['PASTOR', 'Admin'], // Wrong case
              },
            },
          },
        ],
      } as unknown as EndpointRequest;

      const result = getUserRoleFromRequest(mockRequest);

      expect(result.userId).toBe('user-123');
      expect(result.isPastor).toBe(false);
    });

    it('should handle both pastor and admin roles present', () => {
      const mockRequest = {
        user: [
          undefined,
          {
            payload: {
              sub: 'super-user-123',
              realm_access: {
                roles: ['pastor', 'admin', 'user'],
              },
            },
          },
        ],
      } as unknown as EndpointRequest;

      const result = getUserRoleFromRequest(mockRequest);

      expect(result.userId).toBe('super-user-123');
      expect(result.isPastor).toBe(true);
    });
  });
});
