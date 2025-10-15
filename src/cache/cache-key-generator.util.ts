import { hashFilters } from './cache-key-hash.util';

export enum CacheKeyType {
	LIST = 'list',
	SINGLE = 'single'
}

export function generateCacheKey(
	env: string,
	resource: string,
	type: CacheKeyType,
	id?: string,
	filters?: Record<string, unknown> | null
): string {
	// Trim whitespace from inputs
	const trimmedEnv = env.trim();
	const trimmedResource = resource.trim();
	const trimmedId = id?.trim();

	// Validate required inputs
	if (!trimmedEnv) {
		throw new Error('env cannot be empty');
	}
	if (!trimmedResource) {
		throw new Error('resource cannot be empty');
	}

	// Validate SINGLE type requires ID
	if (type === CacheKeyType.SINGLE && !trimmedId) {
		throw new Error('ID is required for SINGLE cache key type');
	}

	// Build base key: {env}:{resource}:{type}
	let key = `${trimmedEnv}:${trimmedResource}:${type}`;

	// Add ID for SINGLE type
	if (type === CacheKeyType.SINGLE && trimmedId) {
		key += `:${trimmedId}`;
	}

	// Add filter hash for LIST type with filters
	if (type === CacheKeyType.LIST && filters && Object.keys(filters).length > 0) {
		const filterHash = hashFilters(filters);
		key += `:${filterHash}`;
	}

	return key;
}