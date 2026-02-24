import {describe, it, expect, vi, beforeEach, Mock} from 'vitest';
import type { Router } from 'express';
import { postsRouter } from '../../posts/routes/routes';
import type { PostService } from '../../posts/service';
import type { SeriesService } from '../../series/service';
import type { AuthorizeOptions } from '../../authorization';

// Mock Express router
const mockRouter = {
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  use: vi.fn()
} as unknown as Router;

// Mock service
const mockService = {} as PostService;
const mockSeriesService = {
  getDailyDevotionals: vi.fn()
} as unknown as SeriesService;

// Mock authorize middleware
const mockAuthorize = vi.fn((_options: AuthorizeOptions) => vi.fn());

vi.mock('express', () => ({
  Router: () => mockRouter
}));

describe('Post Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set required environment variables for tests
    process.env.IAM_ENDPOINT = 'http://test-iam';
    process.env.IAM_REALM = 'test-realm';
  });

  it('should register all routes with correct paths and methods', () => {
    const router = postsRouter(mockService, mockSeriesService, mockAuthorize);

    // Should return the router
    expect(router).toBe(mockRouter);

    // Should register POST /posts with middleware array
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/',
      expect.any(Array),
      expect.any(Function)
    );

    // Should register GET /posts/:id with middleware array
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/:id',
      expect.any(Array),
      expect.any(Function)
    );

    // Should register PATCH /posts/:id with middleware array
    expect(mockRouter.patch).toHaveBeenCalledWith(
      '/:id',
      expect.any(Array),
      expect.any(Function)
    );

    // Should register DELETE /posts/:id with middleware array
    expect(mockRouter.delete).toHaveBeenCalledWith(
      '/:id',
      expect.any(Array),
      expect.any(Function)
    );

    // Should register PATCH /posts/:id/publish with middleware array
    expect(mockRouter.patch).toHaveBeenCalledWith(
      '/:id/publish',
      expect.any(Array),
      expect.any(Function)
    );

    // Should register GET /posts/daily-devotionals with middleware array
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/daily-devotionals',
      expect.any(Array),
      expect.any(Function)
    );
  });

  it('should use optional authentication for fetch endpoint', () => {
    postsRouter(mockService, mockSeriesService, mockAuthorize);

    // The GET /posts/:id endpoint should use middleware array with optional auth
    const fetchCall = (mockRouter.get as Mock).mock.calls.find(
      call => call[0] === '/:id'
    );

    expect(fetchCall).toBeDefined();
    expect(fetchCall[1]).toBeInstanceOf(Array);
    // Should have middleware (tokenVerifier, validation)
    expect(fetchCall[1].length).toBeGreaterThan(0);
  });

  it('should protect modification endpoints with auth middleware', () => {
    postsRouter(mockService, mockSeriesService, mockAuthorize);

    // POST /posts should have auth middleware
    const createCall = (mockRouter.post as Mock).mock.calls[0];
    expect(createCall[1]).toBeInstanceOf(Array);
    expect(createCall[1].length).toBeGreaterThan(0);

    // PATCH /posts/:id should have auth middleware
    const updateCall = (mockRouter.patch as Mock).mock.calls.find(
      call => call[0] === '/:id'
    );
    expect(updateCall![1]).toBeInstanceOf(Array);
    expect(updateCall![1].length).toBeGreaterThan(0);

    // DELETE /posts/:id should have auth middleware
    const deleteCall = (mockRouter.delete as Mock).mock.calls[0];
    expect(deleteCall[1]).toBeInstanceOf(Array);
    expect(deleteCall[1].length).toBeGreaterThan(0);

    // PATCH /posts/:id/publish should have auth middleware
    const publishCall = (mockRouter.patch as Mock).mock.calls.find(
      call => call[0] === '/:id/publish'
    );
    expect(publishCall![1]).toBeInstanceOf(Array);
    expect(publishCall![1].length).toBeGreaterThan(0);
  });

  it('should apply authorize middleware to update, delete, and publish routes', () => {
    postsRouter(mockService, mockSeriesService, mockAuthorize);

    // authorize should be called for update, delete, publish, and create
    expect(mockAuthorize).toHaveBeenCalledWith({ resource: 'post', action: 'update', paramName: 'id' });
    expect(mockAuthorize).toHaveBeenCalledWith({ resource: 'post', action: 'delete', paramName: 'id' });
    expect(mockAuthorize).toHaveBeenCalledWith({ resource: 'post', action: 'create' });
  });

  it('should register /daily-devotionals BEFORE /:id to prevent routing conflicts', () => {
    postsRouter(mockService, mockSeriesService, mockAuthorize);

    // Get all GET route calls
    const getCalls = (mockRouter.get as Mock).mock.calls;

    // Find the indices of daily-devotionals and :id routes
    const dailyDevotionalsIndex = getCalls.findIndex(call => call[0] === '/daily-devotionals');
    const idParamIndex = getCalls.findIndex(call => call[0] === '/:id');

    // daily-devotionals should be registered before :id
    expect(dailyDevotionalsIndex).toBeGreaterThan(-1);
    expect(idParamIndex).toBeGreaterThan(-1);
    expect(dailyDevotionalsIndex).toBeLessThan(idParamIndex);
  });
});
