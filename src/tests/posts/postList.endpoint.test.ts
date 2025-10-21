import {describe, it, expect, vi, beforeEach} from 'vitest';
import type { Response } from 'express';
import { postListEndpoint } from '../../posts/routes/postList.endpoint';
import type { PostService } from '../../posts/service';
import type { Post } from '../../posts/schemas';
import type { CacheRepository } from '../../cache';
import type { ChurchMembershipService } from '../../churches/membership-service';
import type { EndpointRequest } from '../../types/endpoint-handler';

// Mock service
const mockService = {
  listPosts: vi.fn()
} as unknown as PostService;

// Mock cache repository
const mockCacheRepo = {
  write: vi.fn(),
  read: vi.fn(),
  delete: vi.fn()
} as unknown as CacheRepository;

// Mock membership service
const mockMembershipService = {
  getMembershipByUserAndChurch: vi.fn()
} as unknown as ChurchMembershipService;

describe('GET /churches/:churchId/posts - List Posts Endpoint', () => {
  let req: Partial<EndpointRequest>;
  let res: Partial<Response>;
  const mockUserId = '550e8400-e29b-41d4-a716-446655440099';
  const mockChurchId = '550e8400-e29b-41d4-a716-446655440003';

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {
        churchId: mockChurchId
      },
      query: {},
      user: [undefined, {
        payload: {
          sub: mockUserId
        }
      }] as any
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
  });

  describe('path parameters', () => {
    it('should require churchId in path params', async () => {
      req.params = {};

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('churchId'),
        success: false,
      });
    });

    it('should require valid UUID for churchId', async () => {
      req.params = { churchId: 'invalid-uuid' };

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.any(String),
        success: false,
      });
    });
  });

  describe('published posts (public access)', () => {
    it('should list published posts without authentication', async () => {
      req.user = undefined; // No authentication

      const mockPosts: Post[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Published Post',
          content: 'Content 1',
          authorId: '550e8400-e29b-41d4-a716-446655440002',
          churchId: mockChurchId,
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

      mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.listPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          churchId: mockChurchId,
          status: 'published'
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        posts: mockPosts,
        success: true,
        count: mockPosts.length
      });
      // Should not check membership for published posts
      expect(mockMembershipService.getMembershipByUserAndChurch).not.toHaveBeenCalled();
    });

    it('should default to published posts when no status specified', async () => {
      req.user = undefined;
      req.query = {}; // No status filter

      const mockPosts: Post[] = [];
      mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.listPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'published'
        })
      );
    });

    it('should apply filters along with churchId for published posts', async () => {
      req.user = undefined;
      req.query = {
        status: 'published',
        tags: 'faith,devotional',
        categories: 'sermon'
      };

      const mockPosts: Post[] = [];
      mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.listPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          churchId: mockChurchId,
          status: 'published',
          tags: ['faith', 'devotional'],
          categories: ['sermon']
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        posts: mockPosts,
        success: true,
        count: 0
      });
    });
  });

  describe('draft posts (requires authentication and membership)', () => {
    it('should require authentication when requesting draft posts', async () => {
      req.user = undefined;
      req.query = { status: 'draft' };

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User authentication required',
        success: false,
      });
    });

    it('should verify user is a member of church when requesting drafts', async () => {
      req.query = { status: 'draft' };
      mockMembershipService.getMembershipByUserAndChurch = vi.fn().mockResolvedValue(null);

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockMembershipService.getMembershipByUserAndChurch).toHaveBeenCalledWith(
        mockUserId,
        mockChurchId
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('not a member'),
        success: false,
      });
    });

    it('should reject if user membership is not active when requesting drafts', async () => {
      req.query = { status: 'draft' };
      mockMembershipService.getMembershipByUserAndChurch = vi.fn().mockResolvedValue({
        id: 'membership-id',
        churchId: mockChurchId,
        userId: mockUserId,
        role: 'Member',
        status: 'Invited',
        joinedAt: new Date(),
        updatedAt: new Date(),
        invitedBy: null,
        invitedAt: null
      });

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('active member'),
        success: false,
      });
    });

    it('should list draft posts when user is active member', async () => {
      req.query = { status: 'draft' };

      const mockPosts: Post[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Draft Post',
          content: 'Draft Content',
          authorId: mockUserId,
          churchId: mockChurchId,
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
        }
      ];

      mockMembershipService.getMembershipByUserAndChurch = vi.fn().mockResolvedValue({
        id: 'membership-id',
        churchId: mockChurchId,
        userId: mockUserId,
        role: 'Member',
        status: 'Active',
        joinedAt: new Date(),
        updatedAt: new Date(),
        invitedBy: null,
        invitedAt: null
      });

      mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockMembershipService.getMembershipByUserAndChurch).toHaveBeenCalledWith(
        mockUserId,
        mockChurchId
      );
      expect(mockService.listPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          churchId: mockChurchId,
          status: 'draft'
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        posts: mockPosts,
        success: true,
        count: mockPosts.length
      });
    });
  });

  describe('filters', () => {
    it('should handle date filters', async () => {
      req.user = undefined;
      req.query = {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      const mockPosts: Post[] = [];
      mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      const callArgs = (mockService.listPosts as any).mock.calls[0][0];
      expect(callArgs).toMatchObject({
        churchId: mockChurchId,
        status: 'published',
        startDate: expect.any(Date),
        endDate: expect.any(Date)
      });
    });

    it('should handle scripture filters', async () => {
      req.user = undefined;
      req.query = {
        'scripture.book': 'John',
        'scripture.chapter': '3',
        'scripture.verse': '16'
      };

      const mockPosts: Post[] = [];
      mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      const callArgs = (mockService.listPosts as any).mock.calls[0][0];
      expect(callArgs.scripture).toEqual({
        book: 'John',
        chapter: 3,
        verse: 16
      });
    });
  });

  describe('edge cases', () => {
    it('should return empty array when no posts found', async () => {
      req.user = undefined;

      const mockPosts: Post[] = [];
      mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

      const handler = postListEndpoint(mockService, mockCacheRepo, mockMembershipService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith({
        posts: mockPosts,
        success: true,
        count: 0
      });
    });
  });
});