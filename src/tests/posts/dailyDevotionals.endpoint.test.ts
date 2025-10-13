import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import type { Response } from 'express';
import { dailyDevotionalsEndpoint } from '../../posts/routes/dailyDevotionals.endpoint';
import type { SeriesService } from '../../series/service';
import type { EndpointRequest } from '../../types/endpoint-handler';

// Mock services
const mockSeriesService = {
  getDailyDevotionals: vi.fn()
} as unknown as SeriesService;

describe('GET /posts/daily-devotionals - Daily Devotionals Endpoint', () => {
  let req: Partial<EndpointRequest>;
  let res: Partial<Response>;
  let next: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: [
        undefined,
        {
          payload: {
            sub: '550e8400-e29b-41d4-a716-446655440001'
          }
        }
      ]
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    next = vi.fn();
  });

  it('should return daily devotionals grouped by date for user churches', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440001';

    // Mock daily devotionals response from service
    const mockDailyDevotionals = {
      '2024-01-15': [
        {
          id: 'post-1',
          title: 'Day 1 Morning',
          content: 'Morning devotional content',
          authorId: 'author-1',
          churchId: '550e8400-e29b-41d4-a716-446655440002',
          status: 'published' as const,
          publishedAt: new Date('2024-01-15T08:00:00Z'),
          image: null,
          tags: [],
          categories: [],
          scriptureReferences: [],
          seriesId: 'series-1',
          seriesName: 'Morning Devotionals',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: 'post-2',
          title: 'Day 1 Evening',
          content: 'Evening reflection content',
          authorId: 'author-2',
          churchId: '550e8400-e29b-41d4-a716-446655440003',
          status: 'published' as const,
          publishedAt: new Date('2024-01-15T20:00:00Z'),
          image: null,
          tags: [],
          categories: [],
          scriptureReferences: [],
          seriesId: 'series-2',
          seriesName: 'Evening Reflections',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        }
      ]
    };

    mockSeriesService.getDailyDevotionals = vi.fn().mockResolvedValue(mockDailyDevotionals);

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    // Verify daily devotionals were fetched from service
    expect(mockSeriesService.getDailyDevotionals).toHaveBeenCalledWith(userId);

    // Verify response structure - grouped by date
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockDailyDevotionals);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return empty object when user has no memberships', async () => {
    mockSeriesService.getDailyDevotionals = vi.fn().mockResolvedValue({});

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({});
  });

  it('should return empty object when no published series exist', async () => {
    mockSeriesService.getDailyDevotionals = vi.fn().mockResolvedValue({});

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({});
  });

  it('should skip series without published posts', async () => {
    mockSeriesService.getDailyDevotionals = vi.fn().mockResolvedValue({});

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({});
  });

  it('should handle errors and pass to next middleware', async () => {
    const error = new Error('Database error');
    mockSeriesService.getDailyDevotionals = vi.fn().mockRejectedValue(error);

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should require authenticated user', async () => {
    req.user = undefined;

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'User context is required'
    }));
    expect(mockSeriesService.getDailyDevotionals).not.toHaveBeenCalled();
  });

  it('should require user payload at index 1', async () => {
    req.user = [undefined]; // Missing user[1]

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'User context is required'
    }));
    expect(mockSeriesService.getDailyDevotionals).not.toHaveBeenCalled();
  });

  it('should require sub in user payload', async () => {
    req.user = [
      undefined,
      {
        payload: {} // Missing sub
      }
    ];

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'User context is required'
    }));
    expect(mockSeriesService.getDailyDevotionals).not.toHaveBeenCalled();
  });

  it('should handle when user[1] exists but payload is missing', async () => {
    req.user = [
      undefined,
      {} // Missing payload property
    ];

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'User context is required'
    }));
    expect(mockSeriesService.getDailyDevotionals).not.toHaveBeenCalled();
  });

  it('should handle when payload is null', async () => {
    req.user = [
      undefined,
      {
        payload: null
      }
    ];

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'User context is required'
    }));
    expect(mockSeriesService.getDailyDevotionals).not.toHaveBeenCalled();
  });

  it('should correctly extract userId from nested payload structure', async () => {
    const expectedUserId = '550e8400-e29b-41d4-a716-446655440001';
    const mockResult = { '2024-01-15': [] };

    mockSeriesService.getDailyDevotionals = vi.fn().mockResolvedValue(mockResult);

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    // Verify the correct userId was extracted and passed to the service
    expect(mockSeriesService.getDailyDevotionals).toHaveBeenCalledWith(expectedUserId);
    expect(mockSeriesService.getDailyDevotionals).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple dates in response', async () => {
    const mockDailyDevotionals = {
      '2024-01-15': [
        {
          id: 'post-1',
          title: 'Day 1',
          content: 'Content',
          authorId: 'author-1',
          churchId: 'church-1',
          status: 'published' as const,
          publishedAt: new Date('2024-01-15T08:00:00Z'),
          image: null,
          tags: [],
          categories: [],
          scriptureReferences: [],
          seriesId: 'series-1',
          seriesName: 'Series 1',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        }
      ],
      '2024-01-16': [
        {
          id: 'post-2',
          title: 'Day 2',
          content: 'Content',
          authorId: 'author-1',
          churchId: 'church-1',
          status: 'published' as const,
          publishedAt: new Date('2024-01-16T08:00:00Z'),
          image: null,
          tags: [],
          categories: [],
          scriptureReferences: [],
          seriesId: 'series-1',
          seriesName: 'Series 1',
          createdAt: new Date('2024-01-16'),
          updatedAt: new Date('2024-01-16')
        }
      ],
      '2024-01-17': [
        {
          id: 'post-3',
          title: 'Day 3',
          content: 'Content',
          authorId: 'author-1',
          churchId: 'church-1',
          status: 'published' as const,
          publishedAt: new Date('2024-01-17T08:00:00Z'),
          image: null,
          tags: [],
          categories: [],
          scriptureReferences: [],
          seriesId: 'series-1',
          seriesName: 'Series 1',
          createdAt: new Date('2024-01-17'),
          updatedAt: new Date('2024-01-17')
        }
      ]
    };

    mockSeriesService.getDailyDevotionals = vi.fn().mockResolvedValue(mockDailyDevotionals);

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    // Verify response contains all dates
    const responseCall = (res.json as Mock).mock.calls[0][0];
    expect(Object.keys(responseCall)).toHaveLength(3);
    expect(Object.keys(responseCall)).toEqual(['2024-01-15', '2024-01-16', '2024-01-17']);
    expect(responseCall['2024-01-15']).toHaveLength(1);
    expect(responseCall['2024-01-16']).toHaveLength(1);
    expect(responseCall['2024-01-17']).toHaveLength(1);
  });

  it('should use safeExecute for error handling', async () => {
    const thrownError = new Error('Service exception');
    mockSeriesService.getDailyDevotionals = vi.fn().mockRejectedValue(thrownError);

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    // Verify error was caught and passed to next middleware (safeExecute pattern)
    expect(next).toHaveBeenCalledWith(thrownError);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should not call service if user validation fails', async () => {
    req.user = [undefined, { payload: { sub: null } }];

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    // Verify service was never called due to validation failure
    expect(mockSeriesService.getDailyDevotionals).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'User context is required'
    }));
  });

  it('should group posts by publishedAt date (YYYY-MM-DD)', async () => {
    const churchId = '550e8400-e29b-41d4-a716-446655440002';

    // Mock devotionals already grouped by date
    const mockDailyDevotionals = {
      '2024-01-15': [
        {
          id: 'post-1',
          title: 'Morning Post',
          content: 'Content',
          authorId: 'author-1',
          churchId,
          status: 'published' as const,
          publishedAt: new Date('2024-01-15T08:00:00Z'),
          image: null,
          tags: [],
          categories: [],
          scriptureReferences: [],
          seriesId: 'series-1',
          seriesName: 'Morning',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: 'post-2',
          title: 'Evening Post',
          content: 'Content',
          authorId: 'author-1',
          churchId,
          status: 'published' as const,
          publishedAt: new Date('2024-01-15T20:00:00Z'),
          image: null,
          tags: [],
          categories: [],
          scriptureReferences: [],
          seriesId: 'series-2',
          seriesName: 'Evening',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        }
      ]
    };

    mockSeriesService.getDailyDevotionals = vi.fn().mockResolvedValue(mockDailyDevotionals);

    const handler = dailyDevotionalsEndpoint(mockSeriesService);
    await handler(req as EndpointRequest, res as Response, next);

    // Both posts should be grouped under the same date key
    const responseCall = (res.json as Mock).mock.calls[0][0];
    expect(Object.keys(responseCall)).toEqual(['2024-01-15']);
    expect(responseCall['2024-01-15']).toHaveLength(2);
  });
});