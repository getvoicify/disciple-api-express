import { describe, it, expect } from 'vitest';
import { hashFilters } from './cache-key-hash.util';

describe('hashFilters', () => {
	it('should generate consistent hash for same object', () => {
		const filters = { title: 'sermon', book: 'John', chapter: 3 };
		const hash1 = hashFilters(filters);
		const hash2 = hashFilters(filters);

		expect(hash1).toBe(hash2);
		expect(hash1).toBeTruthy();
		expect(typeof hash1).toBe('string');
	});

	it('should generate different hashes for different objects', () => {
		const filters1 = { title: 'sermon', book: 'John' };
		const filters2 = { title: 'prayer', book: 'John' };

		const hash1 = hashFilters(filters1);
		const hash2 = hashFilters(filters2);

		expect(hash1).not.toBe(hash2);
	});

	it('should handle empty object', () => {
		const hash = hashFilters({});

		expect(hash).toBeTruthy();
		expect(typeof hash).toBe('string');
	});

	it('should generate consistent hash for nested objects', () => {
		const filters = {
			scripture: {
				book: 'John',
				chapter: 3,
				verse: 16
			},
			status: 'published'
		};

		const hash1 = hashFilters(filters);
		const hash2 = hashFilters(filters);

		expect(hash1).toBe(hash2);
	});

	it('should handle arrays in objects consistently', () => {
		const filters1 = { tags: ['prayer', 'worship'], status: 'published' };
		const filters2 = { tags: ['prayer', 'worship'], status: 'published' };

		const hash1 = hashFilters(filters1);
		const hash2 = hashFilters(filters2);

		expect(hash1).toBe(hash2);
	});

	it('should handle null values', () => {
		const filters = { title: 'sermon', content: null, book: 'John' };

		const hash = hashFilters(filters);

		expect(hash).toBeTruthy();
		expect(typeof hash).toBe('string');
	});

	it('should handle undefined values', () => {
		const filters = { title: 'sermon', content: undefined, book: 'John' };

		const hash = hashFilters(filters);

		expect(hash).toBeTruthy();
		expect(typeof hash).toBe('string');
	});

	it('should produce same hash regardless of key order', () => {
		const filters1 = { title: 'sermon', book: 'John', chapter: 3 };
		const filters2 = { chapter: 3, book: 'John', title: 'sermon' };

		const hash1 = hashFilters(filters1);
		const hash2 = hashFilters(filters2);

		expect(hash1).toBe(hash2);
	});

	it('should produce short hash suitable for cache keys', () => {
		const filters = {
			title: 'sermon',
			book: 'John',
			chapter: 3,
			verse: 16,
			status: 'published',
			tags: ['prayer', 'worship']
		};

		const hash = hashFilters(filters);

		// Hash should be reasonably short (e.g., first 8-10 chars of a hash)
		expect(hash.length).toBeLessThanOrEqual(16);
		expect(hash.length).toBeGreaterThanOrEqual(6);
	});

	it('should produce different hashes for different array orders', () => {
		const filters1 = { tags: ['prayer', 'worship'] };
		const filters2 = { tags: ['worship', 'prayer'] };

		const hash1 = hashFilters(filters1);
		const hash2 = hashFilters(filters2);

		expect(hash1).not.toBe(hash2);
	});

	it('should produce different hashes for different types', () => {
		const filters1 = { count: 3 };
		const filters2 = { count: '3' };

		const hash1 = hashFilters(filters1);
		const hash2 = hashFilters(filters2);

		expect(hash1).not.toBe(hash2);
	});

	it('should handle deeply nested objects', () => {
		const filters = {
			level1: {
				level2: {
					level3: {
						level4: { value: 'deep' }
					}
				}
			}
		};

		const hash1 = hashFilters(filters);
		const hash2 = hashFilters(filters);

		expect(hash1).toBe(hash2);
		expect(hash1).toBeTruthy();
	});

	it('should handle special characters in values', () => {
		const filters = {
			title: 'Sermon: "Love & Faith"',
			content: 'Line 1\nLine 2\tTabbed',
			unicode: '❤️ 中文 🙏'
		};

		const hash = hashFilters(filters);

		expect(hash).toBeTruthy();
		expect(typeof hash).toBe('string');
	});

	it('should handle large objects efficiently', () => {
		const filters: Record<string, any> = {};
		for (let i = 0; i < 100; i++) {
			filters[`key${i}`] = `value${i}`;
		}

		const hash = hashFilters(filters);

		expect(hash).toBeTruthy();
		expect(hash.length).toBeLessThanOrEqual(16);
	});

	it('should handle boolean and numeric edge cases', () => {
		const filters1 = { active: true, count: 0, score: -1 };
		const filters2 = { active: false, count: 0, score: -1 };

		const hash1 = hashFilters(filters1);
		const hash2 = hashFilters(filters2);

		expect(hash1).not.toBe(hash2);
	});

	it('should have low collision rate for similar inputs', () => {
		const hashes = new Set();
		for (let i = 0; i < 100; i++) {
			hashes.add(hashFilters({ id: i }));
		}
		expect(hashes.size).toBe(100); // No collisions
	});
});