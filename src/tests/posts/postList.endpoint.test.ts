import {describe, it, expect, vi, beforeEach, Mock} from 'vitest';
import type { Request, Response } from 'express';
import { postListEndpoint } from '../../posts/routes/postList.endpoint';
import type { PostService } from '../../posts/service';
import type { Post, PostFilters } from '../../posts/schemas';

// Mock service
const mockService = {
  listPosts: vi.fn()
} as unknown as PostService;

describe('GET /posts - List Posts Endpoint', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      query: {}
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    next = vi.fn();
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

    const handler = postListEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.listPosts).toHaveBeenCalledWith(undefined);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockPosts);
    expect(next).not.toHaveBeenCalled();
  });

  it('should list posts with filters', async () => {
    req.query = {
      churchId: '550e8400-e29b-41d4-a716-446655440003',
      status: 'published',
      tags: 'faith,devotional',
      categories: 'sermon'
    };

    const expectedFilters: PostFilters = {
      authorizedIds: [], // Schema adds default empty array
      churchId: '550e8400-e29b-41d4-a716-446655440003',
      status: 'published',
      tags: ['faith', 'devotional'],
      categories: ['sermon']
    };

    mockService.listPosts = vi.fn().mockResolvedValue([]);

    const handler = postListEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.listPosts).toHaveBeenCalledWith(expectedFilters);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('should handle date filters', async () => {
    req.query = {
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    };

    const handler = postListEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    const callArgs = (mockService.listPosts as any).mock.calls[0][0];
    expect(callArgs).toMatchObject({
      startDate: expect.any(Date),
      endDate: expect.any(Date)
    });
  });

  it('should handle scripture filters', async () => {
    req.query = {
      'scripture.book': 'John',
      'scripture.chapter': '3',
      'scripture.verse': '16'
    };

    const expectedFilters: PostFilters = {
      authorizedIds: [], // Schema adds default empty array
      scripture: {
        book: 'John',
        chapter: 3,
        verse: 16
      }
    };

    mockService.listPosts = vi.fn().mockResolvedValue([]);

    const handler = postListEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.listPosts).toHaveBeenCalledWith(expectedFilters);
  });

  it('should handle authorized IDs from middleware', async () => {
    req.query = {};
    req['authorizedResourceIds'] = ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'];

    const expectedFilters: PostFilters = {
      authorizedIds: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002']
    };

    mockService.listPosts = vi.fn().mockResolvedValue([]);

    const handler = postListEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.listPosts).toHaveBeenCalledWith(expectedFilters);
  });

  it('should handle validation errors', async () => {
    req.query = {
      status: 'invalid-status'
    };

    const handler = postListEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.listPosts).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should return empty array when no posts found', async () => {
    mockService.listPosts = vi.fn().mockResolvedValue([]);

    const handler = postListEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});
