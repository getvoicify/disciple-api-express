import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgresProfileRepository } from '../../profiles/pg-repository';
import { ProfileServiceImpl } from '../../profiles/service';
import { CreateProfileInput, UpdateProfileInput } from '../../profiles/schemas';
import type { Profile, ProfileStatistics } from '../../profiles/schemas';
import type { RawDb } from '../../utils/database';
import type { CacheRepository } from '../../cache/cache.repository';

/**
 * Integration tests for User Profile System
 * Tests end-to-end flows and critical integration points
 *
 * These tests verify:
 * - Field-level visibility enforcement
 * - Cache invalidation full flow
 * - Statistics TTL and refresh logic
 * - Schema validation edge cases
 * - Profile with media foreign key relationship
 * - Privacy mode 'church_only' behavior
 */

// Mock logger
vi.mock('../../logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Profile System - Integration Tests', () => {
  let mockDb: any;
  let mockTx: any;
  let repository: PostgresProfileRepository;
  let service: ProfileServiceImpl;
  let mockCacheRepository: any;

  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
  const TEST_REQUESTING_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
  const TEST_MEDIA_ID = '550e8400-e29b-41d4-a716-446655440003';

  beforeEach(() => {
    vi.clearAllMocks();

    // Create template function for SQL queries
    const createTemplateFn = () => {
      const fn = vi.fn((strings: TemplateStringsArray, ...values: any[]) => {
        return Promise.resolve([]);
      });
      return fn;
    };

    // Mock transaction object
    mockTx = Object.assign(createTemplateFn(), {
      unsafe: vi.fn().mockResolvedValue([]),
    });

    // Mock database client
    const dbTemplateFn = vi.fn((strings: TemplateStringsArray, ...values: any[]) => {
      return Promise.resolve([]);
    });

    mockDb = Object.assign(dbTemplateFn, {
      begin: vi.fn((callback) => callback(mockTx)),
      unsafe: vi.fn().mockResolvedValue([]),
    });

    // Mock cache repository
    mockCacheRepository = {
      write: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      deletePattern: vi.fn().mockResolvedValue(undefined),
      deleteByPrefix: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    repository = new PostgresProfileRepository(mockDb as unknown as RawDb);
    service = new ProfileServiceImpl(
      repository,
      mockCacheRepository as unknown as CacheRepository,
      mockDb as unknown as RawDb
    );
  });

  describe('Test 1: Field-Level Visibility Enforcement', () => {
    it('should hide fields based on field_visibility_settings when fetching profile', async () => {
      // This test verifies the critical per-field visibility feature from the spec
      const mockProfile = {
        user_id: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: TEST_MEDIA_ID,
        privacy_mode: 'public',
        field_visibility_settings: {
          testimony: false, // Hide testimony
          bio: true, // Show bio
        },
        cached_metrics: {
          notesCount: 10,
          prayersCount: 5,
        },
        notification_preferences: {},
        preferred_devotional_time: '08:00:00',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock cache miss so service fetches from repository
      mockCacheRepository.read.mockResolvedValueOnce(null);
      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      const result = await service.getProfile(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(result).toBeDefined();

      // Field visibility should be enforced: bio is visible, testimony is hidden
      expect(result?.bio).toBe('My bio');
      expect(result?.testimony).toBeNull(); // Hidden by field_visibility_settings
    });
  });

  describe('Test 2: Cache Invalidation Full Flow', () => {
    it('should complete full cache invalidation flow on profile update', async () => {
      const createInput: CreateProfileInput = {
        bio: 'Original bio',
        testimony: 'Original testimony',
        privacyMode: 'church_only',
      };

      const originalProfile: Profile = {
        userId: TEST_USER_ID,
        bio: 'Original bio',
        testimony: 'Original testimony',
        profilePhotoMediaId: null,
        privacyMode: 'church_only',
        fieldVisibilitySettings: {},
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedProfile: Profile = {
        ...originalProfile,
        bio: 'Updated bio',
        testimony: 'Updated testimony',
        updatedAt: new Date(),
      };

      // Mock repository responses
      mockTx.mockReturnValueOnce(Promise.resolve([
        {
          user_id: TEST_USER_ID,
          bio: originalProfile.bio,
          testimony: originalProfile.testimony,
          profile_photo_media_id: null,
          privacy_mode: 'church_only',
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: {},
          preferred_devotional_time: null,
          created_at: originalProfile.createdAt,
          updated_at: originalProfile.updatedAt,
        }
      ]));

      // Step 1: Create profile
      await service.createProfile(TEST_USER_ID, createInput);

      // Step 2: Update profile (triggers cache invalidation)
      mockTx.unsafe.mockResolvedValueOnce([
        {
          user_id: TEST_USER_ID,
          bio: 'Updated bio',
          testimony: 'Updated testimony',
          profile_photo_media_id: null,
          privacy_mode: 'church_only',
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: {},
          preferred_devotional_time: null,
          created_at: originalProfile.createdAt,
          updated_at: updatedProfile.updatedAt,
        }
      ]);

      const updateInput: UpdateProfileInput = {
        bio: 'Updated bio',
        testimony: 'Updated testimony',
      };

      await service.updateProfile(TEST_USER_ID, TEST_USER_ID, updateInput);

      // Verify cache was invalidated (3 delete calls)
      expect(mockCacheRepository.delete).toHaveBeenCalledWith(`profile:${TEST_USER_ID}`);
      expect(mockCacheRepository.delete).toHaveBeenCalledWith(`profile:statistics:${TEST_USER_ID}`);
      expect(mockCacheRepository.delete).toHaveBeenCalledWith(`profile:dashboard:${TEST_USER_ID}`);

      // Step 3: Fetch profile again (should fetch from database, not cache)
      mockDb.mockReturnValueOnce(Promise.resolve([
        {
          user_id: TEST_USER_ID,
          bio: 'Updated bio',
          testimony: 'Updated testimony',
          profile_photo_media_id: null,
          privacy_mode: 'church_only',
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: {},
          preferred_devotional_time: null,
          created_at: originalProfile.createdAt,
          updated_at: updatedProfile.updatedAt,
        }
      ]));

      const freshProfile = await service.getProfile(TEST_USER_ID, TEST_USER_ID);

      expect(freshProfile).toBeDefined();
      expect(freshProfile?.bio).toBe('Updated bio');
      expect(freshProfile?.testimony).toBe('Updated testimony');

      // Verify fresh data was written back to cache
      expect(mockCacheRepository.write).toHaveBeenCalledWith(
        `profile:${TEST_USER_ID}`,
        expect.objectContaining({
          bio: 'Updated bio',
          testimony: 'Updated testimony',
        }),
        300 // 5 minutes TTL
      );
    });
  });

  describe('Test 3: Statistics Caching TTL Behavior', () => {
    it('should respect 5-minute TTL for cached statistics', async () => {
      // Test cached statistics that are fresh (< 5 minutes old)
      const freshCachedMetrics = {
        notesCount: 10,
        prayersCount: 5,
        devotionalsCount: 3,
        daysActive: 15,
        lastCalculated: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      };

      mockDb.mockReturnValueOnce(Promise.resolve([{ cached_metrics: freshCachedMetrics }]));

      const result1 = await service.getStatistics(TEST_USER_ID);

      expect(result1.notesCount).toBe(10);
      expect(result1.prayersCount).toBe(5);
      expect(result1.devotionalsCount).toBe(3);

      // Cached metrics should be used, no new calculation
      // Verify only getCachedMetrics was called, no aggregation queries
      expect(mockDb).toHaveBeenCalledTimes(1);

      // Test cached statistics that are expired (> 5 minutes old)
      const expiredCachedMetrics = {
        notesCount: 10,
        prayersCount: 5,
        devotionalsCount: 3,
        daysActive: 15,
        lastCalculated: new Date(Date.now() - 400000).toISOString(), // 6+ minutes ago
      };

      mockDb.mockReturnValueOnce(Promise.resolve([{ cached_metrics: expiredCachedMetrics }]));

      // Mock fresh statistics calculation
      mockDb.mockReturnValueOnce(Promise.resolve([{ count: '12' }])); // notes count
      mockDb.mockReturnValueOnce(Promise.resolve([{ count: '7' }])); // prayers count
      mockDb.mockReturnValueOnce(Promise.resolve([{ count: '4' }])); // devotionals count

      // Mock updateCachedMetrics
      mockTx.mockReturnValueOnce(Promise.resolve([
        {
          user_id: TEST_USER_ID,
          bio: 'My bio',
          testimony: 'My testimony',
          profile_photo_media_id: null,
          privacy_mode: 'church_only',
          field_visibility_settings: {},
          cached_metrics: {
            notesCount: 12,
            prayersCount: 7,
            devotionalsCount: 4,
            daysActive: 16,
            lastCalculated: new Date().toISOString(),
          },
          notification_preferences: {},
          preferred_devotional_time: null,
          created_at: new Date(),
          updated_at: new Date(),
        }
      ]));

      const result2 = await service.getStatistics(TEST_USER_ID);

      // Fresh statistics should be calculated and returned
      expect(result2.notesCount).toBe(12);
      expect(result2.prayersCount).toBe(7);
      expect(result2.devotionalsCount).toBe(4);
    });
  });

  describe('Test 4: Schema Validation Edge Cases', () => {
    it('should validate CreateProfileSchema with all field combinations', async () => {
      // Test minimal valid profile
      const minimalInput: CreateProfileInput = {
        bio: 'My bio',
        privacyMode: 'church_only',
      };

      mockTx.mockReturnValueOnce(Promise.resolve([
        {
          user_id: TEST_USER_ID,
          bio: 'My bio',
          testimony: null,
          profile_photo_media_id: null,
          privacy_mode: 'church_only',
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: {},
          preferred_devotional_time: null,
          created_at: new Date(),
          updated_at: new Date(),
        }
      ]));

      const result1 = await service.createProfile(TEST_USER_ID, minimalInput);
      expect(result1).toBeDefined();
      expect(result1.bio).toBe('My bio');

      // Test maximal valid profile
      const maximalInput: CreateProfileInput = {
        bio: 'My bio',
        testimony: 'My testimony',
        privacyMode: 'private',
        profilePhotoMediaId: TEST_MEDIA_ID,
        notificationPreferences: {
          emailEnabled: true,
          pushEnabled: false,
        },
        preferredDevotionalTime: '08:00:00',
      };

      mockTx.mockReturnValueOnce(Promise.resolve([
        {
          user_id: TEST_USER_ID,
          bio: maximalInput.bio,
          testimony: maximalInput.testimony,
          profile_photo_media_id: maximalInput.profilePhotoMediaId,
          privacy_mode: maximalInput.privacyMode,
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: maximalInput.notificationPreferences,
          preferred_devotional_time: maximalInput.preferredDevotionalTime,
          created_at: new Date(),
          updated_at: new Date(),
        }
      ]));

      const result2 = await service.createProfile(TEST_USER_ID, maximalInput);
      expect(result2).toBeDefined();
      expect(result2.profilePhotoMediaId).toBe(TEST_MEDIA_ID);
      expect(result2.preferredDevotionalTime).toBe('08:00:00');
    });

    it('should validate UpdateProfileSchema with partial updates', async () => {
      // Test partial update (only bio)
      const partialUpdate: UpdateProfileInput = {
        bio: 'Updated bio only',
      };

      mockTx.unsafe.mockResolvedValueOnce([
        {
          user_id: TEST_USER_ID,
          bio: 'Updated bio only',
          testimony: 'Original testimony',
          profile_photo_media_id: null,
          privacy_mode: 'church_only',
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: {},
          preferred_devotional_time: null,
          created_at: new Date(),
          updated_at: new Date(),
        }
      ]);

      const result = await service.updateProfile(TEST_USER_ID, TEST_USER_ID, partialUpdate);
      expect(result).toBeDefined();
      expect(result?.bio).toBe('Updated bio only');
    });

    it('should reject invalid inputs via schema validation', () => {
      // Test invalid privacyMode
      expect(() => {
        CreateProfileInput.parse({
          bio: 'Valid bio',
          privacyMode: 'invalid_mode',
        });
      }).toThrow();

      // Test invalid preferredDevotionalTime format (not HH:MM:SS)
      expect(() => {
        CreateProfileInput.parse({
          bio: 'Valid bio',
          preferredDevotionalTime: 'invalid',
        });
      }).toThrow();

      // Test invalid preferredDevotionalTime format (missing colons)
      expect(() => {
        CreateProfileInput.parse({
          bio: 'Valid bio',
          preferredDevotionalTime: '080000',
        });
      }).toThrow();

      // Test invalid profilePhotoMediaId (not UUID)
      expect(() => {
        CreateProfileInput.parse({
          bio: 'Valid bio',
          profilePhotoMediaId: 'not-a-uuid',
        });
      }).toThrow();

      // Test bio exceeding max length (5000 characters)
      expect(() => {
        CreateProfileInput.parse({
          bio: 'x'.repeat(5001),
        });
      }).toThrow();

      // Test testimony exceeding max length (5000 characters)
      expect(() => {
        UpdateProfileInput.parse({
          testimony: 'x'.repeat(5001),
        });
      }).toThrow();
    });
  });

  describe('Test 5: Profile with Media Foreign Key Relationship', () => {
    it('should handle profile with valid media reference', async () => {
      const inputWithMedia: CreateProfileInput = {
        bio: 'My bio',
        testimony: 'My testimony',
        privacyMode: 'public',
        profilePhotoMediaId: TEST_MEDIA_ID,
      };

      mockTx.mockReturnValueOnce(Promise.resolve([
        {
          user_id: TEST_USER_ID,
          bio: inputWithMedia.bio,
          testimony: inputWithMedia.testimony,
          profile_photo_media_id: TEST_MEDIA_ID,
          privacy_mode: 'public',
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: {},
          preferred_devotional_time: null,
          created_at: new Date(),
          updated_at: new Date(),
        }
      ]));

      const result = await service.createProfile(TEST_USER_ID, inputWithMedia);

      expect(result).toBeDefined();
      expect(result.profilePhotoMediaId).toBe(TEST_MEDIA_ID);
    });

    it('should allow null profile photo media reference', async () => {
      const inputWithoutMedia: CreateProfileInput = {
        bio: 'My bio',
        privacyMode: 'church_only',
      };

      mockTx.mockReturnValueOnce(Promise.resolve([
        {
          user_id: TEST_USER_ID,
          bio: inputWithoutMedia.bio,
          testimony: null,
          profile_photo_media_id: null,
          privacy_mode: 'church_only',
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: {},
          preferred_devotional_time: null,
          created_at: new Date(),
          updated_at: new Date(),
        }
      ]));

      const result = await service.createProfile(TEST_USER_ID, inputWithoutMedia);

      expect(result).toBeDefined();
      expect(result.profilePhotoMediaId).toBeNull();
    });
  });

  describe('Test 6: Privacy Mode "church_only" Default Behavior', () => {
    it('should use "church_only" as default privacy mode when not specified', async () => {
      const input = {
        bio: 'My bio',
        // privacyMode not specified, should default to 'church_only'
      } as any as CreateProfileInput;

      mockTx.mockReturnValueOnce(Promise.resolve([
        {
          user_id: TEST_USER_ID,
          bio: input.bio,
          testimony: null,
          profile_photo_media_id: null,
          privacy_mode: 'church_only', // Database default
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: {},
          preferred_devotional_time: null,
          created_at: new Date(),
          updated_at: new Date(),
        }
      ]));

      const result = await service.createProfile(TEST_USER_ID, input);

      expect(result).toBeDefined();
      expect(result.privacyMode).toBe('church_only');
    });

    it('should deny access to church_only profile when users do not share a church', async () => {
      const mockPrivateProfile = {
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
      mockDb.mockReturnValueOnce(Promise.resolve([mockPrivateProfile]));

      // Mock church membership query - NO shared churches
      mockDb.mockReturnValueOnce(Promise.resolve([]));

      // A different user trying to access 'church_only' profile without shared church
      const result = await repository.findById(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      // Access should be denied
      expect(result).toBeNull();
    });

    it('should allow access to church_only profile when users share a church', async () => {
      const mockPrivateProfile = {
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
      mockDb.mockReturnValueOnce(Promise.resolve([mockPrivateProfile]));

      // Mock church membership query - SHARED church
      mockDb.mockReturnValueOnce(Promise.resolve([{ church_id: 'shared-church-123' }]));

      // A different user trying to access 'church_only' profile with shared church
      const result = await repository.findById(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      // Access should be granted
      expect(result).toBeDefined();
      expect(result?.userId).toBe(TEST_USER_ID);
      expect(result?.bio).toBe('My bio');
    });
  });
});
