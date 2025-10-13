import {describe, it, expect, vi, beforeEach} from 'vitest';
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

  it('should update a post successfully', async () => {
    const updateInput: UpdatePostInput = {
      title: 'Updated Title',
      content: 'Updated content'
    };

    const mockPost: Post = {
      id: req.params!.id,
      title: 'Updated Title',
      content: 'Updated content',
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

    req.body = updateInput;
    mockService.updatePost = vi.fn().mockResolvedValue(mockPost);

    const handler = postUpdateEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.updatePost).toHaveBeenCalledWith(req.params!.id, updateInput, req['user']![1].payload.sub);
    expect(res.json).toHaveBeenCalledWith({
      post: mockPost,
      success: true
    });
  });

  it('should handle empty update input', async () => {
    req.body = {};

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

    mockService.updatePost = vi.fn().mockResolvedValue(mockPost);

    const handler = postUpdateEndpoint(mockService);
    await handler(req as Request, res as Response);

    // Should still call service with empty object
    expect(mockService.updatePost).toHaveBeenCalledWith(req.params!.id, {}, req['user']![1].payload.sub);
    expect(res.json).toHaveBeenCalledWith({
      post: mockPost,
      success: true
    });
  });

  it('should handle post not found error', async () => {
    req.body = { title: 'Updated' };
    mockService.updatePost = vi.fn().mockRejectedValue(
      new PostNotFoundError(req.params!.id)
    );

    const handler = postUpdateEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: `Post with identifier '${req.params!.id}' not found`,
      success: false
    });
  });

  it('should handle unauthorized error', async () => {
    req.body = { title: 'Updated' };
    mockService.updatePost = vi.fn().mockRejectedValue(
      new PostUnauthorizedError('update', req.params!.id)
    );

    const handler = postUpdateEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('update'),
      success: false
    });
  });

  it('should handle missing user context', async () => {
    req['user'] = undefined;

    const handler = postUpdateEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.updatePost).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User authentication required',
      success: false
    });
  });
});
