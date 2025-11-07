import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostServiceImpl } from '../../posts/service';
import { NoteServiceImpl } from '../../notes/service';
import { SeriesServiceImpl } from '../../series/service';
import type { PostRepository } from '../../posts/repository';
import type { NoteRepository } from '../../notes/repository';
import type { SeriesRepository } from '../../series/repository';
import type { ICacheInvalidationService } from '../../cache/cache-invalidation.service';
import type { Post } from '../../posts/schemas';
import type { Note } from '../../notes/schemas';
import type { Series } from '../../series/schemas';
import type { UserInfo } from '../../user-info/types';
import type { UserInfoService } from '../../user-info/service';

/**
 * TDD RED PHASE: Entity Embedding Tests
 *
 * These tests verify that entity services embed user info objects in their responses.
 * These tests WILL FAIL because:
 * 1. Services don't have UserInfoService injected yet
 * 2. Services don't call getBatchUserInfo
 * 3. Services don't embed user info into responses
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

const createMockNoteRepository = () => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
});

const createMockSeriesRepository = () => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
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

describe('Entity User Info Embedding - RED PHASE', () => {
  const AUTHOR_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
  const AUTHOR_ID_2 = '550e8400-e29b-41d4-a716-446655440002';
  const CHURCH_ID = '550e8400-e29b-41d4-a716-446655440099';
  const REQUESTING_USER_ID = '550e8400-e29b-41d4-a716-446655440998';

  const mockUserInfo1: UserInfo = {
    userId: AUTHOR_ID_1,
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
    avatarUrl: null,
    email: 'john@example.com',
  };

  const mockUserInfo2: UserInfo = {
    userId: AUTHOR_ID_2,
    firstName: 'Jane',
    lastName: 'Smith',
    displayName: 'Jane Smith',
    avatarUrl: 'https://example.com/jane.jpg',
    email: 'jane@example.com',
  };

  describe('Posts Service - Author Embedding', () => {
    let mockPostRepository: ReturnType<typeof createMockPostRepository>;
    let mockCacheInvalidationService: ReturnType<typeof createMockCacheInvalidationService>;
    let mockMembershipService: ReturnType<typeof createMockMembershipService>;
    let mockUserInfoService: ReturnType<typeof createMockUserInfoService>;
    let postService: PostServiceImpl;

    beforeEach(() => {
      mockPostRepository = createMockPostRepository();
      mockCacheInvalidationService = createMockCacheInvalidationService();
      mockMembershipService = createMockMembershipService();
      mockUserInfoService = createMockUserInfoService();

      postService = new PostServiceImpl(
        mockPostRepository as unknown as PostRepository,
        mockMembershipService as any,
        mockCacheInvalidationService as unknown as ICacheInvalidationService,
        mockUserInfoService as unknown as UserInfoService
      );
    });

    it('should embed author info in posts list response', async () => {
      const mockPosts: Post[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440101',
          title: 'Test Post 1',
          content: 'Content 1',
          authorId: AUTHOR_ID_1,
          churchId: CHURCH_ID,
          status: 'published',
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
          status: 'published',
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
          [AUTHOR_ID_2, mockUserInfo2],
        ])
      );

      const result = await postService.listPosts();

      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledWith(
        [AUTHOR_ID_1, AUTHOR_ID_2]
      );
      expect(result[0].author).toBeDefined();
      expect(result[0].author?.userId).toBe(AUTHOR_ID_1);
      expect(result[0].author?.firstName).toBe('John');
      expect(result[0].author?.lastName).toBe('Doe');
      expect(result[1].author).toBeDefined();
      expect(result[1].author?.userId).toBe(AUTHOR_ID_2);
    });

    it('should handle posts with duplicate authors efficiently using batch fetch', async () => {
      const mockPosts: Post[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440101',
          title: 'Test Post 1',
          content: 'Content 1',
          authorId: AUTHOR_ID_1,
          churchId: CHURCH_ID,
          status: 'published',
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
          authorId: AUTHOR_ID_1,
          churchId: CHURCH_ID,
          status: 'published',
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
        new Map([[AUTHOR_ID_1, mockUserInfo1]])
      );

      const result = await postService.listPosts();

      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledTimes(1);
      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledWith(
        [AUTHOR_ID_1]
      );
      expect(result[0].author?.userId).toBe(AUTHOR_ID_1);
      expect(result[1].author?.userId).toBe(AUTHOR_ID_1);
    });
  });

  describe('Notes Service - Owner Embedding', () => {
    let mockNoteRepository: ReturnType<typeof createMockNoteRepository>;
    let mockCacheInvalidationService: ReturnType<typeof createMockCacheInvalidationService>;
    let mockUserInfoService: ReturnType<typeof createMockUserInfoService>;
    let noteService: NoteServiceImpl;

    beforeEach(() => {
      mockNoteRepository = createMockNoteRepository();
      mockCacheInvalidationService = createMockCacheInvalidationService();
      mockUserInfoService = createMockUserInfoService();

      noteService = new NoteServiceImpl(
        mockNoteRepository as unknown as NoteRepository,
        mockCacheInvalidationService as unknown as ICacheInvalidationService,
        mockUserInfoService as unknown as UserInfoService
      );
    });

    it('should embed owner info in notes list response', async () => {
      const mockNotes: Note[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440201',
          title: 'Test Note 1',
          content: 'Note content 1',
          date: new Date(),
          scriptureReferences: [],
          images: [],
          ownerId: AUTHOR_ID_1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Note,
        {
          id: '550e8400-e29b-41d4-a716-446655440202',
          title: 'Test Note 2',
          content: 'Note content 2',
          date: new Date(),
          scriptureReferences: [],
          images: [],
          ownerId: AUTHOR_ID_2,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Note,
      ];

      mockNoteRepository.findAll.mockResolvedValue(mockNotes);
      mockUserInfoService.getBatchUserInfo.mockResolvedValue(
        new Map([
          [AUTHOR_ID_1, mockUserInfo1],
          [AUTHOR_ID_2, mockUserInfo2],
        ])
      );

      const result = await noteService.listNotes();

      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledWith(
        [AUTHOR_ID_1, AUTHOR_ID_2]
      );
      expect(result[0].owner).toBeDefined();
      expect(result[0].owner?.userId).toBe(AUTHOR_ID_1);
      expect(result[0].owner?.firstName).toBe('John');
      expect(result[1].owner).toBeDefined();
      expect(result[1].owner?.userId).toBe(AUTHOR_ID_2);
    });
  });

  describe('Series Service - Author Embedding', () => {
    let mockSeriesRepository: ReturnType<typeof createMockSeriesRepository>;
    let mockMembershipService: ReturnType<typeof createMockMembershipService>;
    let mockPostRepository: ReturnType<typeof createMockPostRepository>;
    let mockUserInfoService: ReturnType<typeof createMockUserInfoService>;
    let seriesService: SeriesServiceImpl;

    beforeEach(() => {
      mockSeriesRepository = createMockSeriesRepository();
      mockMembershipService = createMockMembershipService();
      mockPostRepository = createMockPostRepository();
      mockUserInfoService = createMockUserInfoService();

      seriesService = new SeriesServiceImpl(
        mockSeriesRepository as unknown as SeriesRepository,
        mockMembershipService as any,
        mockPostRepository as unknown as PostRepository,
        mockUserInfoService as unknown as UserInfoService
      );
    });

    it('should embed author info in series list response', async () => {
      const mockSeries: Series[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440301',
          title: 'Test Series 1',
          description: 'Series description 1',
          image: null,
          authorId: AUTHOR_ID_1,
          churchId: CHURCH_ID,
          status: 'published',
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440302',
          title: 'Test Series 2',
          description: 'Series description 2',
          image: null,
          authorId: AUTHOR_ID_2,
          churchId: CHURCH_ID,
          status: 'published',
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSeriesRepository.findAll.mockResolvedValue(mockSeries);
      mockUserInfoService.getBatchUserInfo.mockResolvedValue(
        new Map([
          [AUTHOR_ID_1, mockUserInfo1],
          [AUTHOR_ID_2, mockUserInfo2],
        ])
      );

      const result = await seriesService.listSeries();

      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledWith(
        [AUTHOR_ID_1, AUTHOR_ID_2]
      );
      expect(result[0].author).toBeDefined();
      expect(result[0].author?.userId).toBe(AUTHOR_ID_1);
      expect(result[0].author?.firstName).toBe('John');
      expect(result[1].author).toBeDefined();
      expect(result[1].author?.userId).toBe(AUTHOR_ID_2);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain authorId field in posts response even with embedded author', async () => {
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
        id: '550e8400-e29b-41d4-a716-446655440401',
        title: 'Test Post',
        content: 'Content',
        authorId: AUTHOR_ID_1,
        churchId: CHURCH_ID,
        status: 'published',
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
      expect(result[0].author).toBeDefined();
    });
  });
});
