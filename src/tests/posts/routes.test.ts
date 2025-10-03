import {describe, it, expect, vi, beforeEach, Mock} from 'vitest';
import type { Router } from 'express';
import { postRoutes } from '../../posts/routes';
import type { PostService } from '../../posts/service';
import type { SeriesService } from '../../series/service';

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

// Mock middleware
const mockAuthMiddleware = vi.fn((req, res, next) => next());
const mockRoleMiddleware = vi.fn((req, res, next) => next());

vi.mock('express', () => ({
  Router: () => mockRouter
}));

describe('Post Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register all routes with correct paths and methods', () => {
    const router = postRoutes(mockService, mockAuthMiddleware, mockSeriesService, mockRoleMiddleware);

    // Should return the router
    expect(router).toBe(mockRouter);

    // Should register POST /posts
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/',
      mockAuthMiddleware,
      expect.any(Function)
    );

    // Should register GET /posts with middleware
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/',
      mockRoleMiddleware,
      expect.any(Function)
    );

    // Should register GET /posts/:id
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/:id',
      expect.any(Function)
    );

    // Should register PATCH /posts/:id
    expect(mockRouter.patch).toHaveBeenCalledWith(
      '/:id',
      mockAuthMiddleware,
      expect.any(Function)
    );

    // Should register DELETE /posts/:id
    expect(mockRouter.delete).toHaveBeenCalledWith(
      '/:id',
      mockAuthMiddleware,
      expect.any(Function)
    );

    // Should register PATCH /posts/:id/publish
    expect(mockRouter.patch).toHaveBeenCalledWith(
      '/:id/publish',
      mockAuthMiddleware,
      expect.any(Function)
    );
  });

  it('should use role middleware for list endpoint', () => {
    postRoutes(mockService, mockAuthMiddleware, mockSeriesService, mockRoleMiddleware);

    // The GET /posts endpoint should use the role middleware
    const listCall = (mockRouter.get as Mock).mock.calls.find(
      call => call[0] === '/'
    );

    expect(listCall).toBeDefined();
    expect(listCall[1]).toBe(mockRoleMiddleware);
  });

  it('should protect modification endpoints with auth', () => {
    postRoutes(mockService, mockAuthMiddleware, mockSeriesService, mockRoleMiddleware);

    // POST /posts
    const createCall = (mockRouter.post as Mock).mock.calls[0];
    expect(createCall[1]).toBe(mockAuthMiddleware);

    // PATCH /posts/:id
    const updateCall = (mockRouter.patch as Mock).mock.calls.find(
      call => call[0] === '/:id'
    );
    expect(updateCall![1]).toBe(mockAuthMiddleware);

    // DELETE /posts/:id
    const deleteCall = (mockRouter.delete as Mock).mock.calls[0];
    expect(deleteCall[1]).toBe(mockAuthMiddleware);

    // PATCH /posts/:id/publish
    const publishCall = (mockRouter.patch as Mock).mock.calls.find(
      call => call[0] === '/:id/publish'
    );
    expect(publishCall![1]).toBe(mockAuthMiddleware);
  });
});
