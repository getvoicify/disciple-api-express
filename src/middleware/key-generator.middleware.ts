import { type Request } from 'express';
import { type Middleware } from '../utils/middleware';
import { generateCacheKey, CacheKeyType } from '../cache/cache-key-generator.util';

interface AuthenticatedRequest extends Request {
	filters?: Record<string, any>;
	key?: string;
}

/**
 * Generates cache keys using the simplified format: {env}:{resource}:{type}[:{id}][:{filterHash}]
 *
 * @param resource - The resource type (e.g., 'post', 'note', 'devotional')
 * @param isList - Whether this is a list key (true) or single resource key (false)
 * @param resourceParamsId - The parameter name containing the resource ID (for single resources)
 *
 * @example
 * // List without filters: test:post:list
 * keyGenerator('post')
 *
 * @example
 * // List with filters: test:post:list:a3f2c1
 * keyGenerator('post')
 *
 * @example
 * // Single resource: test:post:single:uuid-123
 * keyGenerator('post', false, 'id')
 */
export const keyGenerator = (
	resource: string,
	isList = true,
	resourceParamsId?: string
): Middleware => (req, _, next) => {
	const request = req as AuthenticatedRequest;

	try {
		// Get environment (defaults to 'development' if not set)
		const env = process.env.NODE_ENV || 'development';

		if (isList) {
			// Generate list key
			const key = generateCacheKey(
				env,
				resource,
				CacheKeyType.LIST,
				undefined,
				request.filters
			);
			request.key = key;
		} else {
			// Generate single resource key
			const id = resourceParamsId ? request.params[resourceParamsId] : undefined;

			// Handle empty/undefined IDs gracefully - don't set key
			if (!id || !id.trim()) {
				// Don't set request.key for invalid IDs
				next();
				return;
			}

			const key = generateCacheKey(
				env,
				resource,
				CacheKeyType.SINGLE,
				id,
				undefined // Single resource keys don't use filters for now
			);
			request.key = key;
		}

		next();
	} catch (error) {
		// If key generation fails, continue without caching
		next();
	}
};