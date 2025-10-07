import {describe, it, expect, vi, beforeEach} from 'vitest';
import type { Request, Response } from 'express';
import { postListEndpoint } from '../../posts/routes/postList.endpoint';
import type { PostService } from '../../posts/service';
import type { Post } from '../../posts/schemas';
import type { CacheRepository } from '../../cache';

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

describe('GET /posts - List Posts Endpoint', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      query: {}
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
  });

  it('should list posts without filters', async () => {
    const mockPosts: Post[] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Post 1',
        content: 'Content 1',
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
      }
    ];

    mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

    const handler = postListEndpoint(mockService, mockCacheRepo);
    await handler(req as Request, res as Response);

    expect(mockService.listPosts).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      posts: mockPosts,
      success: true,
      count: mockPosts.length
    });
  });

  it('should list posts with filters', async () => {
    req.query = {
      churchId: '550e8400-e29b-41d4-a716-446655440003',
      status: 'published',
      tags: 'faith,devotional',
      categories: 'sermon'
    };

    const mockPosts: Post[] = [];
    mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

    const handler = postListEndpoint(mockService, mockCacheRepo);
    await handler(req as Request, res as Response);

    expect(mockService.listPosts).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      posts: mockPosts,
      success: true,
      count: 0
    });
  });

  it('should handle date filters', async () => {
    req.query = {
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    };

    const mockPosts: Post[] = [];
    mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

    const handler = postListEndpoint(mockService, mockCacheRepo);
    await handler(req as Request, res as Response);

    const callArgs = (mockService.listPosts as any).mock.calls[0][0];
    expect(callArgs).toMatchObject({
      startDate: expect.any(Date),
      endDate: expect.any(Date)
    });
    expect(res.json).toHaveBeenCalledWith({
      posts: mockPosts,
      success: true,
      count: 0
    });
  });

  it('should handle scripture filters', async () => {
    req.query = {
      'scripture.book': 'John',
      'scripture.chapter': '3',
      'scripture.verse': '16'
    };

    const mockPosts: Post[] = [];
    mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

    const handler = postListEndpoint(mockService, mockCacheRepo);
    await handler(req as Request, res as Response);

    expect(mockService.listPosts).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      posts: mockPosts,
      success: true,
      count: 0
    });
  });

  it('should handle authorized IDs from middleware', async () => {
    req.query = {};
    req['ids'] = ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'];

    const mockPosts: Post[] = [];
    mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

    const handler = postListEndpoint(mockService, mockCacheRepo);
    await handler(req as Request, res as Response);

    expect(mockService.listPosts).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      posts: mockPosts,
      success: true,
      count: 0
    });
  });

  it('should handle non-array req["ids"] gracefully', async () => {
    req.query = {};
    req['ids'] = 'not-an-array' as any; // Invalid type

    const mockPosts: Post[] = [];
    mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

    const handler = postListEndpoint(mockService, mockCacheRepo);
    await handler(req as Request, res as Response);

    // Should use empty array when ids is not an array
    const callArgs = (mockService.listPosts as any).mock.calls[0][0];
    expect(callArgs.authorizedIds).toEqual([]);
    expect(mockService.listPosts).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      posts: mockPosts,
      success: true,
      count: 0
    });
  });

  it('should handle missing req["ids"] gracefully', async () => {
    req.query = {};
    // req['ids'] is undefined

    const mockPosts: Post[] = [];
    mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

    const handler = postListEndpoint(mockService, mockCacheRepo);
    await handler(req as Request, res as Response);

    // Should use empty array when ids is missing
    const callArgs = (mockService.listPosts as any).mock.calls[0][0];
    expect(callArgs.authorizedIds).toEqual([]);
    expect(mockService.listPosts).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      posts: mockPosts,
      success: true,
      count: 0
    });
  });

  it('should handle validation errors', async () => {
    req.query = {
      status: 'invalid-status'
    };

    const handler = postListEndpoint(mockService, mockCacheRepo);

    // Validation now returns error response instead of throwing
    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining(''),
      success: false,
    });
    expect(mockService.listPosts).not.toHaveBeenCalled();
  });

  it('should return empty array when no posts found', async () => {
    const mockPosts: Post[] = [];
    mockService.listPosts = vi.fn().mockResolvedValue(mockPosts);

    const handler = postListEndpoint(mockService, mockCacheRepo);
    await handler(req as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith({
      posts: mockPosts,
      success: true,
      count: 0
    });
  });
});
