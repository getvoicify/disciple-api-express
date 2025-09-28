export interface CacheRepository {
	write<T = string>(key: string, value: T, ttl?: number): Promise<void>;
	read<T = string>(key: string): Promise<T | null>;
	delete(key: string): Promise<void>;
}
