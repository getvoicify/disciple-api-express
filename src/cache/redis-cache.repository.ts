import Redis from 'ioredis';
import { CacheRepository } from './cache.repository';
import { safeExecute } from '../utils/handle-async';
import { serialize, deserialize } from './cache-serialization.util';

export class RedisCacheRepository implements CacheRepository {
  private redis: Redis;
  private static instance: CacheRepository;

  constructor(connectionString: string) {
    // Configuration optimized for serverless Redis (e.g., Upstash)
    this.redis = new Redis(connectionString, {
      maxRetriesPerRequest: null, // Disable retries for serverless
      enableReadyCheck: false,     // Skip ready check for faster connections
      enableOfflineQueue: false,   // Fail fast if not connected
      connectTimeout: 10000,       // 10s connection timeout
      lazyConnect: false,          // Connect immediately
      retryStrategy: (times: number) => {
        // Retry with exponential backoff, max 3 seconds
        return Math.min(times * 50, 3000);
      },
    });

    // Handle connection errors to prevent unhandled error events
    this.redis.on('error', (error: Error) => {
      console.error('[Redis] Connection error:', error.message);
    });

    this.redis.on('close', () => {
      console.warn('[Redis] Connection closed');
    });

    this.redis.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });
  }

  async write<T = string>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = serialize(value);
    const [error] = await safeExecute(
      ttl && ttl > 0
        ? this.redis.set(key, serialized, 'EX', ttl)
        : this.redis.set(key, serialized)
    );
    if (error) {
      throw error;
    }
  }

  async read<T = string>(key: string): Promise<T | null> {
    const [error, value] = await safeExecute(this.redis.get(key));
    if (error) {
      throw error;
    }

    if (value === null) {
      return null;
    }

    return await deserialize<T>(value);
  }

  async delete(key: string): Promise<void> {
    const [error] = await safeExecute(this.redis.del(key));
    if (error) {
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    const [error, result] = await safeExecute(this.redis.ping());
    return !(error || result !== 'PONG');

  }

  async disconnect(): Promise<void> {
    const [error] = await safeExecute(() => this.redis.disconnect());
    if (error) {
      throw error;
    }
  }

  static getInstance(connectionString: string): CacheRepository {
    if (!RedisCacheRepository.instance) {
      RedisCacheRepository.instance = new RedisCacheRepository(connectionString);
    }
    return RedisCacheRepository.instance;
  }
}
