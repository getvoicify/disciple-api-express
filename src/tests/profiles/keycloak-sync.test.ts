import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileServiceImpl } from '../../profiles/service';
import type { ProfileRepository } from '../../profiles/repository';
import type {CreateProfileInput, Profile} from '../../profiles/schemas';
import type { KeycloakAdminClient } from '../../keycloak/types';
import type { CacheRepository } from '../../cache';
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
 * TDD Tests for Keycloak Claims Sync (Task Group 1)
 *
 * These tests verify that Keycloak claims are correctly extracted and stored
 * during profile creation.
 */
describe('Keycloak Claims Sync', () => {
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockKeycloakClient: ReturnType<typeof createMockKeycloakAdminClient>;
  let mockCacheRepository: ReturnType<typeof createMockCacheRepository>;
  let mockDb: ReturnType<typeof createMockDb>;
  let service: ProfileServiceImpl;

  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';

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

  describe('Test 1: Sync Keycloak claims to profile on creation', () => {
    it('should extract and store Keycloak claims (given_name, family_name, email) during profile creation', async () => {
      const keycloakClaims = {
        given_name: 'John',
        family_name: 'Doe',
        email: 'john.doe@example.com',
      };

      const profileInput = {
        bio: 'Test bio',
        privacyMode: 'public' as const,
      };

      const expectedProfile: Profile = {
        userId: TEST_USER_ID,
        bio: 'Test bio',
        testimony: null,
        profilePhotoMediaId: null,
        privacyMode: 'public',
        fieldVisibilitySettings: {},
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        email: 'john.doe@example.com',
        avatarUrl: null,
      } as any;

      mockRepository.create.mockResolvedValue(expectedProfile);

      const result = await service.createProfile(TEST_USER_ID, profileInput, keycloakClaims);

      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          bio: 'Test bio',
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John Doe',
          email: 'john.doe@example.com',
        })
      );
    });
  });

  describe('Test 2: Compute displayName from firstName and lastName', () => {
    it('should compute displayName as "firstName lastName"', async () => {
      const keycloakClaims = {
        given_name: 'Jane',
        family_name: 'Smith',
        email: 'jane.smith@example.com',
      };

      const profileInput = {
        privacyMode: 'church_only' as const,
      };

      mockRepository.create.mockResolvedValue({} as Profile);

      await service.createProfile(TEST_USER_ID, profileInput, keycloakClaims);

      expect(mockRepository.create).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          displayName: 'Jane Smith',
        })
      );
    });
  });

  describe('Test 3: Handle missing Keycloak claims gracefully', () => {
    it('should handle missing given_name and family_name by using empty strings', async () => {
      const keycloakClaims = {
        email: 'test@example.com',
      };

      const profileInput = {
        bio: 'Test bio',
      } as unknown as CreateProfileInput;

      mockRepository.create.mockResolvedValue({} as Profile);

      await service.createProfile(TEST_USER_ID, profileInput, keycloakClaims);

      expect(mockRepository.create).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          firstName: '',
          lastName: '',
          displayName: '',
          email: 'test@example.com',
        })
      );
    });
  });

  describe('Test 4: Handle missing email claim', () => {
    it('should handle missing email by setting it to null', async () => {
      const keycloakClaims = {
        given_name: 'Test',
        family_name: 'User',
      };

      const profileInput = {
        bio: 'Test bio',
      } as unknown as CreateProfileInput;

      mockRepository.create.mockResolvedValue({} as Profile);

      await service.createProfile(TEST_USER_ID, profileInput, keycloakClaims);

      expect(mockRepository.create).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          firstName: 'Test',
          lastName: 'User',
          displayName: 'Test User',
          email: null,
        })
      );
    });
  });

  describe('Test 5: Profile creation without Keycloak claims', () => {
    it('should allow profile creation without Keycloak claims (backwards compatibility)', async () => {
      const profileInput = {
        bio: 'Test bio',
      } as unknown as CreateProfileInput;

      const expectedProfile: Profile = {
        userId: TEST_USER_ID,
        bio: 'Test bio',
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

      mockRepository.create.mockResolvedValue(expectedProfile);

      const result = await service.createProfile(TEST_USER_ID, profileInput);

      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  describe('Test 6: Trim whitespace from names', () => {
    it('should trim whitespace from firstName and lastName', async () => {
      const keycloakClaims = {
        given_name: '  John  ',
        family_name: '  Doe  ',
        email: 'john@example.com',
      };

      const profileInput = {
        bio: 'Test bio',
      } as unknown as CreateProfileInput;

      mockRepository.create.mockResolvedValue({} as Profile);

      await service.createProfile(TEST_USER_ID, profileInput, keycloakClaims);

      expect(mockRepository.create).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John Doe',
        })
      );
    });
  });

  describe('Test 7: displayName with only firstName', () => {
    it('should handle displayName when only firstName is provided', async () => {
      const keycloakClaims = {
        given_name: 'Madonna',
        email: 'madonna@example.com',
      };

      const profileInput = {
        bio: 'Test bio',
      } as unknown as CreateProfileInput;

      mockRepository.create.mockResolvedValue({} as Profile);

      await service.createProfile(TEST_USER_ID, profileInput, keycloakClaims);

      expect(mockRepository.create).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          firstName: 'Madonna',
          lastName: '',
          displayName: 'Madonna',
        })
      );
    });
  });

  describe('Test 8: displayName with only lastName', () => {
    it('should handle displayName when only lastName is provided', async () => {
      const keycloakClaims = {
        family_name: 'Cher',
        email: 'cher@example.com',
      };

      const profileInput = {
        bio: 'Test bio',
      } as unknown as CreateProfileInput;

      mockRepository.create.mockResolvedValue({} as Profile);

      await service.createProfile(TEST_USER_ID, profileInput, keycloakClaims);

      expect(mockRepository.create).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          firstName: '',
          lastName: 'Cher',
          displayName: 'Cher',
        })
      );
    });
  });
});
