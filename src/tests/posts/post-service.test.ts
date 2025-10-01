import {beforeEach, describe, expect, it, vi} from 'vitest';
import {type PostService, PostServiceImpl} from '../../posts/service';
import type {PostRepository} from '../../posts/repository';
import type {CreatePostInput, Post, UpdatePostInput} from '../../posts/schemas';
import {InsufficientChurchRoleError, PostNotFoundError} from '../../posts/errors';

// Mock repository
const createMockRepository = () => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  findByChurchId: vi.fn(),
  findByAuthorId: vi.fn(),
});

// Mock church membership service
const createMockMembershipService = () => ({
  getMembershipByUserAndChurch: vi.fn(),
  isOwnerOrManager: vi.fn(),
});

describe('PostService', () => {
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockMembershipService: ReturnType<typeof createMockMembershipService>;
  let service: PostService;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockMembershipService = createMockMembershipService();
    service = new PostServiceImpl(
      mockRepository as unknown as PostRepository,
      mockMembershipService as any
    );
  });

  describe('createPost', () => {
    it('should create post when user is church owner', async () => {
      const input: CreatePostInput = {
        title: 'Test Post',
        content: 'Test content',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockMembership = {
        id: 'membership-uuid',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        userId: authorId,
        role: 'Owner',
        status: 'Active'
      };

      const mockPost: Post = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        title: input.title,
        content: input.content,
        authorId,
        churchId: input.churchId,
        status: 'draft',
        publishedAt: null,
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockMembershipService.getMembershipByUserAndChurch.mockResolvedValue(mockMembership);
      mockRepository.create.mockResolvedValue(mockPost);

      const result = await service.createPost(input, authorId);

      expect(mockMembershipService.getMembershipByUserAndChurch).toHaveBeenCalledWith(authorId, input.churchId);
      expect(mockRepository.create).toHaveBeenCalledWith(input, authorId);
      expect(result).toEqual(mockPost);
    });

    it('should create post when user is church manager', async () => {
      const input: CreatePostInput = {
        title: 'Test Post',
        content: 'Test content',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockMembership = {
        id: 'membership-uuid',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        userId: authorId,
        role: 'Manager',
        status: 'Active'
      };

      mockMembershipService.getMembershipByUserAndChurch.mockResolvedValue(mockMembership);
      mockRepository.create.mockResolvedValue({} as Post);

      await service.createPost(input, authorId);

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should throw error when user is not church owner or manager', async () => {
      const input: CreatePostInput = {
        title: 'Test Post',
        content: 'Test content',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockMembership = {
        id: 'membership-uuid',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        userId: authorId,
        role: 'Member',
        status: 'Active'
      };

      mockMembershipService.getMembershipByUserAndChurch.mockResolvedValue(mockMembership);

      await expect(service.createPost(input, authorId)).rejects.toThrow(
        InsufficientChurchRoleError
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when user is not a member of the church', async () => {
      const input: CreatePostInput = {
        title: 'Test Post',
        content: 'Test content',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      mockMembershipService.getMembershipByUserAndChurch.mockResolvedValue(null);

      await expect(service.createPost(input, authorId)).rejects.toThrow(
        'User is not a member of this church'
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when membership status is not Active', async () => {
      const input: CreatePostInput = {
        title: 'Test Post',
        content: 'Test content',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockMembership = {
        id: 'membership-uuid',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        userId: authorId,
        role: 'Owner',
        status: 'Removed'
      };

      mockMembershipService.getMembershipByUserAndChurch.mockResolvedValue(mockMembership);

      await expect(service.createPost(input, authorId)).rejects.toThrow(
        'User membership is not active'
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updatePost', () => {
    it('should update post when user is the author', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440004';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';
      const updateInput: UpdatePostInput = {
        title: 'Updated Title'
      };

      const mockExistingPost: Post = {
        id: postId,
        title: 'Original Title',
        content: 'Content',
        authorId: authorId,
        churchId: '550e8400-e29b-41d4-a716-446655440005',
        status: 'draft',
        publishedAt: null,
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockUpdatedPost: Post = {
        ...mockExistingPost,
        title: 'Updated Title',
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockExistingPost);
      mockRepository.update.mockResolvedValue(mockUpdatedPost);

      const result = await service.updatePost(postId, updateInput, authorId);

      expect(mockRepository.findById).toHaveBeenCalledWith(postId);
      expect(mockRepository.update).toHaveBeenCalledWith(postId, updateInput);
      expect(result).toEqual(mockUpdatedPost);
    });

    it('should throw error when post not found', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440007';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';
      const updateInput: UpdatePostInput = { title: 'Updated' };

      mockRepository.findById.mockResolvedValue(null);

      await expect(service.updatePost(postId, updateInput, authorId)).rejects.toThrow(PostNotFoundError);

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when user is not the author', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440004';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';
      const differentUserId = '550e8400-e29b-41d4-a716-446655440006';
      const updateInput: UpdatePostInput = { title: 'Updated' };

      const mockExistingPost: Post = {
        id: postId,
        title: 'Original Title',
        content: 'Content',
        authorId: differentUserId, // Different author
        churchId: '550e8400-e29b-41d4-a716-446655440005',
        status: 'draft',
        publishedAt: null,
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockExistingPost);

      await expect(service.updatePost(postId, updateInput, authorId)).rejects.toThrow(
        'Unauthorized: You can only update your own posts'
      );

      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deletePost', () => {
    it('should delete post when user is the author', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440004';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockPost: Post = {
        id: postId,
        title: 'Title',
        content: 'Content',
        authorId: authorId,
        churchId: '550e8400-e29b-41d4-a716-446655440005',
        status: 'draft',
        publishedAt: null,
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockPost);
      mockRepository.delete.mockResolvedValue(true);

      await service.deletePost(postId, authorId);

      expect(mockRepository.findById).toHaveBeenCalledWith(postId);
      expect(mockRepository.delete).toHaveBeenCalledWith(postId);
    });

    it('should throw error when post not found', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440007';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      mockRepository.findById.mockResolvedValue(null);

      await expect(service.deletePost(postId, authorId)).rejects.toThrow(PostNotFoundError);

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error when user is not the author', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440004';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';
      const differentUserId = '550e8400-e29b-41d4-a716-446655440006';

      const mockPost: Post = {
        id: postId,
        title: 'Title',
        content: 'Content',
        authorId: differentUserId, // Different author
        churchId: '550e8400-e29b-41d4-a716-446655440005',
        status: 'draft',
        publishedAt: null,
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockPost);

      await expect(service.deletePost(postId, authorId)).rejects.toThrow(
        'Unauthorized: You can only delete your own posts'
      );

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('getPostById', () => {
    it('should return post when found', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440004';

      const mockPost: Post = {
        id: postId,
        title: 'Title',
        content: 'Content',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440005',
        status: 'published',
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockPost);

      const result = await service.getPostById(postId);

      expect(mockRepository.findById).toHaveBeenCalledWith(postId);
      expect(result).toEqual(mockPost);
    });

    it('should throw error when post not found', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440007';

      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getPostById(postId)).rejects.toThrow(PostNotFoundError);
    });
  });

  describe('listPosts', () => {
    it('should return list of posts', async () => {
      const mockPosts: Post[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440008',
          title: 'Post 1',
          content: 'Content 1',
          authorId: '550e8400-e29b-41d4-a716-446655440009',
          churchId: '550e8400-e29b-41d4-a716-44665544000a',
          status: 'published',
          publishedAt: new Date(),
          image: null,
          tags: [],
          categories: [],
          scriptureReferences: [],
          seriesId: null,
          seriesName: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRepository.findAll.mockResolvedValue(mockPosts);

      const result = await service.listPosts();

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockPosts);
    });

    it('should pass filters to repository', async () => {
      const filters = {
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'published' as const
      };

      mockRepository.findAll.mockResolvedValue([]);

      await service.listPosts(filters);

      // Zod schema adds default authorizedIds: []
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        ...filters,
        authorizedIds: []
      });
    });
  });

  describe('publishPost', () => {
    it('should publish draft post when user is the author', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440004';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockDraftPost: Post = {
        id: postId,
        title: 'Title',
        content: 'Content',
        authorId: authorId,
        churchId: '550e8400-e29b-41d4-a716-446655440005',
        status: 'draft',
        publishedAt: null,
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockPublishedPost: Post = {
        ...mockDraftPost,
        status: 'published',
        publishedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockDraftPost);
      mockRepository.update.mockResolvedValue(mockPublishedPost);

      const result = await service.publishPost(postId, authorId);

      expect(mockRepository.findById).toHaveBeenCalledWith(postId);
      expect(mockRepository.update).toHaveBeenCalledWith(postId, { status: 'published' });
      expect(result).toEqual(mockPublishedPost);
    });

    it('should throw error when post is already published', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440004';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockPublishedPost: Post = {
        id: postId,
        title: 'Title',
        content: 'Content',
        authorId: authorId,
        churchId: '550e8400-e29b-41d4-a716-446655440005',
        status: 'published',
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockPublishedPost);

      await expect(service.publishPost(postId, authorId)).rejects.toThrow(
        'Post is already published'
      );

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when user is not the author', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440004';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';
      const differentUserId = '550e8400-e29b-41d4-a716-446655440006';

      const mockPost: Post = {
        id: postId,
        title: 'Title',
        content: 'Content',
        authorId: differentUserId,
        churchId: '550e8400-e29b-41d4-a716-446655440005',
        status: 'draft',
        publishedAt: null,
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockPost);

      await expect(service.publishPost(postId, authorId)).rejects.toThrow(
        'Unauthorized: You can only publish your own posts'
      );

      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('unpublishPost', () => {
    it('should unpublish published post when user is the author', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440004';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockPublishedPost: Post = {
        id: postId,
        title: 'Title',
        content: 'Content',
        authorId: authorId,
        churchId: '550e8400-e29b-41d4-a716-446655440005',
        status: 'published',
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockDraftPost: Post = {
        ...mockPublishedPost,
        status: 'draft'
      };

      mockRepository.findById.mockResolvedValue(mockPublishedPost);
      mockRepository.update.mockResolvedValue(mockDraftPost);

      const result = await service.unpublishPost(postId, authorId);

      expect(mockRepository.findById).toHaveBeenCalledWith(postId);
      expect(mockRepository.update).toHaveBeenCalledWith(postId, { status: 'draft' });
      expect(result).toEqual(mockDraftPost);
    });

    it('should throw error when post is already draft', async () => {
      const postId = '550e8400-e29b-41d4-a716-446655440004';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockDraftPost: Post = {
        id: postId,
        title: 'Title',
        content: 'Content',
        authorId: authorId,
        churchId: '550e8400-e29b-41d4-a716-446655440005',
        status: 'draft',
        publishedAt: null,
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockDraftPost);

      await expect(service.unpublishPost(postId, authorId)).rejects.toThrow(
        'Post is already a draft'
      );

      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });
});
