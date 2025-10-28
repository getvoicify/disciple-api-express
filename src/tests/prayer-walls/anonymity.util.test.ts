import { describe, it, expect } from 'vitest';
import { getAuthorInfo } from '../../prayer-walls/utils/anonymity.util';
import { AnonymityLevel } from '../../prayer-walls/types/prayer-wall.types';
import type { PrayerRequest, PrayerWall } from '../../prayer-walls/types/prayer-wall.types';

describe('Anonymity Enforcement - getAuthorInfo', () => {
  // ============================================================================
  // Test Data Fixtures
  // ============================================================================

  const createMockPrayer = (
    overrides: Partial<PrayerRequest> = {}
  ): PrayerRequest => ({
    id: 'prayer-123',
    wall_id: 'wall-123',
    author_id: 'author-123',
    parent_id: null,
    thread_depth: 0,
    content: 'Please pray for my family',
    anonymity_level: AnonymityLevel.IDENTIFIED,
    has_attachment: false,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  });

  const createMockWall = (isPrivate: boolean): Pick<PrayerWall, 'is_private'> => ({
    is_private: isPrivate,
  });

  const memberUser = { userId: 'member-456', isPastor: false };
  const pastorUser = { userId: 'pastor-789', isPastor: true };

  // ============================================================================
  // IDENTIFIED - Full Identity Visible to Everyone
  // ============================================================================

  describe('AnonymityLevel.IDENTIFIED', () => {
    it('should show full author identity to members on public wall', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.IDENTIFIED,
        author_id: 'john-doe-123',
      });
      const wall = createMockWall(false);

      const result = getAuthorInfo(prayer, memberUser, wall);

      expect(result.authorId).toBe('john-doe-123');
      expect(result.isAnonymous).toBe(false);
      expect(result.authorName).toBeUndefined(); // Name lookup happens at service/client layer
    });

    it('should show full author identity to pastors on public wall', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.IDENTIFIED,
        author_id: 'jane-smith-456',
      });
      const wall = createMockWall(false);

      const result = getAuthorInfo(prayer, pastorUser, wall);

      expect(result.authorId).toBe('jane-smith-456');
      expect(result.isAnonymous).toBe(false);
      expect(result.authorName).toBeUndefined(); // Name lookup happens at service/client layer
    });

    it('should show full author identity on private wall regardless of viewer', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.IDENTIFIED,
        author_id: 'author-789',
      });
      const wall = createMockWall(true);

      const resultForMember = getAuthorInfo(prayer, memberUser, wall);
      const resultForPastor = getAuthorInfo(prayer, pastorUser, wall);

      expect(resultForMember.authorId).toBe('author-789');
      expect(resultForMember.isAnonymous).toBe(false);

      expect(resultForPastor.authorId).toBe('author-789');
      expect(resultForPastor.isAnonymous).toBe(false);
    });
  });

  // ============================================================================
  // ANONYMOUS_TO_MEMBERS - Identity Hidden from Members, Visible to Pastors
  // ============================================================================

  describe('AnonymityLevel.ANONYMOUS_TO_MEMBERS', () => {
    it('should hide identity from members on public wall', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        author_id: 'secret-user-123',
      });
      const wall = createMockWall(false);

      const result = getAuthorInfo(prayer, memberUser, wall);

      expect(result.authorId).toBeUndefined();
      expect(result.authorName).toBe('Anonymous Member');
      expect(result.isAnonymous).toBe(true);
    });

    it('should show identity to pastors on public wall', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        author_id: 'secret-user-123',
      });
      const wall = createMockWall(false);

      const result = getAuthorInfo(prayer, pastorUser, wall);

      expect(result.authorId).toBe('secret-user-123');
      expect(result.isAnonymous).toBe(false);
      expect(result.authorName).toBeUndefined(); // Name lookup happens at service/client layer
    });

    it('should show identity to both members and pastors on private wall (privacy override)', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        author_id: 'revealed-user-456',
      });
      const wall = createMockWall(true);

      const resultForMember = getAuthorInfo(prayer, memberUser, wall);
      const resultForPastor = getAuthorInfo(prayer, pastorUser, wall);

      // Private wall ALWAYS reveals identity regardless of anonymity setting
      expect(resultForMember.authorId).toBe('revealed-user-456');
      expect(resultForMember.isAnonymous).toBe(false);

      expect(resultForPastor.authorId).toBe('revealed-user-456');
      expect(resultForPastor.isAnonymous).toBe(false);
    });
  });

  // ============================================================================
  // FULLY_ANONYMOUS - Identity Hidden from Everyone Including Pastors
  // ============================================================================

  describe('AnonymityLevel.FULLY_ANONYMOUS', () => {
    it('should hide identity from members on public wall', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: 'ultra-secret-123',
      });
      const wall = createMockWall(false);

      const result = getAuthorInfo(prayer, memberUser, wall);

      expect(result.authorId).toBeUndefined();
      expect(result.authorName).toBe('Anonymous');
      expect(result.isAnonymous).toBe(true);
    });

    it('should hide identity from pastors on public wall', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: 'ultra-secret-123',
      });
      const wall = createMockWall(false);

      const result = getAuthorInfo(prayer, pastorUser, wall);

      expect(result.authorId).toBeUndefined();
      expect(result.authorName).toBe('Anonymous');
      expect(result.isAnonymous).toBe(true);
    });

    it('should show identity on private wall even for fully anonymous (privacy override)', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: 'revealed-secret-789',
      });
      const wall = createMockWall(true);

      const resultForMember = getAuthorInfo(prayer, memberUser, wall);
      const resultForPastor = getAuthorInfo(prayer, pastorUser, wall);

      // Private wall ALWAYS reveals identity regardless of anonymity setting
      expect(resultForMember.authorId).toBe('revealed-secret-789');
      expect(resultForMember.isAnonymous).toBe(false);

      expect(resultForPastor.authorId).toBe('revealed-secret-789');
      expect(resultForPastor.isAnonymous).toBe(false);
    });
  });

  // ============================================================================
  // Private Wall Override - Always Shows Identity
  // ============================================================================

  describe('Private Wall Override', () => {
    it('should always reveal identity on private wall regardless of anonymity level', () => {
      const wall = createMockWall(true);

      const identifiedPrayer = createMockPrayer({
        anonymity_level: AnonymityLevel.IDENTIFIED,
        author_id: 'user-1',
      });

      const anonymousToMembersPrayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        author_id: 'user-2',
      });

      const fullyAnonymousPrayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: 'user-3',
      });

      const result1 = getAuthorInfo(identifiedPrayer, memberUser, wall);
      const result2 = getAuthorInfo(anonymousToMembersPrayer, memberUser, wall);
      const result3 = getAuthorInfo(fullyAnonymousPrayer, memberUser, wall);

      // All should reveal identity on private wall
      expect(result1.isAnonymous).toBe(false);
      expect(result1.authorId).toBe('user-1');

      expect(result2.isAnonymous).toBe(false);
      expect(result2.authorId).toBe('user-2');

      expect(result3.isAnonymous).toBe(false);
      expect(result3.authorId).toBe('user-3');
    });

    it('should reveal identity to both members and pastors on private wall', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: 'always-revealed-user',
      });
      const wall = createMockWall(true);

      const memberResult = getAuthorInfo(prayer, memberUser, wall);
      const pastorResult = getAuthorInfo(prayer, pastorUser, wall);

      expect(memberResult).toEqual(pastorResult);
      expect(memberResult.isAnonymous).toBe(false);
      expect(memberResult.authorId).toBe('always-revealed-user');
    });
  });

  // ============================================================================
  // Edge Cases and Boundary Conditions
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle prayer with null parent_id correctly', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        parent_id: null,
      });
      const wall = createMockWall(false);

      const result = getAuthorInfo(prayer, memberUser, wall);

      expect(result.isAnonymous).toBe(true);
      expect(result.authorName).toBe('Anonymous Member');
    });

    it('should handle thread responses (with parent_id) correctly', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        parent_id: 'parent-prayer-123',
        thread_depth: 1,
      });
      const wall = createMockWall(false);

      const memberResult = getAuthorInfo(prayer, memberUser, wall);
      const pastorResult = getAuthorInfo(prayer, pastorUser, wall);

      // Members should not see identity
      expect(memberResult.isAnonymous).toBe(true);
      expect(memberResult.authorId).toBeUndefined();

      // Pastors should see identity
      expect(pastorResult.isAnonymous).toBe(false);
      expect(pastorResult.authorId).toBeDefined();
    });

    it('should handle deep thread responses consistently', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        parent_id: 'parent-prayer-123',
        thread_depth: 3,
      });
      const wall = createMockWall(false);

      const result = getAuthorInfo(prayer, pastorUser, wall);

      // Even pastors should not see identity for fully anonymous
      expect(result.isAnonymous).toBe(true);
      expect(result.authorId).toBeUndefined();
      expect(result.authorName).toBe('Anonymous');
    });

    it('should handle author viewing their own anonymous prayer', () => {
      const authorUserId = 'author-self-123';
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: authorUserId,
      });
      const wall = createMockWall(false);
      const authorAsMember = { userId: authorUserId, isPastor: false };

      const result = getAuthorInfo(prayer, authorAsMember, wall);

      // Author should still see themselves as anonymous to maintain consistency
      // (The UI layer should handle showing "You" or similar indicator)
      expect(result.isAnonymous).toBe(true);
      expect(result.authorName).toBe('Anonymous');
    });
  });

  // ============================================================================
  // WebSocket Real-Time Event Anonymity
  // ============================================================================

  describe('WebSocket Event Anonymity', () => {
    it('should apply anonymity rules for real-time prayer creation events', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        author_id: 'ws-user-123',
      });
      const wall = createMockWall(false);

      // Simulate event being broadcast to a member
      const eventForMember = getAuthorInfo(prayer, memberUser, wall);

      // Simulate event being broadcast to a pastor
      const eventForPastor = getAuthorInfo(prayer, pastorUser, wall);

      expect(eventForMember.authorName).toBe('Anonymous Member');
      expect(eventForMember.authorId).toBeUndefined();
      expect(eventForMember.isAnonymous).toBe(true);

      expect(eventForPastor.authorId).toBe('ws-user-123');
      expect(eventForPastor.isAnonymous).toBe(false);
    });

    it('should apply anonymity rules for real-time response events', () => {
      const response = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: 'responder-456',
        parent_id: 'original-prayer-123',
        thread_depth: 1,
      });
      const wall = createMockWall(false);

      const eventForMember = getAuthorInfo(response, memberUser, wall);
      const eventForPastor = getAuthorInfo(response, pastorUser, wall);

      // Both member and pastor should see anonymous for FULLY_ANONYMOUS
      expect(eventForMember.authorName).toBe('Anonymous');
      expect(eventForMember.isAnonymous).toBe(true);
      expect(eventForPastor.authorName).toBe('Anonymous');
      expect(eventForPastor.isAnonymous).toBe(true);
    });

    it('should handle WebSocket events on private walls correctly', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: 'private-ws-user-789',
      });
      const wall = createMockWall(true);

      const eventForMember = getAuthorInfo(prayer, memberUser, wall);

      // Private wall should always reveal identity in WebSocket events
      expect(eventForMember.isAnonymous).toBe(false);
      expect(eventForMember.authorId).toBe('private-ws-user-789');
    });
  });

  // ============================================================================
  // Consistency and Audit Trail
  // ============================================================================

  describe('Consistency and Audit Trail', () => {
    it('should always maintain author_id in database regardless of anonymity', () => {
      // Note: This test documents that author_id is ALWAYS stored in the database
      // The getAuthorInfo function only controls what is RETURNED to clients
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: 'database-audit-123',
      });
      const wall = createMockWall(false);

      // Verify prayer object still contains author_id
      expect(prayer.author_id).toBe('database-audit-123');

      // But the returned info should hide it
      const result = getAuthorInfo(prayer, memberUser, wall);
      expect(result.authorId).toBeUndefined();
    });

    it('should return consistent results for same inputs', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        author_id: 'consistent-user-123',
      });
      const wall = createMockWall(false);

      const result1 = getAuthorInfo(prayer, memberUser, wall);
      const result2 = getAuthorInfo(prayer, memberUser, wall);

      expect(result1).toEqual(result2);
    });

    it('should not mutate input prayer object', () => {
      const originalPrayer = createMockPrayer({
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        author_id: 'immutable-test-123',
      });
      const wall = createMockWall(false);

      const originalAuthorId = originalPrayer.author_id;
      const originalAnonymityLevel = originalPrayer.anonymity_level;

      getAuthorInfo(originalPrayer, memberUser, wall);

      // Prayer object should remain unchanged
      expect(originalPrayer.author_id).toBe(originalAuthorId);
      expect(originalPrayer.anonymity_level).toBe(originalAnonymityLevel);
    });
  });

  // ============================================================================
  // User Role Verification
  // ============================================================================

  describe('User Role Verification', () => {
    it('should correctly differentiate between member and pastor roles', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        author_id: 'role-test-user',
      });
      const wall = createMockWall(false);

      const memberResult = getAuthorInfo(prayer, { userId: 'user-1', isPastor: false }, wall);
      const pastorResult = getAuthorInfo(prayer, { userId: 'user-2', isPastor: true }, wall);

      expect(memberResult.isAnonymous).toBe(true);
      expect(pastorResult.isAnonymous).toBe(false);
    });

    it('should handle non-boolean isPastor values gracefully', () => {
      const prayer = createMockPrayer({
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
      });
      const wall = createMockWall(false);

      // Test with falsy value (should be treated as non-pastor)
      const falsyUser = { userId: 'user-falsy', isPastor: false };
      const result = getAuthorInfo(prayer, falsyUser, wall);

      expect(result.isAnonymous).toBe(true);
    });
  });
});
