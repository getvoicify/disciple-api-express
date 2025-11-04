import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileService } from '../../profiles/service';
import { ProfileServiceImpl } from '../../profiles/service';
import type { ProfileRepository } from '../../profiles/repository';
import type { CreateProfileInput, UpdateProfileInput, Profile, ProfileStatistics } from '../../profiles/schemas';
import { ProfileNotFoundError, ProfileUnauthorizedError } from '../../profiles/errors';
import type { KeycloakAdminClient } from '../../keycloak/types';
import type { CacheRepository } from '../../cache/cache.repository';
import type { RawDb } from '../../utils/database';

// Mock repository
const createMockRepository = () => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
  getStatistics: vi.fn(),
  getCachedMetrics: vi.fn(),
  updateCachedMetrics: vi.fn(),
});

// Mock Keycloak admin client
const createMockKeycloakAdminClient = () => ({
  getUserAttributes: vi.fn(),
  updateUserAttributes: vi.fn(),
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  getResourcesByIds: vi.fn(),
  getUserPermissions: vi.fn(),
});

// Mock cache repository
const createMockCacheRepository = () => ({
  write: vi.fn(),
  read: vi.fn(),
  delete: vi.fn(),
  deletePattern: vi.fn(),
  deleteByPrefix: vi.fn(),
  ping: vi.fn(),
  disconnect: vi.fn(),
});

// Mock database
const createMockDb = () => ({
  begin: vi.fn(),
  query: vi.fn(),
});

describe('ProfileService', () => {
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockKeycloakClient: ReturnType<typeof createMockKeycloakAdminClient>;
  let mockCacheRepository: ReturnType<typeof createMockCacheRepository>;
  let mockDb: ReturnType<typeof createMockDb>;
  let service: ProfileService;

  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
  const TEST_REQUESTING_USER_ID = '550e8400-e29b-41d4-a716-446655440002';

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockKeycloakClient = createMockKeycloakAdminClient();
    mockCacheRepository = createMockCacheRepository();
    mockDb = createMockDb();

    service = new ProfileServiceImpl(
      mockRepository as unknown as ProfileRepository,
      mockKeycloakClient as unknown as KeycloakAdminClient,
      mockCacheRepository as unknown as CacheRepository,
      mockDb as unknown as RawDb
    );
  });

  describe('createProfile', () => {
    it('should create profile with Keycloak data sync', async () => {
      const input: CreateProfileInput = {
        bio: 'Test bio',
        testimony: 'Test testimony',
        privacyMode: 'church_only',
      };

      const mockKeycloakAttributes = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      };

      const mockProfile: Profile = {
        userId: TEST_USER_ID,
        bio: input.bio,
        testimony: input.testimony,
        profilePhotoMediaId: null,
        privacyMode: 'church_only',
        fieldVisibilitySettings: {},
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockKeycloakClient.getUserAttributes.mockResolvedValue(mockKeycloakAttributes);
      mockRepository.create.mockResolvedValue(mockProfile);

      const result = await service.createProfile(TEST_USER_ID, input);

      expect(mockKeycloakClient.getUserAttributes).toHaveBeenCalledWith(TEST_USER_ID);
      // Zod adds default values, so we need to match the validated input
      expect(mockRepository.create).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          bio: 'Test bio',
          testimony: 'Test testimony',
          privacyMode: 'church_only',
        })
      );
      expect(result).toEqual(mockProfile);
    });

    it('should create profile even if Keycloak sync fails', async () => {
      const input: CreateProfileInput = {
        bio: 'Test bio',
        privacyMode: 'church_only',
      };

      const mockProfile: Profile = {
        userId: TEST_USER_ID,
        bio: input.bio,
        testimony: null,
        profilePhotoMediaId: null,
        privacyMode: 'church_only',
        fieldVisibilitySettings: {},
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Simulate Keycloak failure
      mockKeycloakClient.getUserAttributes.mockRejectedValue(new Error('Keycloak error'));
      mockRepository.create.mockResolvedValue(mockProfile);

      const result = await service.createProfile(TEST_USER_ID, input);

      expect(mockRepository.create).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          bio: 'Test bio',
          privacyMode: 'church_only',
        })
      );
      expect(result).toEqual(mockProfile);
    });
  });

  describe('updateProfile', () => {
    it('should throw ProfileUnauthorizedError when requestingUserId !== userId', async () => {
      const input: UpdateProfileInput = {
        bio: 'Updated bio',
        testimony: 'Updated testimony',
      };

      await expect(
        service.updateProfile(TEST_USER_ID, TEST_REQUESTING_USER_ID, input)
      ).rejects.toThrow(ProfileUnauthorizedError);

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should allow update when requestingUserId === userId', async () => {
      const input: UpdateProfileInput = {
        bio: 'Updated bio',
        testimony: 'Updated testimony',
      };

      const mockUpdatedProfile: Profile = {
        userId: TEST_USER_ID,
        bio: input.bio,
        testimony: input.testimony,
        profilePhotoMediaId: null,
        privacyMode: 'church_only',
        fieldVisibilitySettings: {},
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };

      mockRepository.update.mockResolvedValue(mockUpdatedProfile);

      const result = await service.updateProfile(TEST_USER_ID, TEST_USER_ID, input);

      expect(mockRepository.update).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          bio: 'Updated bio',
          testimony: 'Updated testimony',
        })
      );
      expect(mockCacheRepository.delete).toHaveBeenCalledWith(`profile:${TEST_USER_ID}`);
      expect(mockCacheRepository.delete).toHaveBeenCalledWith(`profile:statistics:${TEST_USER_ID}`);
      expect(mockCacheRepository.delete).toHaveBeenCalledWith(`profile:dashboard:${TEST_USER_ID}`);
      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should throw ProfileNotFoundError when profile does not exist', async () => {
      const input: UpdateProfileInput = {
        bio: 'Updated bio',
      };

      mockRepository.update.mockResolvedValue(null);

      await expect(service.updateProfile(TEST_USER_ID, TEST_USER_ID, input)).rejects.toThrow(
        ProfileNotFoundError
      );
    });
  });

  describe('getProfile', () => {
    it('should return cached profile if available', async () => {
      const mockProfile: Profile = {
        userId: TEST_USER_ID,
        bio: 'Test bio',
        testimony: 'Test testimony',
        profilePhotoMediaId: null,
        privacyMode: 'church_only',
        fieldVisibilitySettings: {},
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCacheRepository.read.mockResolvedValue(mockProfile);

      const result = await service.getProfile(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(mockCacheRepository.read).toHaveBeenCalledWith(`profile:${TEST_USER_ID}`);
      expect(mockRepository.findById).not.toHaveBeenCalled();
      expect(result).toEqual(mockProfile);
    });

    it('should fetch from repository and cache when not in cache', async () => {
      const mockProfile: Profile = {
        userId: TEST_USER_ID,
        bio: 'Test bio',
        testimony: 'Test testimony',
        profilePhotoMediaId: null,
        privacyMode: 'church_only',
        fieldVisibilitySettings: {},
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCacheRepository.read.mockResolvedValue(null);
      mockRepository.findById.mockResolvedValue(mockProfile);

      const result = await service.getProfile(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(mockCacheRepository.read).toHaveBeenCalledWith(`profile:${TEST_USER_ID}`);
      expect(mockRepository.findById).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_REQUESTING_USER_ID
      );
      expect(mockCacheRepository.write).toHaveBeenCalledWith(
        `profile:${TEST_USER_ID}`,
        mockProfile,
        300 // 5 minutes TTL
      );
      expect(result).toEqual(mockProfile);
    });

    it('should throw ProfileNotFoundError when profile not found or access denied', async () => {
      mockCacheRepository.read.mockResolvedValue(null);
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.getProfile(TEST_USER_ID, TEST_REQUESTING_USER_ID)
      ).rejects.toThrow(ProfileNotFoundError);

      expect(mockRepository.findById).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_REQUESTING_USER_ID
      );
    });

  });

  describe('getStatistics', () => {
    it('should return cached statistics if fresh', async () => {
      const cachedMetrics = {
        notesCount: 10,
        prayersCount: 5,
        devotionalsCount: 3,
        daysActive: 15,
        lastCalculated: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      };

      mockRepository.getCachedMetrics.mockResolvedValue(cachedMetrics);

      const result = await service.getStatistics(TEST_USER_ID);

      expect(mockRepository.getCachedMetrics).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockRepository.getStatistics).not.toHaveBeenCalled();
      expect(result).toEqual({
        notesCount: 10,
        prayersCount: 5,
        devotionalsCount: 3,
        daysActive: 15,
      });
    });

    it('should calculate and cache statistics if cache expired', async () => {
      const oldCachedMetrics = {
        notesCount: 10,
        prayersCount: 5,
        devotionalsCount: 3,
        daysActive: 15,
        lastCalculated: new Date(Date.now() - 400000).toISOString(), // 6+ minutes ago
      };

      const freshStatistics: ProfileStatistics = {
        notesCount: 12,
        prayersCount: 7,
        devotionalsCount: 4,
        daysActive: 16,
      };

      mockRepository.getCachedMetrics.mockResolvedValue(oldCachedMetrics);
      mockRepository.getStatistics.mockResolvedValue(freshStatistics);
      mockRepository.updateCachedMetrics.mockResolvedValue({} as Profile);

      const result = await service.getStatistics(TEST_USER_ID);

      expect(mockRepository.getStatistics).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockRepository.updateCachedMetrics).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          notesCount: 12,
          prayersCount: 7,
          devotionalsCount: 4,
          daysActive: 16,
        })
      );
      expect(result).toEqual(freshStatistics);
    });

    it('should calculate statistics if no cached metrics exist', async () => {
      const freshStatistics: ProfileStatistics = {
        notesCount: 5,
        prayersCount: 3,
        devotionalsCount: 2,
      };

      mockRepository.getCachedMetrics.mockResolvedValue(null);
      mockRepository.getStatistics.mockResolvedValue(freshStatistics);
      mockRepository.updateCachedMetrics.mockResolvedValue({} as Profile);

      const result = await service.getStatistics(TEST_USER_ID);

      expect(mockRepository.getStatistics).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockRepository.updateCachedMetrics).toHaveBeenCalled();
      expect(result).toEqual(freshStatistics);
    });
  });

  describe('getDashboard', () => {
    it('should throw ProfileUnauthorizedError when requestingUserId !== userId', async () => {
      await expect(
        service.getDashboard(TEST_USER_ID, TEST_REQUESTING_USER_ID)
      ).rejects.toThrow(ProfileUnauthorizedError);

      expect(mockCacheRepository.read).not.toHaveBeenCalled();
      expect(mockDb.begin).not.toHaveBeenCalled();
    });

    it('should allow access when requestingUserId === userId', async () => {
      const mockDashboard = {
        recentNotes: [],
        activePrayerRequests: [],
        devotionalProgress: [],
        statistics: {
          notesCount: 10,
          prayersCount: 5,
          devotionalsCount: 3,
        },
      };

      mockCacheRepository.read.mockResolvedValue(mockDashboard);

      const result = await service.getDashboard(TEST_USER_ID, TEST_USER_ID);

      expect(mockCacheRepository.read).toHaveBeenCalledWith(`profile:dashboard:${TEST_USER_ID}`);
      expect(mockDb.begin).not.toHaveBeenCalled();
      expect(result).toEqual(mockDashboard);
    });

    it('should return cached dashboard if available', async () => {
      const mockDashboard = {
        recentNotes: [],
        activePrayerRequests: [],
        devotionalProgress: [],
        statistics: {
          notesCount: 10,
          prayersCount: 5,
          devotionalsCount: 3,
        },
      };

      mockCacheRepository.read.mockResolvedValue(mockDashboard);

      const result = await service.getDashboard(TEST_USER_ID, TEST_USER_ID);

      expect(mockCacheRepository.read).toHaveBeenCalledWith(`profile:dashboard:${TEST_USER_ID}`);
      expect(mockDb.begin).not.toHaveBeenCalled();
      expect(result).toEqual(mockDashboard);
    });

    it('should aggregate dashboard data from multiple sources when not cached', async () => {
      const mockRecentNotes = [
        {
          id: 'note-1',
          title: 'Note 1',
          content: 'Content 1',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const mockActivePrayers = [
        {
          id: 'prayer-1',
          title: 'Prayer 1',
          description: 'Description 1',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const mockDevotionals = [
        {
          post_id: 'devotional-1',
          post_title: 'Devotional 1',
          published_at: new Date(),
          series_id: 'series-1',
          series_name: 'Series 1',
        },
      ];

      const mockStatistics: ProfileStatistics = {
        notesCount: 10,
        prayersCount: 5,
        devotionalsCount: 3,
      };

      mockCacheRepository.read.mockResolvedValue(null);

      // Mock the database transaction with proper template literal support
      mockDb.begin.mockImplementation(async (callback: any) => {
        const mockTx = function(strings: any, ...values: any) {
          const query = strings.join('');
          if (query.includes('FROM notes')) {
            return Promise.resolve(mockRecentNotes);
          }
          if (query.includes('FROM prayer_requests')) {
            return Promise.resolve(mockActivePrayers);
          }
          if (query.includes('FROM posts')) {
            return Promise.resolve(mockDevotionals);
          }
          return Promise.resolve([]);
        };

        // Make mockTx callable as a tagged template function
        Object.assign(mockTx, { raw: [] });

        return callback(mockTx);
      });

      mockRepository.getStatistics.mockResolvedValue(mockStatistics);

      const result = await service.getDashboard(TEST_USER_ID, TEST_USER_ID);

      expect(mockDb.begin).toHaveBeenCalled();
      expect(mockRepository.getStatistics).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockCacheRepository.write).toHaveBeenCalledWith(
        `profile:dashboard:${TEST_USER_ID}`,
        expect.any(Object),
        300 // 5 minutes TTL
      );
      expect(result).toHaveProperty('statistics');
      expect(result.statistics).toEqual(mockStatistics);
    });
  });
});
