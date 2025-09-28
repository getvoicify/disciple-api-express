import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { keyGenerator } from './key-generator.middleware';

describe('keyGenerator middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    req = {
      params: {},
      user: undefined,
    } as any as Request;
    res = {};
    next = vi.fn();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('list keys (isList = true)', () => {
    describe('without user', () => {
      it('should generate list key without ids', () => {
        const middleware = keyGenerator('posts');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:postslist:');
        expect(next).toHaveBeenCalled();
      });

      it('should generate list key with single id', () => {
        req['ids'] = ['123'];
        const middleware = keyGenerator('posts');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:postslist:123');
        expect(next).toHaveBeenCalled();
      });

      it('should generate list key with multiple ids', () => {
        req['ids'] = ['123', '456', '789'];
        const middleware = keyGenerator('posts');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:postslist:123-456-789');
        expect(next).toHaveBeenCalled();
      });
    });

    describe('with user', () => {
      beforeEach(() => {
        req['user'] = [null, { payload: { sub: 'user-123' } }];
      });

      it('should generate list key with user but without ids', () => {
        const middleware = keyGenerator('posts');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:postslist:user-123:');
        expect(next).toHaveBeenCalled();
      });

      it('should generate list key with user and single id', () => {
        req['ids'] = ['456'];
        const middleware = keyGenerator('posts');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:postslist:user-123:456');
        expect(next).toHaveBeenCalled();
      });

      it('should generate list key with user and multiple ids', () => {
        req['ids'] = ['456', '789', '012'];
        const middleware = keyGenerator('posts');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:postslist:user-123:456-789-012');
        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('single resource keys (isList = false)', () => {
    describe('without user', () => {
      it('should generate single resource key', () => {
        req.params = { id: '789' };
        const middleware = keyGenerator('post', false, 'id');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:post789');
        expect(next).toHaveBeenCalled();
      });

      it('should generate single resource key with custom param name', () => {
        req.params = { postId: 'abc123' };
        const middleware = keyGenerator('post', false, 'postId');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:postabc123');
        expect(next).toHaveBeenCalled();
      });
    });

    describe('with user', () => {
      beforeEach(() => {
        req['user'] = [null, { payload: { sub: 'user-456' } }];
      });

      it('should generate single resource key with user', () => {
        req.params = { id: '789' };
        const middleware = keyGenerator('post', false, 'id');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:post:user-456:789');
        expect(next).toHaveBeenCalled();
      });

      it('should generate single resource key with user and custom param', () => {
        req.params = { mediaId: 'xyz789' };
        const middleware = keyGenerator('media', false, 'mediaId');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:media:user-456:xyz789');
        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('environment prefixing', () => {
    it('should prefix keys with development environment', () => {
      process.env.NODE_ENV = 'development';
      req['ids'] = ['123'];
      const middleware = keyGenerator('posts');

      middleware(req as Request, res as Response, next);

      expect(req['key']).toBe('development:postslist:123');
      expect(next).toHaveBeenCalled();
    });

    it('should prefix keys with production environment', () => {
      process.env.NODE_ENV = 'production';
      req['user'] = [null, { payload: { sub: 'user-456' } }];
      req.params = { id: '789' };
      const middleware = keyGenerator('post', false, 'id');

      middleware(req as Request, res as Response, next);

      expect(req['key']).toBe('production:post:user-456:789');
      expect(next).toHaveBeenCalled();
    });

    it('should prefix keys with staging environment', () => {
      process.env.NODE_ENV = 'staging';
      const middleware = keyGenerator('items');

      middleware(req as Request, res as Response, next);

      expect(req['key']).toBe('staging:itemslist:');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined ids array gracefully', () => {
      req['ids'] = undefined;
      const middleware = keyGenerator('posts');

      middleware(req as Request, res as Response, next);

      expect(req['key']).toBe('test:postslist:');
      expect(next).toHaveBeenCalled();
    });

    it('should handle empty ids array', () => {
      req['ids'] = [];
      const middleware = keyGenerator('posts');

      middleware(req as Request, res as Response, next);

      expect(req['key']).toBe('test:postslist:');
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing user payload', () => {
      req['user'] = [null, {}];
      const middleware = keyGenerator('posts');

      middleware(req as Request, res as Response, next);

      expect(req['key']).toBe('test:postslist:');
      expect(next).toHaveBeenCalled();
    });

    it('should handle undefined param for single resource', () => {
      req.params = {};
      const middleware = keyGenerator('post', false, 'id');

      middleware(req as Request, res as Response, next);

      expect(req['key']).toBe('test:postundefined');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('refactored implementation tests', () => {
    describe('should use builder pattern for key construction', () => {
      it('should build list key step by step', () => {
        req['user'] = [null, { payload: { sub: 'user-999' } }];
        req['ids'] = ['a', 'b', 'c'];
        const middleware = keyGenerator('items');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:itemslist:user-999:a-b-c');
      });
    });

    describe('should extract helper methods', () => {
      it('should properly extract user id', () => {
        req['user'] = [null, { payload: { sub: 'extracted-user' } }];
        const middleware = keyGenerator('resource');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toContain('extracted-user');
      });

      it('should properly format ids list', () => {
        req['ids'] = ['first', 'second', 'third'];
        const middleware = keyGenerator('resource');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toContain('first-second-third');
      });
    });

    describe('should use consistent separator patterns', () => {
      it('should use colon separator consistently', () => {
        req['user'] = [null, { payload: { sub: 'user123' } }];
        req.params = { id: 'resource456' };
        const middleware = keyGenerator('item', false, 'id');

        middleware(req as Request, res as Response, next);

        expect(req['key']).toBe('test:item:user123:resource456');
        expect(req['key'].split(':').length).toBe(4);
      });
    });
  });
});
