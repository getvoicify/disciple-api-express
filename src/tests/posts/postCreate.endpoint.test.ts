import {beforeEach, describe, expect, it, Mock, vi} from 'vitest';
import type {Request, Response} from 'express';
import {postCreateEndpoint} from '../../posts/routes/postCreate.endpoint';
import type {PostService} from '../../posts/service';
import type {CreatePostInput, Post} from '../../posts/schemas';
import {InsufficientChurchRoleError, NotChurchMemberError} from '../../posts/errors';

// Mock service
const mockService = {
  createPost: vi.fn()
} as unknown as PostService;

describe('POST /posts - Create Post Endpoint', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      body: {},
      user: [{
        sub: '550e8400-e29b-41d4-a716-446655440001'
      }]
    } as unknown as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    next = vi.fn();
  });

  it('should create a post successfully', async () => {
    const input: CreatePostInput = {
      title: 'Test Post',
      content: 'Test content',
      churchId: '550e8400-e29b-41d4-a716-446655440002'
    };

    const mockPost: Post = {
      id: '550e8400-e29b-41d4-a716-446655440003',
      title: input.title,
      content: input.content,
      authorId: req['user']![0].sub!,
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

    req.body = input;
    mockService.createPost = vi.fn().mockResolvedValue(mockPost);

    const handler = postCreateEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.createPost).toHaveBeenCalledWith(input, req['user']![0].sub);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      post: mockPost,
      success: true
    });
  });

  it('should handle validation error with 400 response', async () => {
    req.body = {
      // Missing required fields
      content: 'Test content'
    };

    const handler = postCreateEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.createPost).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.any(String)
    }));
  });

  it('should handle insufficient role error with 403 status', async () => {
    const input: CreatePostInput = {
      title: 'Test Post',
      content: 'Test content',
      churchId: '550e8400-e29b-41d4-a716-446655440002'
    };

    req.body = input;
    const error = new InsufficientChurchRoleError(['Owner', 'Manager'], 'Member');
    mockService.createPost = vi.fn().mockRejectedValue(error);

    const handler = postCreateEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.createPost).toHaveBeenCalledWith(input, req['user']![0].sub);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: error.message,
      success: false
    });
  });

  it('should handle not church member error with 403 status', async () => {
    const input: CreatePostInput = {
      title: 'Test Post',
      content: 'Test content',
      churchId: '550e8400-e29b-41d4-a716-446655440002'
    };

    req.body = input;
    const error = new NotChurchMemberError(req['user']![0].sub!, input.churchId);
    mockService.createPost = vi.fn().mockRejectedValue(error);

    const handler = postCreateEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.createPost).toHaveBeenCalledWith(input, req['user']![0].sub);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: error.message,
      success: false
    });
  });

  it('should handle missing user context', async () => {
    req.body = {
      title: 'Test Post',
      content: 'Test content',
      churchId: '550e8400-e29b-41d4-a716-446655440002'
    };
    req['user'] = undefined;

    const handler = postCreateEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.createPost).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User authentication required',
      success: false
    });
  });
});
