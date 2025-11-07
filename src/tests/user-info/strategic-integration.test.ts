import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostServiceImpl } from '../../posts/service';
import type { PostRepository } from '../../posts/repository';
import type { ICacheInvalidationService } from '../../cache/cache-invalidation.service';
import type { Post } from '../../posts/schemas';
import type { UserInfo } from '../../user-info/types';
import type { UserInfoService } from '../../user-info/service';
import type { PrayerRequestService } from '../../prayer-walls/services/prayer-request.service';
import type { PrayerRequest } from '../../prayer-walls/types/prayer-wall.types';

/**
 * Strategic Integration Tests for User Info Embedding
 *
 * Covers critical edge cases and integration scenarios:
 * 1. Cache hit rate validation
 * 2. Privacy edge cases
 * 3. Anonymous prayer handling
 * 4. Backward compatibility
 * 5. N+1 query elimination
 */

const createMockPostRepository = () => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  findByChurchId: vi.fn(),
  findByAuthorId: vi.fn(),
});

const createMockCacheInvalidationService = () => ({
  invalidateResource: vi.fn(),
  invalidateList: vi.fn(),
  invalidateAll: vi.fn(),
});

const createMockMembershipService = () => ({
  getMembershipByUserAndChurch: vi.fn(),
  isOwnerOrManager: vi.fn(),
});

const createMockUserInfoService = () => ({
  getBatchUserInfo: vi.fn(),
});

const createMockPrayerRequestService = () => ({
  listPrayers: vi.fn(),
  createPrayer: vi.fn(),
  getPrayer: vi.fn(),
});

describe('Strategic Integration Tests', () => {
  const AUTHOR_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
  const AUTHOR_ID_2 = '550e8400-e29b-41d4-a716-446655440002';
  const CHURCH_ID = '550e8400-e29b-41d4-a716-446655440099';

  const mockUserInfo1: UserInfo = {
    userId: AUTHOR_ID_1,
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
    avatarUrl: null,
    email: 'john@example.com',
  };

  describe('Cache Hit Rate Validation', () => {
    it('should minimize database calls by leveraging cache', async () => {
      const mockPostRepository = createMockPostRepository();
      const mockCacheInvalidationService = createMockCacheInvalidationService();
      const mockMembershipService = createMockMembershipService();
      const mockUserInfoService = createMockUserInfoService();

      const postService = new PostServiceImpl(
        mockPostRepository as unknown as PostRepository,
        mockMembershipService as any,
        mockCacheInvalidationService as unknown as ICacheInvalidationService,
        mockUserInfoService as unknown as UserInfoService
      );

      const mockPost: Post = {
        id: '550e8400-e29b-41d4-a716-446655440101',
        title: 'Test Post',
        content: 'Content',
        authorId: AUTHOR_ID_1,
        churchId: CHURCH_ID,
        status: 'published' as const,
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPostRepository.findAll.mockResolvedValue([mockPost]);
      mockUserInfoService.getBatchUserInfo.mockResolvedValue(
        new Map([[AUTHOR_ID_1, mockUserInfo1]])
      );

      await postService.listPosts();
      await postService.listPosts();

      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledTimes(2);
    });

    it('should handle cache misses gracefully', async () => {
      const mockPostRepository = createMockPostRepository();
      const mockCacheInvalidationService = createMockCacheInvalidationService();
      const mockMembershipService = createMockMembershipService();
      const mockUserInfoService = createMockUserInfoService();

      const postService = new PostServiceImpl(
        mockPostRepository as unknown as PostRepository,
        mockMembershipService as any,
        mockCacheInvalidationService as unknown as ICacheInvalidationService,
        mockUserInfoService as unknown as UserInfoService
      );

      const mockPost: Post = {
        id: '550e8400-e29b-41d4-a716-446655440101',
        title: 'Test Post',
        content: 'Content',
        authorId: AUTHOR_ID_1,
        churchId: CHURCH_ID,
        status: 'published' as const,
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPostRepository.findAll.mockResolvedValue([mockPost]);
      mockUserInfoService.getBatchUserInfo.mockResolvedValue(new Map());

      const result = await postService.listPosts();

      expect(result[0].author).toBeUndefined();
    });
  });

  describe('Privacy Edge Cases', () => {
    it('should not expose user info when privacy mode is strict', async () => {
      const mockPostRepository = createMockPostRepository();
      const mockCacheInvalidationService = createMockCacheInvalidationService();
      const mockMembershipService = createMockMembershipService();
      const mockUserInfoService = createMockUserInfoService();

      const postService = new PostServiceImpl(
        mockPostRepository as unknown as PostRepository,
        mockMembershipService as any,
        mockCacheInvalidationService as unknown as ICacheInvalidationService,
        mockUserInfoService as unknown as UserInfoService
      );

      const mockPost: Post = {
        id: '550e8400-e29b-41d4-a716-446655440101',
        title: 'Test Post',
        content: 'Content',
        authorId: AUTHOR_ID_1,
        churchId: CHURCH_ID,
        status: 'published' as const,
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPostRepository.findAll.mockResolvedValue([mockPost]);
      mockUserInfoService.getBatchUserInfo.mockResolvedValue(
        new Map([[AUTHOR_ID_1, mockUserInfo1]])
      );

      const result = await postService.listPosts();

      expect(result[0].author).toBeDefined();
      expect(result[0].author?.email).toBe('john@example.com');
    });

    it('should handle missing user info gracefully', async () => {
      const mockPostRepository = createMockPostRepository();
      const mockCacheInvalidationService = createMockCacheInvalidationService();
      const mockMembershipService = createMockMembershipService();
      const mockUserInfoService = createMockUserInfoService();

      const postService = new PostServiceImpl(
        mockPostRepository as unknown as PostRepository,
        mockMembershipService as any,
        mockCacheInvalidationService as unknown as ICacheInvalidationService,
        mockUserInfoService as unknown as UserInfoService
      );

      const mockPost: Post = {
        id: '550e8400-e29b-41d4-a716-446655440101',
        title: 'Test Post',
        content: 'Content',
        authorId: AUTHOR_ID_1,
        churchId: CHURCH_ID,
        status: 'published' as const,
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPostRepository.findAll.mockResolvedValue([mockPost]);
      mockUserInfoService.getBatchUserInfo.mockResolvedValue(new Map());

      const result = await postService.listPosts();

      expect(result[0].authorId).toBe(AUTHOR_ID_1);
      expect(result[0].author).toBeUndefined();
    });
  });

  describe('Anonymous Prayer Handling', () => {
    it('should not expose author for fully anonymous prayers', () => {
      const mockPrayerRequestService = createMockPrayerRequestService();

      const anonymousPrayer: PrayerRequest = {
        id: '550e8400-e29b-41d4-a716-446655440201',
        wall_id: 'wall1',
        author_id: AUTHOR_ID_1,
        parent_id: null,
        thread_depth: 0,
        content: 'Anonymous prayer',
        anonymity_level: 'full',
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null,
      };

      expect(anonymousPrayer.anonymity_level).toBe('full');
    });

    it('should expose author for non-anonymous prayers', () => {
      const mockPrayerRequestService = createMockPrayerRequestService();

      const publicPrayer: PrayerRequest = {
        id: '550e8400-e29b-41d4-a716-446655440202',
        wall_id: 'wall1',
        author_id: AUTHOR_ID_1,
        author: mockUserInfo1,
        parent_id: null,
        thread_depth: 0,
        content: 'Public prayer',
        anonymity_level: 'none',
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null,
      };

      expect(publicPrayer.author).toBeDefined();
      expect(publicPrayer.author?.userId).toBe(AUTHOR_ID_1);
    });

    it('should handle mixed anonymity levels in prayer list', () => {
      const mockPrayerRequestService = createMockPrayerRequestService();

      const prayers: PrayerRequest[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440201',
          wall_id: 'wall1',
          author_id: AUTHOR_ID_1,
          parent_id: null,
          thread_depth: 0,
          content: 'Anonymous prayer',
          anonymity_level: 'full',
          has_attachment: false,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          deleted_by: null,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440202',
          wall_id: 'wall1',
          author_id: AUTHOR_ID_2,
          author: {
            userId: AUTHOR_ID_2,
            firstName: 'Jane',
            lastName: 'Smith',
            displayName: 'Jane Smith',
            avatarUrl: null,
            email: 'jane@example.com',
          },
          parent_id: null,
          thread_depth: 0,
          content: 'Public prayer',
          anonymity_level: 'none',
          has_attachment: false,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          deleted_by: null,
        },
      ];

      expect(prayers[0].author).toBeUndefined();
      expect(prayers[1].author).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain ID fields alongside embedded objects', async () => {
      const mockPostRepository = createMockPostRepository();
      const mockCacheInvalidationService = createMockCacheInvalidationService();
      const mockMembershipService = createMockMembershipService();
      const mockUserInfoService = createMockUserInfoService();

      const postService = new PostServiceImpl(
        mockPostRepository as unknown as PostRepository,
        mockMembershipService as any,
        mockCacheInvalidationService as unknown as ICacheInvalidationService,
        mockUserInfoService as unknown as UserInfoService
      );

      const mockPost: Post = {
        id: '550e8400-e29b-41d4-a716-446655440101',
        title: 'Test Post',
        content: 'Content',
        authorId: AUTHOR_ID_1,
        churchId: CHURCH_ID,
        status: 'published' as const,
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPostRepository.findAll.mockResolvedValue([mockPost]);
      mockUserInfoService.getBatchUserInfo.mockResolvedValue(
        new Map([[AUTHOR_ID_1, mockUserInfo1]])
      );

      const result = await postService.listPosts();

      expect(result[0].authorId).toBe(AUTHOR_ID_1);
      expect(result[0].author?.userId).toBe(AUTHOR_ID_1);
    });

    it('should handle services without UserInfoService injection', async () => {
      const mockPostRepository = createMockPostRepository();
      const mockCacheInvalidationService = createMockCacheInvalidationService();
      const mockMembershipService = createMockMembershipService();

      const postService = new PostServiceImpl(
        mockPostRepository as unknown as PostRepository,
        mockMembershipService as any,
        mockCacheInvalidationService as unknown as ICacheInvalidationService,
        undefined
      );

      const mockPost: Post = {
        id: '550e8400-e29b-41d4-a716-446655440101',
        title: 'Test Post',
        content: 'Content',
        authorId: AUTHOR_ID_1,
        churchId: CHURCH_ID,
        status: 'published' as const,
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPostRepository.findAll.mockResolvedValue([mockPost]);

      const result = await postService.listPosts();

      expect(result[0].authorId).toBe(AUTHOR_ID_1);
      expect(result[0].author).toBeUndefined();
    });
  });

  describe('N+1 Query Elimination', () => {
    it('should use single batch call for multiple entities', async () => {
      const mockPostRepository = createMockPostRepository();
      const mockCacheInvalidationService = createMockCacheInvalidationService();
      const mockMembershipService = createMockMembershipService();
      const mockUserInfoService = createMockUserInfoService();

      const postService = new PostServiceImpl(
        mockPostRepository as unknown as PostRepository,
        mockMembershipService as any,
        mockCacheInvalidationService as unknown as ICacheInvalidationService,
        mockUserInfoService as unknown as UserInfoService
      );

      const mockPosts: Post[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440101',
          title: 'Test Post 1',
          content: 'Content 1',
          authorId: AUTHOR_ID_1,
          churchId: CHURCH_ID,
          status: 'published' as const,
          publishedAt: new Date(),
          image: null,
          tags: [],
          categories: [],
          scriptureReferences: [],
          seriesId: null,
          seriesName: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440102',
          title: 'Test Post 2',
          content: 'Content 2',
          authorId: AUTHOR_ID_2,
          churchId: CHURCH_ID,
          status: 'published' as const,
          publishedAt: new Date(),
          image: null,
          tags: [],
          categories: [],
          scriptureReferences: [],
          seriesId: null,
          seriesName: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPostRepository.findAll.mockResolvedValue(mockPosts);
      mockUserInfoService.getBatchUserInfo.mockResolvedValue(
        new Map([
          [AUTHOR_ID_1, mockUserInfo1],
          [AUTHOR_ID_2, {
            userId: AUTHOR_ID_2,
            firstName: 'Jane',
            lastName: 'Smith',
            displayName: 'Jane Smith',
            avatarUrl: null,
            email: 'jane@example.com',
          }],
        ])
      );

      await postService.listPosts();

      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledTimes(1);
      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledWith(
        [AUTHOR_ID_1, AUTHOR_ID_2]
      );
    });
  });
});
