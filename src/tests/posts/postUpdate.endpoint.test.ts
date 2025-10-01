import {describe, it, expect, vi, beforeEach, Mock} from 'vitest';
import type { Request, Response } from 'express';
import { postUpdateEndpoint } from '../../posts/routes/postUpdate.endpoint';
import type { PostService } from '../../posts/service';
import type { UpdatePostInput, Post } from '../../posts/schemas';
import { PostNotFoundError, PostUnauthorizedError } from '../../posts/errors';

// Mock service
const mockService = {
  updatePost: vi.fn()
} as unknown as PostService;

describe('PATCH /posts/:id - Update Post Endpoint', () => {
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
      user: [{
        sub: '550e8400-e29b-41d4-a716-446655440002'
      }]
    } as unknown as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    next = vi.fn();
  });

  it('should update a post successfully', async () => {
    const updateInput: UpdatePostInput = {
      title: 'Updated Title',
      content: 'Updated content'
    };

    const mockPost: Post = {
      id: req.params!.id,
      title: 'Updated Title',
      content: 'Updated content',
      authorId: req['user']![0].sub!,
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

    req.body = updateInput;
    mockService.updatePost = vi.fn().mockResolvedValue(mockPost);

    const handler = postUpdateEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.updatePost).toHaveBeenCalledWith(req.params!.id, updateInput, req['user']![0].sub);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockPost);
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle empty update input', async () => {
    req.body = {};

    const handler = postUpdateEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    // Should still call service with empty object
    expect(mockService.updatePost).toHaveBeenCalledWith(req.params!.id, {}, req['user']![0].sub);
  });

  it('should handle post not found error', async () => {
    req.body = { title: 'Updated' };
    mockService.updatePost = vi.fn().mockRejectedValue(
      new PostNotFoundError(req.params!.id)
    );

    const handler = postUpdateEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(PostNotFoundError));
  });

  it('should handle unauthorized error', async () => {
    req.body = { title: 'Updated' };
    mockService.updatePost = vi.fn().mockRejectedValue(
      new PostUnauthorizedError('update', req.params!.id)
    );

    const handler = postUpdateEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(PostUnauthorizedError));
  });

  it('should handle missing user context', async () => {
    req['user'] = undefined;

    const handler = postUpdateEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.updatePost).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
