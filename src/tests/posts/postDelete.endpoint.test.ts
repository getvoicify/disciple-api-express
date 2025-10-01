import {describe, it, expect, vi, beforeEach, Mock} from 'vitest';
import type { Request, Response } from 'express';
import { postDeleteEndpoint } from '../../posts/routes/postDelete.endpoint';
import type { PostService } from '../../posts/service';
import { PostNotFoundError, PostUnauthorizedError } from '../../posts/errors';

// Mock service
const mockService = {
  deletePost: vi.fn()
} as unknown as PostService;

describe('DELETE /posts/:id - Delete Post Endpoint', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {
        id: '550e8400-e29b-41d4-a716-446655440001'
      },
      user: {
        id: '550e8400-e29b-41d4-a716-446655440002'
      }
    } as unknown as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    next = vi.fn();
  });

  it('should delete a post successfully', async () => {
    mockService.deletePost = vi.fn().mockResolvedValue(undefined);

    const handler = postDeleteEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.deletePost).toHaveBeenCalledWith(req.params!.id, req['user']!.id);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.json).toHaveBeenCalledWith({ message: 'Post deleted successfully' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle post not found error', async () => {
    mockService.deletePost = vi.fn().mockRejectedValue(
      new PostNotFoundError(req.params!.id)
    );

    const handler = postDeleteEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.deletePost).toHaveBeenCalledWith(req.params!.id, req['user']!.id);
    expect(next).toHaveBeenCalledWith(expect.any(PostNotFoundError));
  });

  it('should handle unauthorized error', async () => {
    mockService.deletePost = vi.fn().mockRejectedValue(
      new PostUnauthorizedError('delete', req.params!.id)
    );

    const handler = postDeleteEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(PostUnauthorizedError));
  });

  it('should handle invalid UUID', async () => {
    req.params = { id: 'invalid-uuid' };

    const handler = postDeleteEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.deletePost).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle missing user context', async () => {
    req['user'] = undefined;

    const handler = postDeleteEndpoint(mockService);
    await handler(req as Request, res as Response, next);

    expect(mockService.deletePost).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
