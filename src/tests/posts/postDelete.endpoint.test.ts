import {describe, it, expect, vi, beforeEach} from 'vitest';
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

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {
        id: '550e8400-e29b-41d4-a716-446655440001'
      },
      user: [
        undefined,
        {
          payload: {
            sub: '550e8400-e29b-41d4-a716-446655440002'
          }
        }
      ]
    } as unknown as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
  });

  it('should delete a post successfully', async () => {
    mockService.deletePost = vi.fn().mockResolvedValue(undefined);

    const handler = postDeleteEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.deletePost).toHaveBeenCalledWith(req.params!.id, req['user']![1].payload.sub);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Post deleted successfully'
    });
  });

  it('should handle post not found error', async () => {
    mockService.deletePost = vi.fn().mockRejectedValue(
      new PostNotFoundError(req.params!.id)
    );

    const handler = postDeleteEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.deletePost).toHaveBeenCalledWith(req.params!.id, req['user']![1].payload.sub);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: `Post with identifier '${req.params!.id}' not found`,
      success: false
    });
  });

  it('should handle unauthorized error', async () => {
    mockService.deletePost = vi.fn().mockRejectedValue(
      new PostUnauthorizedError('delete', req.params!.id)
    );

    const handler = postDeleteEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('delete'),
      success: false
    });
  });

  it('should handle invalid UUID', async () => {
    req.params = { id: 'invalid-uuid' };

    const handler = postDeleteEndpoint(mockService);

    // Validation returns 400 error on invalid UUID
    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.any(String),
      success: false,
    });
    expect(mockService.deletePost).not.toHaveBeenCalled();
  });

  it('should handle missing user context', async () => {
    req['user'] = undefined;

    const handler = postDeleteEndpoint(mockService);
    await handler(req as Request, res as Response);

    expect(mockService.deletePost).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User authentication required',
      success: false
    });
  });
});
