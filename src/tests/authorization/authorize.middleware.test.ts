import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResourceResolver } from '../../authorization/resolvers';
import type { ResourceType } from '../../authorization/types';

vi.mock('../../logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  },
}));

import { createAuthorizeMiddleware } from '../../authorization/authorize.middleware';

function createMockReq(userId?: string, params: Record<string, string> = {}, body: Record<string, string> = {}) {
  return {
    user: userId ? [undefined, { payload: { sub: userId } }] : undefined,
    params,
    body,
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('Authorize Middleware', () => {
  const mockResolvers: Record<ResourceType, ResourceResolver> = {
    post: vi.fn(),
    series: vi.fn(),
    gallery: vi.fn(),
    note: vi.fn(),
    church: vi.fn(),
  };
  const mockMemberLookup = vi.fn();
  let authorize: ReturnType<typeof createAuthorizeMiddleware>;

  beforeEach(() => {
    vi.clearAllMocks();
    authorize = createAuthorizeMiddleware(mockResolvers, mockMemberLookup);
  });

  it('should return 401 when user is not authenticated', async () => {
    const req = createMockReq(undefined);
    const res = createMockRes();
    const next = vi.fn();

    const middleware = authorize({ resource: 'post', action: 'create' });
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow create when user has correct church role', async () => {
    const req = createMockReq('user-1', {}, { churchId: 'church-1' });
    const res = createMockRes();
    const next = vi.fn();
    mockMemberLookup.mockResolvedValue('Owner');

    const middleware = authorize({ resource: 'post', action: 'create' });
    await middleware(req, res, next);

    expect(mockMemberLookup).toHaveBeenCalledWith('church-1', 'user-1');
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 when user lacks role for create', async () => {
    const req = createMockReq('user-1', {}, { churchId: 'church-1' });
    const res = createMockRes();
    const next = vi.fn();
    mockMemberLookup.mockResolvedValue('Member');

    const middleware = authorize({ resource: 'post', action: 'create' });
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow update when user is the author', async () => {
    const req = createMockReq('user-1', { id: 'post-1' });
    const res = createMockRes();
    const next = vi.fn();
    (mockResolvers.post as any).mockResolvedValue({ authorId: 'user-1', churchId: 'church-1' });
    mockMemberLookup.mockResolvedValue('Member');

    const middleware = authorize({ resource: 'post', action: 'update' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow update when user is Manager (non-author)', async () => {
    const req = createMockReq('user-2', { id: 'post-1' });
    const res = createMockRes();
    const next = vi.fn();
    (mockResolvers.post as any).mockResolvedValue({ authorId: 'user-1', churchId: 'church-1' });
    mockMemberLookup.mockResolvedValue('Manager');

    const middleware = authorize({ resource: 'post', action: 'update' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 404 when resource not found', async () => {
    const req = createMockReq('user-1', { id: 'nonexistent' });
    const res = createMockRes();
    const next = vi.fn();
    (mockResolvers.post as any).mockResolvedValue(null);

    const middleware = authorize({ resource: 'post', action: 'update' });
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow note owner to read their note', async () => {
    const req = createMockReq('user-1', { noteId: 'note-1' });
    const res = createMockRes();
    const next = vi.fn();
    (mockResolvers.note as any).mockResolvedValue({ ownerId: 'user-1' });

    const middleware = authorize({ resource: 'note', action: 'read' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should deny non-owner from reading note', async () => {
    const req = createMockReq('user-2', { noteId: 'note-1' });
    const res = createMockRes();
    const next = vi.fn();
    (mockResolvers.note as any).mockResolvedValue({ ownerId: 'user-1' });

    const middleware = authorize({ resource: 'note', action: 'read' });
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow note create for any authenticated user', async () => {
    const req = createMockReq('user-1');
    const res = createMockRes();
    const next = vi.fn();

    const middleware = authorize({ resource: 'note', action: 'create' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should use churchId from params when present', async () => {
    const req = createMockReq('user-1', { churchId: 'church-1' }, {});
    const res = createMockRes();
    const next = vi.fn();
    mockMemberLookup.mockResolvedValue('Owner');

    const middleware = authorize({ resource: 'post', action: 'create' });
    await middleware(req, res, next);

    expect(mockMemberLookup).toHaveBeenCalledWith('church-1', 'user-1');
    expect(next).toHaveBeenCalled();
  });
});
