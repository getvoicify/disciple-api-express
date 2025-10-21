import {describe, it, expect, vi, beforeEach} from 'vitest';
import type { Response } from 'express';
import { postFetchEndpoint } from '../../posts/routes/postFetch.endpoint';
import type { PostService } from '../../posts/service';
import type { Post } from '../../posts/schemas';
import type { EndpointRequest } from '../../types/endpoint-handler';
import { PostNotFoundError } from '../../posts/errors';

// Mock service
const mockService = {
  getPostById: vi.fn()
} as unknown as PostService;

describe('GET /posts/:id - Fetch Post Endpoint', () => {
  let req: Partial<EndpointRequest>;
  let res: Partial<Response>;
  const mockUserId = '550e8400-e29b-41d4-a716-446655440099';
  const mockChurchId = '550e8400-e29b-41d4-a716-446655440003';
  const mockPostId = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {
        id: mockPostId
      },
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

  describe('validation', () => {
    it('should handle invalid UUID', async () => {
      req.params = { id: 'invalid-uuid' };

      const handler = postFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.any(String),
        success: false,
      });
      expect(mockService.getPostById).not.toHaveBeenCalled();
    });

    it('should handle missing id parameter', async () => {
      req.params = {};

      const handler = postFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.any(String),
        success: false,
      });
      expect(mockService.getPostById).not.toHaveBeenCalled();
    });
  });

  describe('published posts (public access)', () => {
    it('should fetch a published post without authentication', async () => {
      req.user = undefined; // No authentication

      const mockPost: Post = {
        id: mockPostId,
        title: 'Published Post',
        content: 'Test content',
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
      };

      mockService.getPostById = vi.fn().mockResolvedValue(mockPost);

      const handler = postFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getPostById).toHaveBeenCalledWith(mockPostId);
      expect(res.json).toHaveBeenCalledWith({
        post: mockPost,
        success: true
      });
    });

    it('should fetch a published post with authentication', async () => {
      const mockPost: Post = {
        id: mockPostId,
        title: 'Published Post',
        content: 'Test content',
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
      };

      mockService.getPostById = vi.fn().mockResolvedValue(mockPost);

      const handler = postFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getPostById).toHaveBeenCalledWith(mockPostId);
      expect(res.json).toHaveBeenCalledWith({
        post: mockPost,
        success: true
      });
    });
  });

  describe('draft posts (requires authentication)', () => {
    it('should require authentication for draft posts', async () => {
      req.user = undefined;

      const mockDraftPost: Post = {
        id: mockPostId,
        title: 'Draft Post',
        content: 'Draft content',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
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
      };

      mockService.getPostById = vi.fn().mockResolvedValue(mockDraftPost);

      const handler = postFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getPostById).toHaveBeenCalledWith(mockPostId);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required to view draft posts',
        success: false,
      });
    });

    it('should fetch a draft post with authentication', async () => {
      const mockDraftPost: Post = {
        id: mockPostId,
        title: 'Draft Post',
        content: 'Draft content',
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
      };

      mockService.getPostById = vi.fn().mockResolvedValue(mockDraftPost);

      const handler = postFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getPostById).toHaveBeenCalledWith(mockPostId);
      expect(res.json).toHaveBeenCalledWith({
        post: mockDraftPost,
        success: true
      });
    });
  });

  describe('error handling', () => {
    it('should handle post not found error', async () => {
      req.user = undefined;

      mockService.getPostById = vi.fn().mockRejectedValue(
        new PostNotFoundError(mockPostId)
      );

      const handler = postFetchEndpoint(mockService);
      await handler(req as EndpointRequest, res as Response);

      expect(mockService.getPostById).toHaveBeenCalledWith(mockPostId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: `Post with identifier '${mockPostId}' not found`,
        success: false
      });
    });
  });
});