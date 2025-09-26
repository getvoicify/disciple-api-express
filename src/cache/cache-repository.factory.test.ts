import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCacheRepository } from './cache-repository.factory';
import { InMemoryCacheRepository } from './in-memory-cache.repository';
import { RedisCacheRepository } from './redis-cache.repository';

vi.mock('./redis-cache.repository', () => {
  const mockInstance = {
    write: vi.fn(),
    read: vi.fn(),
    delete: vi.fn(),
  };

  return {
    RedisCacheRepository: {
      getInstance: vi.fn().mockReturnValue(mockInstance),
    },
  };
});

describe('CacheRepositoryFactory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createCacheRepository', () => {
    it('should return InMemoryCacheRepository in development environment', () => {
      process.env.NODE_ENV = 'development';

      const repository = createCacheRepository();

      expect(repository).toBeInstanceOf(InMemoryCacheRepository);
    });

    it('should return RedisCacheRepository in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const repository = createCacheRepository();

      expect(RedisCacheRepository.getInstance).toHaveBeenCalledWith('redis://localhost:6379');
      expect(repository).toHaveProperty('write');
      expect(repository).toHaveProperty('read');
      expect(repository).toHaveProperty('delete');
    });

    it('should return RedisCacheRepository in staging environment', () => {
      process.env.NODE_ENV = 'staging';
      process.env.REDIS_URL = 'redis://staging.redis:6379';

      const repository = createCacheRepository();

      expect(RedisCacheRepository.getInstance).toHaveBeenCalledWith('redis://staging.redis:6379');
      expect(repository).toHaveProperty('write');
      expect(repository).toHaveProperty('read');
      expect(repository).toHaveProperty('delete');
    });

    it('should return RedisCacheRepository in test environment', () => {
      process.env.NODE_ENV = 'test';
      process.env.REDIS_URL = 'redis://test.redis:6379';

      const repository = createCacheRepository();

      expect(RedisCacheRepository.getInstance).toHaveBeenCalledWith('redis://test.redis:6379');
      expect(repository).toHaveProperty('write');
      expect(repository).toHaveProperty('read');
      expect(repository).toHaveProperty('delete');
    });

    it('should use default Redis URL when REDIS_URL is not provided', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.REDIS_URL;

      const repository = createCacheRepository();

      expect(RedisCacheRepository.getInstance).toHaveBeenCalledWith('redis://localhost:6379');
      expect(repository).toHaveProperty('write');
      expect(repository).toHaveProperty('read');
      expect(repository).toHaveProperty('delete');
    });

    it('should return InMemoryCacheRepository when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;

      const repository = createCacheRepository();

      expect(repository).toBeInstanceOf(InMemoryCacheRepository);
    });

    it('should return InMemoryCacheRepository for development regardless of REDIS_URL', () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const repository = createCacheRepository();

      expect(repository).toBeInstanceOf(InMemoryCacheRepository);
      expect(RedisCacheRepository.getInstance).not.toHaveBeenCalled();
    });

    it('should handle custom Redis connection parameters', () => {
      process.env.NODE_ENV = 'production';
      process.env.REDIS_URL = 'redis://username:password@custom-host:6380/0';

      const repository = createCacheRepository();

      expect(RedisCacheRepository.getInstance).toHaveBeenCalledWith('redis://username:password@custom-host:6380/0');
      expect(repository).toHaveProperty('write');
      expect(repository).toHaveProperty('read');
      expect(repository).toHaveProperty('delete');
    });
  });

  describe('factory configuration', () => {
    it('should allow passing custom configuration', () => {
      process.env.NODE_ENV = 'production';

      const config = {
        redisUrl: 'redis://custom:6379',
        forceInMemory: false,
      };

      const repository = createCacheRepository(config);

      expect(RedisCacheRepository.getInstance).toHaveBeenCalledWith('redis://custom:6379');
      expect(repository).toHaveProperty('write');
      expect(repository).toHaveProperty('read');
      expect(repository).toHaveProperty('delete');
    });

    it('should force in-memory cache when forceInMemory is true', () => {
      process.env.NODE_ENV = 'production';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const config = {
        forceInMemory: true,
      };

      const repository = createCacheRepository(config);

      expect(repository).toBeInstanceOf(InMemoryCacheRepository);
      expect(RedisCacheRepository.getInstance).not.toHaveBeenCalled();
    });

    it('should prioritize config redisUrl over environment variable', () => {
      process.env.NODE_ENV = 'production';
      process.env.REDIS_URL = 'redis://env-redis:6379';

      const config = {
        redisUrl: 'redis://config-redis:6379',
      };

      const repository = createCacheRepository(config);

      expect(RedisCacheRepository.getInstance).toHaveBeenCalledWith('redis://config-redis:6379');
      expect(repository).toHaveProperty('write');
      expect(repository).toHaveProperty('read');
      expect(repository).toHaveProperty('delete');
    });
  });
});