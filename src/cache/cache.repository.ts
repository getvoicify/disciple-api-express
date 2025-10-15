export interface CacheRepository {
	write<T = string>(key: string, value: T, ttl?: number): Promise<void>;
	read<T = string>(key: string): Promise<T | null>;
	delete(key: string): Promise<void>;
	ping(): Promise<boolean>;

	/**
	 * Delete all keys matching the given pattern.
	 * Supports Redis glob-style patterns (e.g., "prefix:*", "key:?:suffix").
	 *
	 * @param pattern - Redis glob pattern to match keys
	 * @returns Promise that resolves when all matching keys are deleted
	 */
	deletePattern(pattern: string): Promise<void>;

	/**
	 * Delete all keys with the given prefix.
	 * Automatically appends wildcard to prefix.
	 *
	 * @param prefix - Key prefix to match (wildcard added automatically)
	 * @returns Promise that resolves when all matching keys are deleted
	 */
	deleteByPrefix(prefix: string): Promise<void>;
}
