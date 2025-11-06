import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserInfoServiceImpl } from '../../user-info/user-info.service';
import type { ProfileRepository } from '../../profiles/repository';
import type { CacheRepository } from '../../cache/cache.repository';
import type { UserInfo } from '../../user-info/types';
import type { Profile } from '../../profiles/schemas';

const createMockProfileRepository = () => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
  findByIds: vi.fn(),
  getStatistics: vi.fn(),
  getCachedMetrics: vi.fn(),
  updateCachedMetrics: vi.fn(),
});

const createMockCacheRepository = () => ({
  write: vi.fn(),
  read: vi.fn(),
  delete: vi.fn(),
  deletePattern: vi.fn(),
  deleteByPrefix: vi.fn(),
  ping: vi.fn(),
  disconnect: vi.fn(),
});

describe('UserInfoService', () => {
  let mockProfileRepository: ReturnType<typeof createMockProfileRepository>;
  let mockCacheRepository: ReturnType<typeof createMockCacheRepository>;
  let service: UserInfoServiceImpl;

  const TEST_USER_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
  const TEST_USER_ID_2 = '550e8400-e29b-41d4-a716-446655440002';
  const REQUESTING_USER_ID = '550e8400-e29b-41d4-a716-446655440999';

  beforeEach(() => {
    mockProfileRepository = createMockProfileRepository();
    mockCacheRepository = createMockCacheRepository();

    service = new UserInfoServiceImpl(
      mockProfileRepository as unknown as ProfileRepository,
      mockCacheRepository as unknown as CacheRepository
    );
  });

  it('should fetch and return user info for all requested user IDs', async () => {
    const mockProfiles: Profile[] = [
      {
        userId: TEST_USER_ID_1,
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        avatarUrl: null,
        email: 'john@example.com',
        bio: null,
        testimony: null,
        profilePhotoMediaId: null,
        privacyMode: 'church_only',
        fieldVisibilitySettings: {},
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Profile,
      {
        userId: TEST_USER_ID_2,
        firstName: 'Jane',
        lastName: 'Smith',
        displayName: 'Jane Smith',
        avatarUrl: 'https://example.com/jane.jpg',
        email: 'jane@example.com',
        bio: null,
        testimony: null,
        profilePhotoMediaId: null,
        privacyMode: 'public',
        fieldVisibilitySettings: {},
        cachedMetrics: {},
        notificationPreferences: {},
        preferredDevotionalTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Profile,
    ];

    mockCacheRepository.read.mockResolvedValue(null);
    mockProfileRepository.findByIds.mockResolvedValue(mockProfiles);

    const result = await service.getBatchUserInfo([TEST_USER_ID_1, TEST_USER_ID_2], REQUESTING_USER_ID);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.get(TEST_USER_ID_1)).toEqual({
      userId: TEST_USER_ID_1,
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: null,
      email: 'john@example.com',
    });
    expect(mockProfileRepository.findByIds).toHaveBeenCalledWith([TEST_USER_ID_1, TEST_USER_ID_2]);
  });

  it('should return cached user info without querying database', async () => {
    const cachedUserInfo: UserInfo = {
      userId: TEST_USER_ID_1,
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: null,
      email: 'john@example.com',
    };

    mockCacheRepository.read.mockResolvedValue(cachedUserInfo);

    const result = await service.getBatchUserInfo([TEST_USER_ID_1], REQUESTING_USER_ID);

    expect(result.size).toBe(1);
    expect(result.get(TEST_USER_ID_1)).toEqual(cachedUserInfo);
    expect(mockProfileRepository.findByIds).not.toHaveBeenCalled();
  });

  it('should query database on cache miss and populate cache with 900s TTL', async () => {
    const mockProfile: Profile = {
      userId: TEST_USER_ID_1,
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: null,
      email: 'john@example.com',
      bio: null,
      testimony: null,
      profilePhotoMediaId: null,
      privacyMode: 'church_only',
      fieldVisibilitySettings: {},
      cachedMetrics: {},
      notificationPreferences: {},
      preferredDevotionalTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Profile;

    mockCacheRepository.read.mockResolvedValue(null);
    mockProfileRepository.findByIds.mockResolvedValue([mockProfile]);

    const result = await service.getBatchUserInfo([TEST_USER_ID_1], REQUESTING_USER_ID);

    expect(mockProfileRepository.findByIds).toHaveBeenCalledWith([TEST_USER_ID_1]);
    expect(mockCacheRepository.write).toHaveBeenCalledWith(
      `user:profile:${TEST_USER_ID_1}`,
      expect.objectContaining({ userId: TEST_USER_ID_1 }),
      900
    );
    expect(result.get(TEST_USER_ID_1)?.userId).toBe(TEST_USER_ID_1);
  });

  it('should skip missing profiles instead of throwing error', async () => {
    const mockProfile: Profile = {
      userId: TEST_USER_ID_1,
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: null,
      email: 'john@example.com',
      bio: null,
      testimony: null,
      profilePhotoMediaId: null,
      privacyMode: 'church_only',
      fieldVisibilitySettings: {},
      cachedMetrics: {},
      notificationPreferences: {},
      preferredDevotionalTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Profile;

    mockCacheRepository.read.mockResolvedValue(null);
    mockProfileRepository.findByIds.mockResolvedValue([mockProfile]);

    const result = await service.getBatchUserInfo(
      [TEST_USER_ID_1, TEST_USER_ID_2],
      REQUESTING_USER_ID
    );

    expect(result.size).toBe(1);
    expect(result.has(TEST_USER_ID_1)).toBe(true);
    expect(result.has(TEST_USER_ID_2)).toBe(false);
  });

  it('should handle partial cache hits by fetching missing users from database', async () => {
    const cachedUserInfo: UserInfo = {
      userId: TEST_USER_ID_1,
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: null,
      email: 'john@example.com',
    };

    const dbProfile: Profile = {
      userId: TEST_USER_ID_2,
      firstName: 'Jane',
      lastName: 'Smith',
      displayName: 'Jane Smith',
      avatarUrl: null,
      email: 'jane@example.com',
      bio: null,
      testimony: null,
      profilePhotoMediaId: null,
      privacyMode: 'public',
      fieldVisibilitySettings: {},
      cachedMetrics: {},
      notificationPreferences: {},
      preferredDevotionalTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Profile;

    mockCacheRepository.read.mockImplementation((key: string) => {
      if (key === `user:profile:${TEST_USER_ID_1}`) {
        return Promise.resolve(cachedUserInfo);
      }
      return Promise.resolve(null);
    });

    mockProfileRepository.findByIds.mockResolvedValue([dbProfile]);

    const result = await service.getBatchUserInfo(
      [TEST_USER_ID_1, TEST_USER_ID_2],
      REQUESTING_USER_ID
    );

    expect(result.size).toBe(2);
    expect(result.get(TEST_USER_ID_1)).toEqual(cachedUserInfo);
    expect(result.get(TEST_USER_ID_2)?.userId).toBe(TEST_USER_ID_2);
    expect(mockProfileRepository.findByIds).toHaveBeenCalledWith([TEST_USER_ID_2]);
    expect(mockCacheRepository.write).toHaveBeenCalledWith(
      `user:profile:${TEST_USER_ID_2}`,
      expect.objectContaining({ userId: TEST_USER_ID_2 }),
      900
    );
  });

  it('should deduplicate user IDs before fetching', async () => {
    const mockProfile: Profile = {
      userId: TEST_USER_ID_1,
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: null,
      email: 'john@example.com',
      bio: null,
      testimony: null,
      profilePhotoMediaId: null,
      privacyMode: 'church_only',
      fieldVisibilitySettings: {},
      cachedMetrics: {},
      notificationPreferences: {},
      preferredDevotionalTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Profile;

    mockCacheRepository.read.mockResolvedValue(null);
    mockProfileRepository.findByIds.mockResolvedValue([mockProfile]);

    const result = await service.getBatchUserInfo(
      [TEST_USER_ID_1, TEST_USER_ID_1, TEST_USER_ID_1],
      REQUESTING_USER_ID
    );

    expect(result.size).toBe(1);
    expect(mockProfileRepository.findByIds).toHaveBeenCalledWith([TEST_USER_ID_1]);
    expect(mockProfileRepository.findByIds).toHaveBeenCalledTimes(1);
  });
});
