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
		it('should generate list key without filters', () => {
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:post:list');
			expect(next).toHaveBeenCalled();
		});

		it('should generate list key with single filter', () => {
			req['filters'] = { status: 'active' };
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			// Should include filter hash (8 characters)
			expect(req['key']).toMatch(/^test:post:list:[a-f0-9]{8}$/);
			expect(next).toHaveBeenCalled();
		});

		it('should generate list key with multiple filters', () => {
			req['filters'] = { status: 'active', category: 'tech', sort: 'date' };
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			// Should include filter hash (8 characters)
			expect(req['key']).toMatch(/^test:post:list:[a-f0-9]{8}$/);
			expect(next).toHaveBeenCalled();
		});

		it('should generate same key for same filters regardless of order', () => {
			req['filters'] = { status: 'active', category: 'tech' };
			const middleware1 = keyGenerator('post');
			middleware1(req as Request, res as Response, next);
			const key1 = req['key'];

			// Reset and try with different order
			req['key'] = undefined;
			req['filters'] = { category: 'tech', status: 'active' };
			const middleware2 = keyGenerator('post');
			middleware2(req as Request, res as Response, next);
			const key2 = req['key'];

			expect(key1).toBe(key2);
		});

		it('should generate different keys for different filters', () => {
			req['filters'] = { status: 'active' };
			const middleware1 = keyGenerator('post');
			middleware1(req as Request, res as Response, next);
			const key1 = req['key'];

			// Reset and try with different filters
			req['key'] = undefined;
			req['filters'] = { status: 'inactive' };
			const middleware2 = keyGenerator('post');
			middleware2(req as Request, res as Response, next);
			const key2 = req['key'];

			expect(key1).not.toBe(key2);
		});

		it('should generate list key for different resource types', () => {
			const middleware1 = keyGenerator('note');
			middleware1(req as Request, res as Response, next);
			const noteKey = req['key'];

			req['key'] = undefined;
			const middleware2 = keyGenerator('devotional');
			middleware2(req as Request, res as Response, next);
			const devotionalKey = req['key'];

			expect(noteKey).toBe('test:note:list');
			expect(devotionalKey).toBe('test:devotional:list');
		});

		it('should handle empty filters object', () => {
			req['filters'] = {};
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:post:list');
			expect(next).toHaveBeenCalled();
		});

		it('should handle undefined filters', () => {
			req['filters'] = undefined;
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:post:list');
			expect(next).toHaveBeenCalled();
		});

		it('should handle filters with null/undefined values', () => {
			req['filters'] = { status: 'active', deleted: undefined, archived: null };
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			// Should only hash non-null values
			expect(req['key']).toMatch(/^test:post:list:[a-f0-9]{8}$/);
			expect(next).toHaveBeenCalled();
		});

		it('should handle filters with array values', () => {
			req['filters'] = { tags: ['javascript', 'typescript'] };
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toMatch(/^test:post:list:[a-f0-9]{8}$/);
			expect(next).toHaveBeenCalled();
		});

		it('should handle filters with nested objects', () => {
			req['filters'] = {
				where: { status: 'active', author: { id: '123' } },
				orderBy: { createdAt: 'desc' }
			};
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toMatch(/^test:post:list:[a-f0-9]{8}$/);
			expect(next).toHaveBeenCalled();
		});
	});

	describe('single resource keys (isList = false)', () => {
		it('should generate single resource key', () => {
			req.params = { id: '789' };
			const middleware = keyGenerator('post', false, 'id');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:post:single:789');
			expect(next).toHaveBeenCalled();
		});

		it('should generate single resource key with custom param name', () => {
			req.params = { postId: 'abc123' };
			const middleware = keyGenerator('post', false, 'postId');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:post:single:abc123');
			expect(next).toHaveBeenCalled();
		});

		it('should generate single resource key for different resources', () => {
			req.params = { id: '456' };
			const middleware1 = keyGenerator('note', false, 'id');
			middleware1(req as Request, res as Response, next);
			const noteKey = req['key'];

			req['key'] = undefined;
			req.params = { mediaId: '789' };
			const middleware2 = keyGenerator('media', false, 'mediaId');
			middleware2(req as Request, res as Response, next);
			const mediaKey = req['key'];

			expect(noteKey).toBe('test:note:single:456');
			expect(mediaKey).toBe('test:media:single:789');
		});

		it('should handle IDs with special characters', () => {
			req.params = { id: 'user:123:note:456' };
			const middleware = keyGenerator('note', false, 'id');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:note:single:user:123:note:456');
			expect(next).toHaveBeenCalled();
		});

		it('should handle undefined param gracefully', () => {
			req.params = {};
			const middleware = keyGenerator('post', false, 'id');

			middleware(req as Request, res as Response, next);

			// Should not set key for undefined ID
			expect(req['key']).toBeUndefined();
			expect(next).toHaveBeenCalled();
		});

		it('should handle empty string param gracefully', () => {
			req.params = { id: '' };
			const middleware = keyGenerator('post', false, 'id');

			middleware(req as Request, res as Response, next);

			// Should not set key for empty ID
			expect(req['key']).toBeUndefined();
			expect(next).toHaveBeenCalled();
		});

		it('should handle whitespace in param', () => {
			req.params = { id: ' 789 ' };
			const middleware = keyGenerator('post', false, 'id');

			middleware(req as Request, res as Response, next);

			// Should trim whitespace
			expect(req['key']).toBe('test:post:single:789');
			expect(next).toHaveBeenCalled();
		});
	});

	describe('environment prefixing', () => {
		it('should prefix keys with development environment', () => {
			process.env.NODE_ENV = 'development';
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('development:post:list');
			expect(next).toHaveBeenCalled();
		});

		it('should prefix keys with production environment', () => {
			process.env.NODE_ENV = 'production';
			req.params = { id: '789' };
			const middleware = keyGenerator('post', false, 'id');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('production:post:single:789');
			expect(next).toHaveBeenCalled();
		});

		it('should prefix keys with staging environment', () => {
			process.env.NODE_ENV = 'staging';
			const middleware = keyGenerator('item');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('staging:item:list');
			expect(next).toHaveBeenCalled();
		});
	});

	describe('user context (no longer included in key)', () => {
		it('should generate same key with or without user for list', () => {
			const middleware1 = keyGenerator('post');
			middleware1(req as Request, res as Response, next);
			const keyWithoutUser = req['key'];

			req['key'] = undefined;
			req['user'] = [null, { payload: { sub: 'user-123' } }];
			const middleware2 = keyGenerator('post');
			middleware2(req as Request, res as Response, next);
			const keyWithUser = req['key'];

			// Keys should be identical - user is no longer part of cache key
			expect(keyWithoutUser).toBe(keyWithUser);
			expect(keyWithoutUser).toBe('test:post:list');
		});

		it('should generate same key with or without user for single resource', () => {
			req.params = { id: '789' };
			const middleware1 = keyGenerator('post', false, 'id');
			middleware1(req as Request, res as Response, next);
			const keyWithoutUser = req['key'];

			req['key'] = undefined;
			req['user'] = [null, { payload: { sub: 'user-456' } }];
			const middleware2 = keyGenerator('post', false, 'id');
			middleware2(req as Request, res as Response, next);
			const keyWithUser = req['key'];

			// Keys should be identical - user is no longer part of cache key
			expect(keyWithoutUser).toBe(keyWithUser);
			expect(keyWithoutUser).toBe('test:post:single:789');
		});
	});

	describe('ids array (no longer included in key)', () => {
		it('should generate same key regardless of ids array', () => {
			const middleware1 = keyGenerator('post');
			middleware1(req as Request, res as Response, next);
			const keyWithoutIds = req['key'];

			req['key'] = undefined;
			req['ids'] = ['123', '456', '789'];
			const middleware2 = keyGenerator('post');
			middleware2(req as Request, res as Response, next);
			const keyWithIds = req['key'];

			// Keys should be identical - ids are no longer part of cache key
			expect(keyWithoutIds).toBe(keyWithIds);
			expect(keyWithoutIds).toBe('test:post:list');
		});

		it('should handle empty ids array', () => {
			req['ids'] = [];
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:post:list');
			expect(next).toHaveBeenCalled();
		});

		it('should handle undefined ids array', () => {
			req['ids'] = undefined;
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:post:list');
			expect(next).toHaveBeenCalled();
		});
	});

	describe('resource name handling', () => {
		it('should handle resource names with hyphens', () => {
			const middleware = keyGenerator('daily-devotional');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:daily-devotional:list');
			expect(next).toHaveBeenCalled();
		});

		it('should handle resource names with underscores', () => {
			req.params = { id: '123' };
			const middleware = keyGenerator('user_profile', false, 'id');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:user_profile:single:123');
			expect(next).toHaveBeenCalled();
		});

		it('should handle resource names with mixed case', () => {
			const middleware = keyGenerator('BlogPost');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:BlogPost:list');
			expect(next).toHaveBeenCalled();
		});
	});

	describe('integration scenarios', () => {
		it('should generate consistent keys for common list fetch scenario', () => {
			req['filters'] = { status: 'published', limit: 10, offset: 0 };
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toMatch(/^test:post:list:[a-f0-9]{8}$/);
			expect(next).toHaveBeenCalled();
		});

		it('should generate consistent keys for common single resource fetch', () => {
			req.params = { id: 'uuid-123-456-789' };
			const middleware = keyGenerator('post', false, 'id');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBe('test:post:single:uuid-123-456-789');
			expect(next).toHaveBeenCalled();
		});

		it('should support chaining with other middleware', () => {
			const middleware = keyGenerator('post');

			middleware(req as Request, res as Response, next);

			expect(req['key']).toBeDefined();
			expect(next).toHaveBeenCalledTimes(1);
		});
	});
});