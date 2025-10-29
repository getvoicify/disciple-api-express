import type { CacheRepository } from './cache.repository';
import { safeExecute } from '../utils/handle-async';
import { logger } from '../logging';

/**
 * Service interface for cache invalidation operations
 * Provides methods to invalidate cached resources by ID, lists, or all cache entries for a resource
 */
export interface ICacheInvalidationService {
	/**
	 * Invalidates a single cached resource by its ID
	 * @param resource - The type of resource to invalidate (e.g., 'note', 'post')
	 * @param id - The unique identifier of the resource
	 * @returns Promise that resolves when invalidation is complete
	 */
	invalidateResource(resource: string, id: string): Promise<void>;

	/**
	 * Invalidates all list caches for a specific resource type
	 * @param resource - The type of resource whose lists should be invalidated
	 * @returns Promise that resolves when invalidation is complete
	 */
	invalidateList(resource: string): Promise<void>;

	/**
	 * Invalidates all cache entries for a specific resource type
	 * @param resource - The type of resource to completely invalidate
	 * @returns Promise that resolves when invalidation is complete
	 */
	invalidateAll(resource: string): Promise<void>;
}

/**
 * Service for invalidating cached resources
 * Implements pattern-based cache invalidation strategies for different resource types
 */
export class CacheInvalidationService implements ICacheInvalidationService {
	constructor(
		private readonly cacheRepository: CacheRepository,
		private readonly env: string
	) {
		// Validate env parameter
		const trimmedEnv = env?.trim();
		if (!trimmedEnv) {
			throw new Error('env cannot be empty');
		}
		this.env = trimmedEnv;
	}

	async invalidateResource(resource: string, id: string): Promise<void> {
		// Validate resource parameter
		const trimmedResource = resource?.trim();
		if (!trimmedResource) {
			return;
		}

		// Handle empty/undefined ID gracefully
		if (!id || !id.trim()) {
			return;
		}

		const trimmedId = id.trim();
		const pattern = `${this.env}:${trimmedResource}:single:${trimmedId}`;

		const [error] = await safeExecute(this.cacheRepository.deletePattern(pattern));
		if (error) {
			logger.error(
				{ error, pattern, resource: trimmedResource, id: trimmedId },
				'Failed to invalidate cache for resource'
			);
		}
	}

	async invalidateList(resource: string): Promise<void> {
		// Validate resource parameter
		const trimmedResource = resource?.trim();
		if (!trimmedResource) {
			return;
		}

		const pattern = `${this.env}:${trimmedResource}:list*`;

		const [error] = await safeExecute(this.cacheRepository.deletePattern(pattern));
		if (error) {
			logger.error(
				{ error, pattern, resource: trimmedResource },
				'Failed to invalidate list caches for resource'
			);
		}
	}

	async invalidateAll(resource: string): Promise<void> {
		// Validate resource parameter
		const trimmedResource = resource?.trim();
		if (!trimmedResource) {
			return;
		}

		const prefix = `${this.env}:${trimmedResource}:`;

		const [error] = await safeExecute(this.cacheRepository.deleteByPrefix(prefix));
		if (error) {
			logger.error(
				{ error, prefix, resource: trimmedResource },
				'Failed to invalidate all caches for resource'
			);
		}
	}
}
