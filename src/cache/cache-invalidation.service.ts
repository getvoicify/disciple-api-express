import type { CacheRepository } from './cache.repository';
import { safeExecute } from '../utils/handle-async';
import { logger } from '../logging';

export class CacheInvalidationService {
	constructor(
		private cacheRepository: CacheRepository,
		private env: string
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