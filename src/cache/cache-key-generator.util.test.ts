import { describe, it, expect } from 'vitest';
import { generateCacheKey, CacheKeyType } from './cache-key-generator.util';

describe('generateCacheKey', () => {
	const mockEnv = 'test';

	describe('list keys without filters', () => {
		it('should generate list key for notes', () => {
			const key = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST);
			expect(key).toBe('test:note:list');
		});

		it('should generate list key for posts', () => {
			const key = generateCacheKey(mockEnv, 'post', CacheKeyType.LIST);
			expect(key).toBe('test:post:list');
		});

		it('should generate list key for devotionals', () => {
			const key = generateCacheKey(mockEnv, 'devotional', CacheKeyType.LIST);
			expect(key).toBe('test:devotional:list');
		});
	});

	describe('list keys with filters', () => {
		it('should generate list key with filter hash', () => {
			const filters = { status: 'active', limit: 10 };
			const key = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, filters);

			expect(key).toMatch(/^test:note:list:[a-f0-9]{8}$/);
		});

		it('should generate same hash for same filters', () => {
			const filters = { status: 'active', limit: 10 };
			const key1 = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, filters);
			const key2 = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, filters);

			expect(key1).toBe(key2);
		});

		it('should generate different hash for different filters', () => {
			const filters1 = { status: 'active', limit: 10 };
			const filters2 = { status: 'inactive', limit: 20 };
			const key1 = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, filters1);
			const key2 = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, filters2);

			expect(key1).not.toBe(key2);
		});

		it('should generate same hash regardless of filter property order', () => {
			const filters1 = { status: 'active', limit: 10, offset: 0 };
			const filters2 = { offset: 0, status: 'active', limit: 10 };
			const key1 = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, filters1);
			const key2 = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, filters2);

			expect(key1).toBe(key2);
		});

		it('should handle empty filter object as no filters', () => {
			const key = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, {});
			expect(key).toBe('test:note:list');
		});

		it('should handle complex nested filters', () => {
			const filters = {
				where: { status: 'active', author: { id: '123' } },
				orderBy: { createdAt: 'desc' },
				pagination: { limit: 10, offset: 0 }
			};
			const key = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, filters);

			expect(key).toMatch(/^test:note:list:[a-f0-9]{8}$/);
		});
	});

	describe('single resource keys', () => {
		it('should generate single key with ID', () => {
			const key = generateCacheKey(mockEnv, 'note', CacheKeyType.SINGLE, 'uuid-123');
			expect(key).toBe('test:note:single:uuid-123');
		});

		it('should generate single key for different resource types', () => {
			const noteKey = generateCacheKey(mockEnv, 'note', CacheKeyType.SINGLE, 'abc-123');
			const postKey = generateCacheKey(mockEnv, 'post', CacheKeyType.SINGLE, 'def-456');

			expect(noteKey).toBe('test:note:single:abc-123');
			expect(postKey).toBe('test:post:single:def-456');
		});

		it('should throw error if ID is missing for single key', () => {
			expect(() => {
				generateCacheKey(mockEnv, 'note', CacheKeyType.SINGLE);
			}).toThrow('ID is required for SINGLE cache key type');
		});

		it('should handle IDs with special characters', () => {
			const key = generateCacheKey(mockEnv, 'note', CacheKeyType.SINGLE, 'user:123:note:456');
			expect(key).toBe('test:note:single:user:123:note:456');
		});
	});

	describe('environment prefix', () => {
		it('should include environment in key', () => {
			const prodKey = generateCacheKey('prod', 'note', CacheKeyType.LIST);
			const stagingKey = generateCacheKey('staging', 'note', CacheKeyType.LIST);
			const devKey = generateCacheKey('dev', 'note', CacheKeyType.LIST);

			expect(prodKey).toBe('prod:note:list');
			expect(stagingKey).toBe('staging:note:list');
			expect(devKey).toBe('dev:note:list');
		});

		it('should generate different keys for same resource in different environments', () => {
			const prodKey = generateCacheKey('prod', 'note', CacheKeyType.LIST);
			const devKey = generateCacheKey('dev', 'note', CacheKeyType.LIST);

			expect(prodKey).not.toBe(devKey);
		});
	});

	describe('resource types', () => {
		it('should generate different keys for different resources', () => {
			const noteKey = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST);
			const postKey = generateCacheKey(mockEnv, 'post', CacheKeyType.LIST);
			const userKey = generateCacheKey(mockEnv, 'user', CacheKeyType.LIST);

			expect(noteKey).toBe('test:note:list');
			expect(postKey).toBe('test:post:list');
			expect(userKey).toBe('test:user:list');
		});

		it('should handle resource names with hyphens', () => {
			const key = generateCacheKey(mockEnv, 'daily-devotional', CacheKeyType.LIST);
			expect(key).toBe('test:daily-devotional:list');
		});

		it('should handle resource names with underscores', () => {
			const key = generateCacheKey(mockEnv, 'user_profile', CacheKeyType.LIST);
			expect(key).toBe('test:user_profile:list');
		});
	});

	describe('edge cases', () => {
		it('should handle undefined filters as no filters', () => {
			const key = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, undefined);
			expect(key).toBe('test:note:list');
		});

		it('should handle null filters as no filters', () => {
			const key = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, null as any);
			expect(key).toBe('test:note:list');
		});

		it('should trim whitespace from environment', () => {
			const key = generateCacheKey(' prod ', 'note', CacheKeyType.LIST);
			expect(key).toBe('prod:note:list');
		});

		it('should trim whitespace from resource', () => {
			const key = generateCacheKey(mockEnv, ' note ', CacheKeyType.LIST);
			expect(key).toBe('test:note:list');
		});

		it('should trim whitespace from ID', () => {
			const key = generateCacheKey(mockEnv, 'note', CacheKeyType.SINGLE, ' uuid-123 ');
			expect(key).toBe('test:note:single:uuid-123');
		});
	});

	describe('integration with hashFilters', () => {
		it('should use hashFilters for filter hash generation', () => {
			const filters = { status: 'active' };
			const key = generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, filters);

			// The hash should be 8 characters (from hashFilters implementation)
			const parts = key.split(':');
			expect(parts[3]).toHaveLength(8);
		});

		it('should produce consistent hashes across multiple calls', () => {
			const filters = { status: 'active', limit: 10 };
			const keys = Array.from({ length: 100 }, () =>
				generateCacheKey(mockEnv, 'note', CacheKeyType.LIST, undefined, filters)
			);

			const uniqueKeys = new Set(keys);
			expect(uniqueKeys.size).toBe(1);
		});
	});
});