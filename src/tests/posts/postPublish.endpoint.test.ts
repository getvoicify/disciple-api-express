import {describe, it, expect, vi, beforeEach, Mock} from 'vitest';
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
  let next: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {
        id: '550e8400-e29b-41d4-a716-446655440001'
      },
      body: {},
      user: {
        id: '550e8400-e29b-41d4-a716-446655440002'
      }
    } as unknown as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    next = vi.fn();
  });

  describe('Publishing', () => {
    it('should publish a post successfully', async () => {
      const mockPost: Post = {
        id: req.params!.id,
        title: 'Test Post',
        content: 'Test content',
        authorId: req['user']!.id,
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
      await handler(req as Request, res as Response, next);

      expect(mockService.publishPost).toHaveBeenCalledWith(req.params!.id, req['user']!.id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPost);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle already published error', async () => {
      req.body = { action: 'publish' };
      mockService.publishPost = vi.fn().mockRejectedValue(
        new PostAlreadyPublishedError(req.params!.id)
      );

      const handler = postPublishEndpoint(mockService);
      await handler(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(PostAlreadyPublishedError));
    });
  });

  describe('Unpublishing', () => {
    it('should unpublish a post successfully', async () => {
      const mockPost: Post = {
        id: req.params!.id,
        title: 'Test Post',
        content: 'Test content',
        authorId: req['user']!.id,
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
      await handler(req as Request, res as Response, next);

      expect(mockService.unpublishPost).toHaveBeenCalledWith(req.params!.id, req['user']!.id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPost);
      expect(next).not.toHaveBeenCalled();
    });
  });

  it('should handle invalid action', async () => {
    req.body = { action: 'invalid' };

    const handler = postPublishEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.publishPost).not.toHaveBeenCalled();
    expect(mockService.unpublishPost).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle missing action', async () => {
    req.body = {};

    const handler = postPublishEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.publishPost).not.toHaveBeenCalled();
    expect(mockService.unpublishPost).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle post not found error', async () => {
    req.body = { action: 'publish' };
    mockService.publishPost = vi.fn().mockRejectedValue(
      new PostNotFoundError(req.params!.id)
    );

    const handler = postPublishEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(PostNotFoundError));
  });

  it('should handle unauthorized error', async () => {
    req.body = { action: 'publish' };
    mockService.publishPost = vi.fn().mockRejectedValue(
      new PostUnauthorizedError('publish', req.params!.id)
    );

    const handler = postPublishEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(PostUnauthorizedError));
  });

  it('should handle missing user context', async () => {
    req['user'] = undefined;
    req.body = { action: 'publish' };

    const handler = postPublishEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.publishPost).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
