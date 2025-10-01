import {describe, it, expect, vi, beforeEach, Mock} from 'vitest';
import type { Request, Response } from 'express';
import { postCreateEndpoint } from '../../posts/routes/postCreate.endpoint';
import type { PostService } from '../../posts/service';
import type { CreatePostInput, Post } from '../../posts/schemas';
import { InsufficientChurchRoleError, NotChurchMemberError } from '../../posts/errors';

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
      user: {
        id: '550e8400-e29b-41d4-a716-446655440001'
      }
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
      authorId: req['user']!.id,
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
    await handler(req as Request, res as Response, next);

    expect(mockService.createPost).toHaveBeenCalledWith(input, req['user']!.id);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(mockPost);
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle validation error', async () => {
    req.body = {
      // Missing required fields
      content: 'Test content'
    };

    const handler = postCreateEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.createPost).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle insufficient role error', async () => {
    const input: CreatePostInput = {
      title: 'Test Post',
      content: 'Test content',
      churchId: '550e8400-e29b-41d4-a716-446655440002'
    };

    req.body = input;
    mockService.createPost = vi.fn().mockRejectedValue(
      new InsufficientChurchRoleError(['Owner', 'Manager'], 'Member')
    );

    const handler = postCreateEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.createPost).toHaveBeenCalledWith(input, req['user']!.id);
    expect(next).toHaveBeenCalledWith(expect.any(InsufficientChurchRoleError));
  });

  it('should handle not church member error', async () => {
    const input: CreatePostInput = {
      title: 'Test Post',
      content: 'Test content',
      churchId: '550e8400-e29b-41d4-a716-446655440002'
    };

    req.body = input;
    mockService.createPost = vi.fn().mockRejectedValue(
      new NotChurchMemberError(req['user']!.id, input.churchId)
    );

    const handler = postCreateEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.createPost).toHaveBeenCalledWith(input, req['user']!.id);
    expect(next).toHaveBeenCalledWith(expect.any(NotChurchMemberError));
  });

  it('should handle missing user context', async () => {
    req['user'] = undefined;

    const handler = postCreateEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.createPost).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
