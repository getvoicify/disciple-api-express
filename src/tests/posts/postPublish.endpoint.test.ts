import {describe, it, expect, vi, beforeEach} from 'vitest';
import type { Request, Response } from 'express';
import { postPublishEndpoint } from '../../posts/routes/postPublish.endpoint';
import type { PostService } from '../../posts/service';
import type { Post } from '../../posts/schemas';
import { PostNotFoundError, PostUnauthorizedError, PostAlreadyPublishedError } from '../../posts/errors';

// Mock service
const mockService = {
  publishPost: vi.fn(),
  unpublishPost: vi.fn()
} as unknown as PostService;

describe('PATCH /posts/:id/publish - Publish/Unpublish Post Endpoint', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {
        id: '550e8400-e29b-41d4-a716-446655440001'
      },
      body: {},
      user: [
        undefined,
        {
          payload: {
            sub: '550e8400-e29b-41d4-a716-446655440002'
          }
        }
      ]
    } as unknown as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
  });

  describe('Publishing', () => {
    it('should publish a post successfully', async () => {
      const mockPost: Post = {
        id: req.params!.id,
        title: 'Test Post',
        content: 'Test content',
        authorId: req['user']![1].payload.sub!,
        churchId: '550e8400-e29b-41d4-a716-446655440003',
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

      req.body = { action: 'publish' };
      mockService.publishPost = vi.fn().mockResolvedValue(mockPost);

      const handler = postPublishEndpoint(mockService);
      await handler(req as Request, res as Response);

      expect(mockService.publishPost).toHaveBeenCalledWith(req.params!.id, req['user']![1].payload.sub);
      expect(res.json).toHaveBeenCalledWith({
        post: mockPost,
        success: true
      });
    });

    it('should handle already published error', async () => {
      req.body = { action: 'publish' };
      mockService.publishPost = vi.fn().mockRejectedValue(
        new PostAlreadyPublishedError(req.params!.id)
      );

      const handler = postPublishEndpoint(mockService);
      await handler(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('already published'),
        success: false
      });
    });
  });

  describe('Unpublishing', () => {
    it('should unpublish a post successfully', async () => {
      const mockPost: Post = {
        id: req.params!.id,
        title: 'Test Post',
        content: 'Test content',
        authorId: req['user']![1].payload.sub!,
        churchId: '550e8400-e29b-41d4-a716-446655440003',
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

      req.body = { action: 'unpublish' };
      mockService.unpublishPost = vi.fn().mockResolvedValue(mockPost);

      const handler = postPublishEndpoint(mockService);
      await handler(req as Request, res as Response);

      expect(mockService.unpublishPost).toHaveBeenCalledWith(req.params!.id, req['user']![1].payload.sub);
      expect(res.json).toHaveBeenCalledWith({
        post: mockPost,
        success: true
      });
    });
  });

  it('should handle invalid action', async () => {
    req.body = { action: 'invalid' };

    const handler = postPublishEndpoint(mockService);

    // Validation returns 400 error on invalid action
    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.any(String),
      success: false,
    });
    expect(mockService.publishPost).not.toHaveBeenCalled();
    expect(mockService.unpublishPost).not.toHaveBeenCalled();
  });

  it('should handle missing action', async () => {
    req.body = {};

    const handler = postPublishEndpoint(mockService);

    // Validation returns 400 error on missing action
    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.any(String),
      success: false,
    });
    expect(mockService.publishPost).not.toHaveBeenCalled();
    expect(mockService.unpublishPost).not.toHaveBeenCalled();
  });

  it('should handle post not found error', async () => {
    req.body = { action: 'publish' };
    mockService.publishPost = vi.fn().mockRejectedValue(
      new PostNotFoundError(req.params!.id)
    );

    const handler = postPublishEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: `Post with identifier '${req.params!.id}' not found`,
      success: false
    });
  });

  it('should handle unauthorized error', async () => {
    req.body = { action: 'publish' };
    mockService.publishPost = vi.fn().mockRejectedValue(
      new PostUnauthorizedError('publish', req.params!.id)
    );

    const handler = postPublishEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('publish'),
      success: false
    });
  });

  it('should handle missing user context', async () => {
    req['user'] = undefined;
    req.body = { action: 'publish' };

    const handler = postPublishEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.publishPost).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User authentication required',
      success: false
    });
  });
});
