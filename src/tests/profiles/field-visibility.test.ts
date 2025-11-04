import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileServiceImpl } from '../../profiles/service';
import type { ProfileRepository } from '../../profiles/repository';
import type { Profile } from '../../profiles/schemas';
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

/**
 * TDD Tests for Field-Level Visibility Enforcement (Gap 1)
 *
 * These tests define the expected behavior for field-level visibility.
 * They will FAIL until the implementation is complete.
 */
describe('Field-Level Visibility Enforcement', () => {
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockKeycloakClient: ReturnType<typeof createMockKeycloakAdminClient>;
  let mockCacheRepository: ReturnType<typeof createMockCacheRepository>;
  let mockDb: ReturnType<typeof createMockDb>;
  let service: ProfileServiceImpl;

  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
  const TEST_REQUESTING_USER_ID = '550e8400-e29b-41d4-a716-446655440002';

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockKeycloakClient = createMockKeycloakAdminClient();
    mockCacheRepository = createMockCacheRepository();
    mockDb = createMockDb();

    // Always return null from cache to test repository logic
    mockCacheRepository.read.mockResolvedValue(null);

    service = new ProfileServiceImpl(
      mockRepository as unknown as ProfileRepository,
      mockKeycloakClient as unknown as KeycloakAdminClient,
      mockCacheRepository as unknown as CacheRepository,
      mockDb as unknown as RawDb
    );
  });

  describe('Test 1: Hide testimony field when visibility set to false', () => {
    it('should hide testimony field from other users when fieldVisibilitySettings.testimony = false', async () => {
      const mockProfile: Profile = {
        userId: TEST_USER_ID,
        bio: 'My public bio',
        testimony: 'My private testimony',
        profilePhotoMediaId: null,
        privacyMode: 'public',
        fieldVisibilitySettings: {
          testimony: false, // Hide testimony from others
        },
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockProfile);

      const result = await service.getProfile(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(result).toBeDefined();
      expect(result?.bio).toBe('My public bio'); // bio should be visible
      expect(result?.testimony).toBeNull(); // testimony should be hidden
    });
  });

  describe('Test 2: Show all fields to profile owner', () => {
    it('should show all fields including hidden ones when user views own profile', async () => {
      const mockProfile: Profile = {
        userId: TEST_USER_ID,
        bio: 'My public bio',
        testimony: 'My private testimony',
        profilePhotoMediaId: null,
        privacyMode: 'public',
        fieldVisibilitySettings: {
          testimony: false,
          bio: false,
        },
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockProfile);

      // User viewing their own profile
      const result = await service.getProfile(TEST_USER_ID, TEST_USER_ID);

      expect(result).toBeDefined();
      expect(result?.bio).toBe('My public bio'); // Should see own bio
      expect(result?.testimony).toBe('My private testimony'); // Should see own testimony
    });
  });

  describe('Test 3: Hide multiple fields based on settings', () => {
    it('should hide multiple fields when multiple visibility settings are false', async () => {
      const mockProfile: Profile = {
        userId: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profilePhotoMediaId: '550e8400-e29b-41d4-a716-446655440003',
        privacyMode: 'public',
        fieldVisibilitySettings: {
          bio: false,
          testimony: false,
          profilePhotoMediaId: false,
        },
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: '08:00:00',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockProfile);

      const result = await service.getProfile(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(result).toBeDefined();
      expect(result?.bio).toBeNull(); // Hidden
      expect(result?.testimony).toBeNull(); // Hidden
      expect(result?.profilePhotoMediaId).toBeNull(); // Hidden
      expect(result?.preferredDevotionalTime).toBe('08:00:00'); // Visible (not in settings)
    });
  });

  describe('Test 4: Show fields when visibility set to true', () => {
    it('should show fields when fieldVisibilitySettings explicitly set to true', async () => {
      const mockProfile: Profile = {
        userId: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profilePhotoMediaId: null,
        privacyMode: 'public',
        fieldVisibilitySettings: {
          bio: true, // Explicitly visible
          testimony: false, // Hidden
        },
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockProfile);

      const result = await service.getProfile(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(result).toBeDefined();
      expect(result?.bio).toBe('My bio'); // Visible
      expect(result?.testimony).toBeNull(); // Hidden
    });
  });

  describe('Test 5: No visibility settings means all fields visible', () => {
    it('should show all fields when fieldVisibilitySettings is empty', async () => {
      const mockProfile: Profile = {
        userId: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profilePhotoMediaId: null,
        privacyMode: 'public',
        fieldVisibilitySettings: {}, // Empty settings
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockProfile);

      const result = await service.getProfile(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(result).toBeDefined();
      expect(result?.bio).toBe('My bio'); // All fields visible
      expect(result?.testimony).toBe('My testimony');
    });
  });

  describe('Test 6: Cached profile respects field visibility', () => {
    it('should apply field visibility to cached profiles', async () => {
      const mockProfile: Profile = {
        userId: TEST_USER_ID,
        bio: 'My bio',
        testimony: 'My testimony',
        profilePhotoMediaId: null,
        privacyMode: 'public',
        fieldVisibilitySettings: {
          testimony: false,
        },
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Return profile from cache
      mockCacheRepository.read.mockResolvedValue(mockProfile);

      const result = await service.getProfile(TEST_USER_ID, TEST_REQUESTING_USER_ID);

      expect(result).toBeDefined();
      expect(result?.bio).toBe('My bio');
      expect(result?.testimony).toBeNull(); // Should be hidden even from cache
    });
  });
});
