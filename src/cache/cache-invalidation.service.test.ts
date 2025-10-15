import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheInvalidationService } from './cache-invalidation.service';
import type { CacheRepository } from './cache.repository';
import { logger } from '../logging';

vi.mock('../logging', () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn()
	}
}));

describe('CacheInvalidationService', () => {
	let service: CacheInvalidationService;
	let mockCacheRepository: CacheRepository;
	const mockEnv = 'test';

	beforeEach(() => {
		mockCacheRepository = {
			write: vi.fn(),
			read: vi.fn(),
			delete: vi.fn(),
			ping: vi.fn(),
			deletePattern: vi.fn(),
			deleteByPrefix: vi.fn()
		};

		service = new CacheInvalidationService(mockCacheRepository, mockEnv);
	});

	describe('invalidateResource', () => {
		it('should invalidate single resource by ID', async () => {
			await service.invalidateResource('note', 'uuid-123');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('test:note:single:uuid-123');
		});

		it('should invalidate different resource types', async () => {
			await service.invalidateResource('post', 'uuid-456');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('test:post:single:uuid-456');
		});

		it('should invalidate resource with special characters in ID', async () => {
			await service.invalidateResource('note', 'user:123:note:456');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('test:note:single:user:123:note:456');
		});

		it('should not throw when cache repository fails', async () => {
			vi.mocked(mockCacheRepository.deletePattern).mockRejectedValue(new Error('Cache error'));

			await expect(service.invalidateResource('note', 'uuid-123')).resolves.not.toThrow();
		});

		it('should log error when cache repository fails', async () => {
			vi.mocked(mockCacheRepository.deletePattern).mockRejectedValue(new Error('Cache error'));

			await service.invalidateResource('note', 'uuid-123');

			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('invalidateList', () => {
		it('should invalidate all list caches for resource', async () => {
			await service.invalidateList('note');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('test:note:list*');
		});

		it('should invalidate list caches for different resources', async () => {
			await service.invalidateList('post');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('test:post:list*');
		});

		it('should invalidate list caches including filtered lists', async () => {
			// This should match both "test:note:list" and "test:note:list:hash123"
			await service.invalidateList('note');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('test:note:list*');
		});

		it('should not throw when cache repository fails', async () => {
			vi.mocked(mockCacheRepository.deletePattern).mockRejectedValue(new Error('Cache error'));

			await expect(service.invalidateList('note')).resolves.not.toThrow();
		});

		it('should handle errors gracefully', async () => {
			vi.mocked(mockCacheRepository.deletePattern).mockRejectedValue(new Error('Redis connection failed'));

			await service.invalidateList('note');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalled();
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('invalidateAll', () => {
		it('should invalidate all caches for resource', async () => {
			await service.invalidateAll('note');

			expect(mockCacheRepository.deleteByPrefix).toHaveBeenCalledWith('test:note:');
		});

		it('should invalidate all caches for different resources', async () => {
			await service.invalidateAll('post');

			expect(mockCacheRepository.deleteByPrefix).toHaveBeenCalledWith('test:post:');
		});

		it('should invalidate both list and single caches', async () => {
			// This should match both "test:note:list" and "test:note:single:uuid-123"
			await service.invalidateAll('note');

			expect(mockCacheRepository.deleteByPrefix).toHaveBeenCalledWith('test:note:');
		});

		it('should not throw when cache repository fails', async () => {
			vi.mocked(mockCacheRepository.deleteByPrefix).mockRejectedValue(new Error('Cache error'));

			await expect(service.invalidateAll('note')).resolves.not.toThrow();
		});

		it('should handle errors gracefully', async () => {
			vi.mocked(mockCacheRepository.deleteByPrefix).mockRejectedValue(new Error('Redis connection failed'));

			await service.invalidateAll('note');

			expect(mockCacheRepository.deleteByPrefix).toHaveBeenCalled();
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('environment handling', () => {
		it('should use correct environment in patterns', async () => {
			const prodService = new CacheInvalidationService(mockCacheRepository, 'prod');

			await prodService.invalidateResource('note', 'uuid-123');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('prod:note:single:uuid-123');
		});

		it('should use different environments correctly', async () => {
			const stagingService = new CacheInvalidationService(mockCacheRepository, 'staging');

			await stagingService.invalidateList('note');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('staging:note:list*');
		});
	});

	describe('multiple operations', () => {
		it('should handle multiple invalidations sequentially', async () => {
			await service.invalidateResource('note', 'uuid-1');
			await service.invalidateResource('note', 'uuid-2');
			await service.invalidateList('note');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledTimes(3);
			expect(mockCacheRepository.deletePattern).toHaveBeenNthCalledWith(1, 'test:note:single:uuid-1');
			expect(mockCacheRepository.deletePattern).toHaveBeenNthCalledWith(2, 'test:note:single:uuid-2');
			expect(mockCacheRepository.deletePattern).toHaveBeenNthCalledWith(3, 'test:note:list*');
		});

		it('should handle mixed resource types', async () => {
			await service.invalidateResource('note', 'uuid-1');
			await service.invalidateResource('post', 'uuid-2');
			await service.invalidateList('devotional');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledTimes(3);
		});

		it('should continue even if one operation fails', async () => {
			vi.mocked(mockCacheRepository.deletePattern)
				.mockRejectedValueOnce(new Error('First failed'))
				.mockResolvedValueOnce(undefined)
				.mockResolvedValueOnce(undefined);

			await service.invalidateResource('note', 'uuid-1');
			await service.invalidateResource('note', 'uuid-2');
			await service.invalidateList('note');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledTimes(3);
		});
	});

	describe('edge cases', () => {
		it('should handle resource names with hyphens', async () => {
			await service.invalidateResource('daily-devotional', 'uuid-123');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('test:daily-devotional:single:uuid-123');
		});

		it('should handle resource names with underscores', async () => {
			await service.invalidateAll('user_profile');

			expect(mockCacheRepository.deleteByPrefix).toHaveBeenCalledWith('test:user_profile:');
		});

		it('should trim whitespace from resource names', async () => {
			await service.invalidateResource(' note ', 'uuid-123');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('test:note:single:uuid-123');
		});

		it('should trim whitespace from IDs', async () => {
			await service.invalidateResource('note', ' uuid-123 ');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('test:note:single:uuid-123');
		});

		it('should handle empty ID gracefully', async () => {
			await expect(service.invalidateResource('note', '')).resolves.not.toThrow();
		});

		it('should handle undefined ID gracefully', async () => {
			await expect(service.invalidateResource('note', undefined as any)).resolves.not.toThrow();
		});
	});

	describe('integration scenarios', () => {
		it('should invalidate resource and its lists after update', async () => {
			// Common pattern: after updating a resource, invalidate both the resource and list caches
			const noteId = 'uuid-123';

			await service.invalidateResource('note', noteId);
			await service.invalidateList('note');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('test:note:single:uuid-123');
			expect(mockCacheRepository.deletePattern).toHaveBeenCalledWith('test:note:list*');
		});

		it('should invalidate all after bulk operations', async () => {
			// Common pattern: after bulk operations, invalidate all caches
			await service.invalidateAll('note');

			expect(mockCacheRepository.deleteByPrefix).toHaveBeenCalledWith('test:note:');
		});

		it('should work with cache repository that returns successfully', async () => {
			vi.mocked(mockCacheRepository.deletePattern).mockResolvedValue(undefined);
			vi.mocked(mockCacheRepository.deleteByPrefix).mockResolvedValue(undefined);

			await service.invalidateResource('note', 'uuid-123');
			await service.invalidateList('note');
			await service.invalidateAll('note');

			expect(mockCacheRepository.deletePattern).toHaveBeenCalledTimes(2);
			expect(mockCacheRepository.deleteByPrefix).toHaveBeenCalledTimes(1);
		});
	});
});