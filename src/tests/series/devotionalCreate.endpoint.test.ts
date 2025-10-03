import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Response} from 'express';
import {devotionalCreateEndpoint} from '../../series/routes/devotionalCreate.endpoint';
import type {SeriesService} from '../../series/service';

// Mock service
const mockService = {
  createSeries: vi.fn()
} as unknown as SeriesService;

describe('POST /devotional - Create Devotional Endpoint', () => {
  let req: any;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      body: {},
      user: [null, { payload: { sub: '550e8400-e29b-41d4-a716-446655440001' } }]
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
  });

  it('should create a devotional successfully and return 201', async () => {
    const input = {
      title: 'Morning Devotional Series',
      description: 'Daily morning reflections',
      churchId: '550e8400-e29b-41d4-a716-446655440002'
    };

    const createdSeries = {
      id: '550e8400-e29b-41d4-a716-446655440003',
      title: input.title,
      description: input.description,
      churchId: input.churchId,
      authorId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'draft' as const,
      image: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    req.body = input;
    mockService.createSeries = vi.fn().mockResolvedValue(createdSeries);

    const handler = devotionalCreateEndpoint(mockService);
    await handler(req, res as Response);

    expect(mockService.createSeries).toHaveBeenCalledWith(
      expect.objectContaining(input),
      '550e8400-e29b-41d4-a716-446655440001'
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      series: createdSeries,
      success: true
    });
  });

  it('should return 401 when user is not authenticated', async () => {
    req.user = undefined;

    const handler = devotionalCreateEndpoint(mockService);
    await handler(req, res as Response);

    expect(mockService.createSeries).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User authentication required',
      success: false
    });
  });

  it('should return 400 when service throws an error', async () => {
    req.body = {
      title: 'Morning Devotional Series',
      description: 'Daily morning reflections',
      churchId: '550e8400-e29b-41d4-a716-446655440002'
    };
    mockService.createSeries = vi.fn().mockRejectedValue(new Error('Church not found'));

    const handler = devotionalCreateEndpoint(mockService);
    await handler(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Church not found',
      success: false
    });
  });

  it('should validate input with CreateSeriesInput schema', async () => {
    const input = {
      title: 'Valid Title',
      description: 'Valid description',
      churchId: '550e8400-e29b-41d4-a716-446655440002',
      image: 'https://example.com/image.jpg'
    };

    req.body = input;
    mockService.createSeries = vi.fn().mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440003',
      ...input,
      authorId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'draft' as const,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const handler = devotionalCreateEndpoint(mockService);
    await handler(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockService.createSeries).toHaveBeenCalled();
  });
});
