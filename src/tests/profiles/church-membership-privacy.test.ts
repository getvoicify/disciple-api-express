import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostgresProfileRepository } from '../../profiles/pg-repository';
import type { RawDb } from '../../utils/database';
import type { CreateProfileInput } from '../../profiles/schemas';

/**
 * TDD Tests for Church Membership Validation (Gap 2)
 *
 * These tests define the expected behavior for 'church_only' privacy mode.
 * They will FAIL until the implementation is complete.
 */
describe('Church Membership Privacy Validation', () => {
  let repository: PostgresProfileRepository;
  let mockDb: any;

  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
  const TEST_REQUESTING_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
  const TEST_PASTOR_USER_ID = '550e8400-e29b-41d4-a716-446655440003';
  const SHARED_CHURCH_ID = 'church-123';
  const DIFFERENT_CHURCH_ID = 'church-456';

  beforeEach(() => {
    // Create template function for SQL queries
    const createTemplateFn = () => {
      const fn = vi.fn((strings: TemplateStringsArray, ...values: any[]) => {
        return Promise.resolve([]);
      });
      return fn;
    };

    // Mock database client with template function behavior
    const dbTemplateFn = vi.fn((strings: TemplateStringsArray, ...values: any[]) => {
      return Promise.resolve([]);
    });

    mockDb = Object.assign(dbTemplateFn, {
      begin: vi.fn((callback) => callback(dbTemplateFn)),
      unsafe: vi.fn().mockResolvedValue([]),
    });

    repository = new PostgresProfileRepository(mockDb as unknown as RawDb);
  });

  describe('Test 1: Allow access when users share a church', () => {
    it('should allow access to church_only profile when requesting user is in same church', async () => {
      const mockProfile = {
        user_id: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: null,
        privacy_mode: 'church_only',
        field_visibility_settings: {},
        cached_metrics: {},
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock profile query
      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      // Mock church membership check - both users in same church
      mockDb.mockReturnValueOnce(Promise.resolve([
        { church_id: SHARED_CHURCH_ID }
      ]));

      const result = await repository.findById(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(TEST_USER_ID);
      expect(result?.bio).toBe('My bio');
    });
  });

  describe('Test 2: Deny access when users do not share a church', () => {
    it('should deny access to church_only profile when requesting user is NOT in same church', async () => {
      const mockProfile = {
        user_id: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: null,
        privacy_mode: 'church_only',
        field_visibility_settings: {},
        cached_metrics: {},
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock profile query
      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      // Mock church membership check - no shared churches
      mockDb.mockReturnValueOnce(Promise.resolve([])); // Empty result = no shared churches

      const result = await repository.findById(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(result).toBeNull(); // Should deny access
    });
  });

  describe('Test 3: Pastor can access church_only profiles regardless of membership', () => {
    it('should allow pastor access to church_only profile even without shared church', async () => {
      const mockProfile = {
        user_id: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: null,
        privacy_mode: 'church_only',
        field_visibility_settings: {},
        cached_metrics: {},
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock profile query
      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      // Pastor role bypasses church membership check (no membership query needed)
      const result = await repository.findById(TEST_USER_ID, TEST_PASTOR_USER_ID, 'pastor');

      expect(result).toBeDefined();
      expect(result?.userId).toBe(TEST_USER_ID);
      expect(result?.bio).toBe('My bio');
    });
  });

  describe('Test 4: Public profiles do not require church membership', () => {
    it('should allow access to public profile regardless of church membership', async () => {
      const mockProfile = {
        user_id: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: null,
        privacy_mode: 'public',
        field_visibility_settings: {},
        cached_metrics: {},
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock profile query
      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      // No church membership check needed for public profiles
      const result = await repository.findById(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(TEST_USER_ID);
      expect(result?.bio).toBe('My bio');
    });
  });

  describe('Test 5: User can always access own profile', () => {
    it('should allow user to access own church_only profile without membership check', async () => {
      const mockProfile = {
        user_id: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: null,
        privacy_mode: 'church_only',
        field_visibility_settings: {},
        cached_metrics: {},
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock profile query
      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      // No church membership check when viewing own profile
      const result = await repository.findById(TEST_USER_ID, TEST_USER_ID);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(TEST_USER_ID);
      expect(result?.bio).toBe('My bio');
    });
  });

  describe('Test 6: Multiple church memberships', () => {
    it('should grant access if users share ANY church (not all churches)', async () => {
      const mockProfile = {
        user_id: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: null,
        privacy_mode: 'church_only',
        field_visibility_settings: {},
        cached_metrics: {},
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock profile query
      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      // Mock church membership check - users share at least one church
      mockDb.mockReturnValueOnce(Promise.resolve([
        { church_id: SHARED_CHURCH_ID }, // Shared church
      ]));

      const result = await repository.findById(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(TEST_USER_ID);
    });
  });

  describe('Test 7: Church membership database check', () => {
    it('should query the database twice for church_only profiles', async () => {
      const mockProfile = {
        user_id: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: null,
        privacy_mode: 'church_only',
        field_visibility_settings: {},
        cached_metrics: {},
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock profile query
      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      // Mock church membership check
      mockDb.mockReturnValueOnce(Promise.resolve([
        { church_id: SHARED_CHURCH_ID }
      ]));

      await repository.findById(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      // Verify: 1st call for profile, 2nd call for church membership
      expect(mockDb).toHaveBeenCalledTimes(2);

      // Verify the second call exists (church membership lookup)
      const churchMembershipCall = mockDb.mock.calls[1];
      expect(churchMembershipCall).toBeDefined();
    });
  });
});
