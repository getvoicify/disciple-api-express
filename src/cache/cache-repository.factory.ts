import { type CacheRepository } from './cache.repository';
import { InMemoryCacheRepository } from './in-memory-cache.repository';
import { RedisCacheRepository } from './redis-cache.repository';

export interface CacheRepositoryConfig {
  redisUrl?: string;
  forceInMemory?: boolean;
}

export function createCacheRepository(config?: CacheRepositoryConfig): CacheRepository {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv === 'development';

  if (config?.forceInMemory || isDevelopment) {
    return new InMemoryCacheRepository();
  }

  const redisUrl = config?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
  return RedisCacheRepository.getInstance(redisUrl);
}
