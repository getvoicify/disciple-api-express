import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextFunction, Request, Response} from 'express';
import {z} from 'zod';
import {extractFiltersMiddleware} from './extract-filters.middleware';

describe('extractFiltersMiddleware', () => {
	let req: Partial<Request>;
	let res: Partial<Response>;
	let next: NextFunction;
	let mockLogger: any;

	beforeEach(() => {
		mockLogger = {
			error: vi.fn(),
			warn: vi.fn(),
			info: vi.fn(),
			debug: vi.fn(),
		};

		req = {
			query: {},
			body: {},
			params: {},
			headers: {},
			log: mockLogger,
		};
		res = {};
		next = vi.fn();
	});

	describe('with query parameters (default)', () => {
		const TestSchema = z.object({
			status: z.string().optional(),
			count: z.coerce.number().optional(),
			tags: z.array(z.string()).optional(),
		});

		it('should extract valid query parameters as filters', async () => {
			req.query = { status: 'active', count: '5' };
			const middleware = extractFiltersMiddleware(TestSchema);

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toEqual({
				status: 'active',
				count: 5,
			});
			expect(next).toHaveBeenCalled();
		});

		it('should handle array values in query', async () => {
			req.query = { tags: ['javascript', 'typescript'] };
			const middleware = extractFiltersMiddleware(TestSchema);

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toEqual({
				tags: ['javascript', 'typescript'],
			});
			expect(next).toHaveBeenCalled();
		});

		it('should exclude null and undefined values', async () => {
			req.query = { status: 'active', count: null, tags: undefined };
			const middleware = extractFiltersMiddleware(TestSchema);

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toEqual({
				status: 'active',
			});
			expect(next).toHaveBeenCalled();
		});

		it('should exclude empty string values', async () => {
			req.query = { status: '', count: '10' };
			const middleware = extractFiltersMiddleware(TestSchema);

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toEqual({
				count: 10,
			});
			expect(next).toHaveBeenCalled();
		});

		it('should not set filters when no valid values exist', async () => {
			req.query = { status: '', count: null, tags: undefined };
			const middleware = extractFiltersMiddleware(TestSchema);

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toBeUndefined();
			expect(next).toHaveBeenCalled();
		});

		it('should handle empty query object', async () => {
			req.query = {};
			const middleware = extractFiltersMiddleware(TestSchema);

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toBeUndefined();
			expect(next).toHaveBeenCalled();
		});

		it('should log error and continue when schema validation fails', async () => {
			req.query = { status: 123 } as unknown as Request['query']; // Invalid: number instead of string
			const StrictSchema = z.object({
				status: z.string(),
			});
			const middleware = extractFiltersMiddleware(StrictSchema);

			await middleware(req as Request, res as Response, next);

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					error: expect.any(Error),
					requestKey: 'query'
				}),
				'Failed to parse request filters'
			);
			expect(req['filters']).toBeUndefined();
			expect(next).toHaveBeenCalled();
		});
	});

	describe('with body parameters', () => {
		const BodySchema = z.object({
			name: z.string(),
			age: z.number().optional(),
		});

		it('should extract body parameters when requestKey is "body"', async () => {
			req.body = { name: 'John', age: 25 };
			const middleware = extractFiltersMiddleware(BodySchema, 'body');

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toEqual({
				name: 'John',
				age: 25,
			});
			expect(next).toHaveBeenCalled();
		});

		it('should handle missing optional fields in body', async () => {
			req.body = { name: 'Jane' };
			const middleware = extractFiltersMiddleware(BodySchema, 'body');

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toEqual({
				name: 'Jane',
			});
			expect(next).toHaveBeenCalled();
		});
	});

	describe('with params', () => {
		const ParamsSchema = z.object({
			id: z.string(),
			version: z.string().optional(),
		});

		it('should extract params when requestKey is "params"', async () => {
			req.params = { id: '123', version: 'v2' };
			const middleware = extractFiltersMiddleware(ParamsSchema, 'params');

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toEqual({
				id: '123',
				version: 'v2',
			});
			expect(next).toHaveBeenCalled();
		});
	});

	describe('with headers', () => {
		const HeaderSchema = z.object({
			'x-api-key': z.string().optional(),
			'x-request-id': z.string().optional(),
		});

		it('should extract headers when requestKey is "headers"', async () => {
			req.headers = { 'x-api-key': 'secret123', 'x-request-id': 'req-456' };
			const middleware = extractFiltersMiddleware(HeaderSchema, 'headers');

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toEqual({
				'x-api-key': 'secret123',
				'x-request-id': 'req-456',
			});
			expect(next).toHaveBeenCalled();
		});
	});

	describe('complex schemas', () => {
		it('should handle date coercion', async () => {
			const DateSchema = z.object({
				startDate: z.coerce.date().optional(),
				endDate: z.coerce.date().optional(),
			});

			req.query = {
				startDate: '2024-01-01',
				endDate: '2024-12-31',
			};

			const middleware = extractFiltersMiddleware(DateSchema);

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toEqual({
				startDate: new Date('2024-01-01'),
				endDate: new Date('2024-12-31'),
			});
			expect(next).toHaveBeenCalled();
		});

		it('should handle nested objects', async () => {
			const NestedSchema = z.object({
				filter: z.object({
					status: z.string(),
					priority: z.number(),
				}).optional(),
			});

			req.query = {
				filter: {
					status: 'active',
					priority: 1,
				},
			} as unknown as Request['query'];

			const middleware = extractFiltersMiddleware(NestedSchema);

			await middleware(req as Request, res as Response, next);

			expect(req['filters']).toEqual({
				filter: {
					status: 'active',
					priority: 1,
				},
			});
			expect(next).toHaveBeenCalled();
		});
	});
});
