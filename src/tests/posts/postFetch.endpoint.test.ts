import {describe, it, expect, vi, beforeEach} from 'vitest';
import type { Request, Response } from 'express';
import { postFetchEndpoint } from '../../posts/routes/postFetch.endpoint';
import type { PostService } from '../../posts/service';
import type { Post } from '../../posts/schemas';
import { PostNotFoundError } from '../../posts/errors';

// Mock service
const mockService = {
  getPostById: vi.fn()
} as unknown as PostService;

describe('GET /posts/:id - Fetch Post Endpoint', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {
        id: '550e8400-e29b-41d4-a716-446655440001'
      }
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
  });

  it('should fetch a post successfully', async () => {
    const mockPost: Post = {
      id: req.params!.id,
      title: 'Test Post',
      content: 'Test content',
      authorId: '550e8400-e29b-41d4-a716-446655440002',
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

    mockService.getPostById = vi.fn().mockResolvedValue(mockPost);

    const handler = postFetchEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.getPostById).toHaveBeenCalledWith(req.params!.id);
    expect(res.json).toHaveBeenCalledWith({
      post: mockPost,
      success: true
    });
  });

  it('should handle post not found error', async () => {
    mockService.getPostById = vi.fn().mockRejectedValue(
      new PostNotFoundError(req.params!.id)
    );

    const handler = postFetchEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.getPostById).toHaveBeenCalledWith(req.params!.id);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: `Post with identifier '${req.params!.id}' not found`,
      success: false
    });
  });

  it('should handle invalid UUID', async () => {
    req.params = { id: 'invalid-uuid' };

    const handler = postFetchEndpoint(mockService);

    // Validation returns 400 error on invalid UUID
    await handler(req as Request, res as Response);

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

    // Validation returns 400 error on missing id
    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.any(String),
      success: false,
    });
    expect(mockService.getPostById).not.toHaveBeenCalled();
  });
});
