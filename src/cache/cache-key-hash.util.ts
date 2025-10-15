import { createHash } from 'crypto';

/**
 * Generates a consistent, short hash for filter objects to use in cache keys.
 *
 * Features:
 * - Key order independent (sorted before hashing)
 * - Deterministic output for same input
 * - Handles nested objects, arrays, null, undefined
 * - Returns 8-character hex hash suitable for Redis keys
 *
 * @param filters - The filter object to hash
 * @returns 8-character hash string
 */
export function hashFilters(filters: Record<string, unknown>): string {
	// Canonicalize the object by sorting keys recursively
	const canonical = canonicalize(filters);

	// Create SHA-256 hash and truncate to 8 characters
	const hash = createHash('sha256')
		.update(canonical)
		.digest('hex')
		.substring(0, 8);

	return hash;
}

/**
 * Converts an object to a canonical string representation by sorting keys.
 * This ensures that objects with the same content but different key orders
 * produce the same hash.
 *
 * @param obj - Object to canonicalize
 * @returns JSON string with sorted keys
 */
function canonicalize(obj: unknown): string {
	if (obj === null) {
		return 'null';
	}

	if (obj === undefined) {
		return 'undefined';
	}

	if (typeof obj !== 'object') {
		return JSON.stringify(obj);
	}

	if (Array.isArray(obj)) {
		// Arrays preserve order - map each element through canonicalize
		return '[' + obj.map(item => canonicalize(item)).join(',') + ']';
	}

	// Sort object keys and recursively canonicalize values
	const keys = Object.keys(obj as Record<string, unknown>).sort();
	const pairs = keys.map(key => {
		const value = (obj as Record<string, unknown>)[key];
		return JSON.stringify(key) + ':' + canonicalize(value);
	});

	return '{' + pairs.join(',') + '}';
}