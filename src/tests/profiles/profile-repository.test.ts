import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PostgresProfileRepository } from '../../profiles/pg-repository';
import type { RawDb } from '../../utils/database';
import type { CreateProfileInput, UpdateProfileInput } from '../../profiles/schemas';

describe('PostgresProfileRepository', () => {
  let repository: PostgresProfileRepository;
  let mockDb: any;
  let mockTx: any;

  beforeEach(() => {
    // Create template function for SQL queries (for mockTx)
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

    // Mock database client with template function behavior
    const dbTemplateFn = vi.fn((strings: TemplateStringsArray, ...values: any[]) => {
      return Promise.resolve([]);
    });

    mockDb = Object.assign(dbTemplateFn, {
      begin: vi.fn((callback) => callback(mockTx)),
      unsafe: vi.fn().mockResolvedValue([]),
    });

    repository = new PostgresProfileRepository(mockDb as unknown as RawDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new profile with basic fields', async () => {
      const userId = crypto.randomUUID();
      const input: CreateProfileInput = {
        bio: 'My bio',
        testimony: 'My testimony',
        privacyMode: 'church_only',
      };

      const mockProfile = {
        user_id: userId,
        bio: input.bio,
        testimony: input.testimony,
        profile_photo_media_id: null,
        privacy_mode: input.privacyMode,
        field_visibility_settings: {},
        cached_metrics: {},
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTx.mockReturnValueOnce(Promise.resolve([mockProfile]));

      const result = await repository.create(userId, input);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.bio).toBe(input.bio);
      expect(result.testimony).toBe(input.testimony);
    });

    it('should create a profile with optional fields', async () => {
      const userId = crypto.randomUUID();
      const mediaId = crypto.randomUUID();
      const input: CreateProfileInput = {
        bio: 'My bio',
        testimony: 'My testimony',
        privacyMode: 'private',
        profilePhotoMediaId: mediaId,
        fieldVisibilitySettings: { prayerCount: false },
        notificationPreferences: { emailEnabled: true },
        preferredDevotionalTime: '08:00:00',
      };

      const mockProfile = {
        user_id: userId,
        bio: input.bio,
        testimony: input.testimony,
        profile_photo_media_id: mediaId,
        privacy_mode: input.privacyMode,
        field_visibility_settings: input.fieldVisibilitySettings,
        cached_metrics: {},
        notification_preferences: input.notificationPreferences,
        preferred_devotional_time: input.preferredDevotionalTime,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTx.mockReturnValueOnce(Promise.resolve([mockProfile]));

      const result = await repository.create(userId, input);

      expect(result.profilePhotoMediaId).toBe(mediaId);
      expect(result.privacyMode).toBe('private');
      expect(result.fieldVisibilitySettings).toEqual({ prayerCount: false });
    });
  });

  describe('findById', () => {
    it('should return null when profile does not exist', async () => {
      mockDb.mockReturnValueOnce(Promise.resolve([]));

      const result = await repository.findById(crypto.randomUUID(), crypto.randomUUID());

      expect(result).toBeNull();
    });

    it('should return profile when requesting own profile', async () => {
      const userId = crypto.randomUUID();
      const mockProfile = {
        user_id: userId,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: null,
        privacy_mode: 'private',
        field_visibility_settings: {},
        cached_metrics: { notesCount: 5 },
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      const result = await repository.findById(userId, userId);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(userId);
      expect(result?.bio).toBe('My bio');
    });

    it('should return null when privacy is private and requester is different user', async () => {
      const userId = crypto.randomUUID();
      const requesterId = crypto.randomUUID();
      const mockProfile = {
        user_id: userId,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: null,
        privacy_mode: 'private',
        field_visibility_settings: {},
        cached_metrics: {},
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      const result = await repository.findById(userId, requesterId);

      expect(result).toBeNull();
    });

    it('should return profile when privacy is public', async () => {
      const userId = crypto.randomUUID();
      const requesterId = crypto.randomUUID();
      const mockProfile = {
        user_id: userId,
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

      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      const result = await repository.findById(userId, requesterId);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(userId);
    });

    it('should allow pastor to view private profiles', async () => {
      const userId = crypto.randomUUID();
      const requesterId = crypto.randomUUID();
      const mockProfile = {
        user_id: userId,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: null,
        privacy_mode: 'private',
        field_visibility_settings: {},
        cached_metrics: {},
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockReturnValueOnce(Promise.resolve([mockProfile]));

      const result = await repository.findById(userId, requesterId, 'pastor');

      expect(result).toBeDefined();
      expect(result?.userId).toBe(userId);
    });
  });

  describe('update', () => {
    it('should update profile fields', async () => {
      const userId = crypto.randomUUID();
      const input: UpdateProfileInput = {
        bio: 'Updated bio',
        testimony: 'Updated testimony',
      };

      const mockProfile = {
        user_id: userId,
        bio: input.bio,
        testimony: input.testimony,
        profile_photo_media_id: null,
        privacy_mode: 'church_only',
        field_visibility_settings: {},
        cached_metrics: {},
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTx.unsafe.mockResolvedValueOnce([mockProfile]);

      const result = await repository.update(userId, input);

      expect(result).toBeDefined();
      expect(result?.bio).toBe('Updated bio');
      expect(result?.testimony).toBe('Updated testimony');
    });

    it('should return null when profile does not exist', async () => {
      const userId = crypto.randomUUID();
      const input: UpdateProfileInput = {
        bio: 'Updated bio',
      };

      mockTx.unsafe.mockResolvedValueOnce([]);

      const result = await repository.update(userId, input);

      expect(result).toBeNull();
    });
  });

  describe('getStatistics', () => {
    it('should aggregate statistics from multiple tables', async () => {
      const userId = crypto.randomUUID();

      // Mock notes count query
      mockDb.mockReturnValueOnce(Promise.resolve([{ count: '10' }]));
      // Mock prayers count query
      mockDb.mockReturnValueOnce(Promise.resolve([{ count: '5' }]));
      // Mock devotionals count query (posts)
      mockDb.mockReturnValueOnce(Promise.resolve([{ count: '3' }]));

      const result = await repository.getStatistics(userId);

      expect(result).toBeDefined();
      expect(result.notesCount).toBe(10);
      expect(result.prayersCount).toBe(5);
      expect(result.devotionalsCount).toBe(3);
    });

    it('should return zero counts when user has no activity', async () => {
      const userId = crypto.randomUUID();

      // Mock empty results
      mockDb.mockReturnValueOnce(Promise.resolve([{ count: '0' }]));
      mockDb.mockReturnValueOnce(Promise.resolve([{ count: '0' }]));
      mockDb.mockReturnValueOnce(Promise.resolve([{ count: '0' }]));

      const result = await repository.getStatistics(userId);

      expect(result.notesCount).toBe(0);
      expect(result.prayersCount).toBe(0);
      expect(result.devotionalsCount).toBe(0);
    });
  });

  describe('getCachedMetrics', () => {
    it('should return cached metrics from profile', async () => {
      const userId = crypto.randomUUID();
      const metrics = {
        notesCount: 15,
        prayersCount: 8,
        devotionalsCount: 4,
        lastCalculated: new Date().toISOString(),
      };

      mockDb.mockReturnValueOnce(Promise.resolve([{ cached_metrics: metrics }]));

      const result = await repository.getCachedMetrics(userId);

      expect(result).toEqual(metrics);
    });

    it('should return null when profile does not exist', async () => {
      mockDb.mockReturnValueOnce(Promise.resolve([]));

      const result = await repository.getCachedMetrics(crypto.randomUUID());

      expect(result).toBeNull();
    });
  });

  describe('updateCachedMetrics', () => {
    it('should store cached metrics in profile', async () => {
      const userId = crypto.randomUUID();
      const metrics = {
        notesCount: 15,
        prayersCount: 8,
        devotionalsCount: 4,
        lastCalculated: new Date().toISOString(),
      };

      const mockProfile = {
        user_id: userId,
        bio: 'My bio',
        testimony: 'My testimony',
        profile_photo_media_id: null,
        privacy_mode: 'church_only',
        field_visibility_settings: {},
        cached_metrics: metrics,
        notification_preferences: {},
        preferred_devotional_time: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTx.mockReturnValueOnce(Promise.resolve([mockProfile]));

      const result = await repository.updateCachedMetrics(userId, metrics);

      expect(result).toBeDefined();
      expect(result?.cachedMetrics).toEqual(metrics);
    });
  });

  describe('findByIds', () => {
    it('should return empty array when no user IDs provided', async () => {
      const result = await repository.findByIds([]);

      expect(result).toEqual([]);
      expect(mockDb).not.toHaveBeenCalled();
    });

    it('should fetch multiple profiles by user IDs', async () => {
      const userId1 = crypto.randomUUID();
      const userId2 = crypto.randomUUID();

      const mockProfiles = [
        {
          user_id: userId1,
          bio: 'Bio 1',
          testimony: 'Testimony 1',
          profile_photo_media_id: null,
          privacy_mode: 'public',
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: {},
          preferred_devotional_time: null,
          first_name: 'John',
          last_name: 'Doe',
          display_name: 'John Doe',
          avatar_url: null,
          email: 'john@example.com',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          user_id: userId2,
          bio: 'Bio 2',
          testimony: 'Testimony 2',
          profile_photo_media_id: null,
          privacy_mode: 'church_only',
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: {},
          preferred_devotional_time: null,
          first_name: 'Jane',
          last_name: 'Smith',
          display_name: 'Jane Smith',
          avatar_url: 'https://example.com/avatar.jpg',
          email: 'jane@example.com',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.mockReturnValueOnce(Promise.resolve(mockProfiles));

      const result = await repository.findByIds([userId1, userId2]);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(userId1);
      expect(result[0].firstName).toBe('John');
      expect(result[1].userId).toBe(userId2);
      expect(result[1].firstName).toBe('Jane');
    });

    it('should return only found profiles when some IDs do not exist', async () => {
      const userId1 = crypto.randomUUID();
      const userId2 = crypto.randomUUID();
      const nonExistentUserId = crypto.randomUUID();

      const mockProfiles = [
        {
          user_id: userId1,
          bio: 'Bio 1',
          testimony: 'Testimony 1',
          profile_photo_media_id: null,
          privacy_mode: 'public',
          field_visibility_settings: {},
          cached_metrics: {},
          notification_preferences: {},
          preferred_devotional_time: null,
          first_name: 'John',
          last_name: 'Doe',
          display_name: 'John Doe',
          avatar_url: null,
          email: 'john@example.com',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.mockReturnValueOnce(Promise.resolve(mockProfiles));

      const result = await repository.findByIds([userId1, userId2, nonExistentUserId]);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(userId1);
    });

    it('should return empty array when no profiles found', async () => {
      mockDb.mockReturnValueOnce(Promise.resolve([]));

      const result = await repository.findByIds([crypto.randomUUID(), crypto.randomUUID()]);

      expect(result).toEqual([]);
    });
  });
});
