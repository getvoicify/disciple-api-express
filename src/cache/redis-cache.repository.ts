import Redis from 'ioredis';
import { type CacheRepository } from './cache.repository';
import { safeExecute } from '../utils/handle-async';
import { serialize, deserialize } from './cache-serialization.util';
import { logger } from '../logging';

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
      logger.error({ error }, 'Redis connection error');
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis reconnecting');
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

  async deletePattern(pattern: string): Promise<void> {
    const batchSize = 1000; // Delete in batches to prevent memory issues
    let totalDeleted = 0;
    let cursor = '0';
    const batch: string[] = [];

    logger.debug({ pattern }, 'Starting pattern deletion');

    // Use SCAN to iterate through keys and delete in batches
    do {
      const [error, result] = await safeExecute<[string, string[]]>(
        this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      );

      if (error) {
        logger.error({ error, pattern }, 'Error scanning keys for pattern deletion');
        throw error;
      }

      if (result) {
        cursor = result[0];
        batch.push(...result[1]);

        // Delete in batches when batch size is reached
        while (batch.length >= batchSize) {
          const keysToDelete = batch.splice(0, batchSize);
          const [delError] = await safeExecute(this.redis.del(...keysToDelete));
          if (delError) {
            logger.error({ error: delError, pattern, deletedSoFar: totalDeleted }, 'Error deleting batch of keys');
            throw delError;
          }
          totalDeleted += keysToDelete.length;
        }
      }
    } while (cursor !== '0');

    // Delete remaining keys in final batch
    if (batch.length > 0) {
      const [error] = await safeExecute(this.redis.del(...batch));
      if (error) {
        logger.error({ error, pattern, deletedSoFar: totalDeleted }, 'Error deleting final batch of keys');
        throw error;
      }
      totalDeleted += batch.length;
    }

    logger.info({ pattern, totalDeleted }, 'Deleted keys matching pattern');
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    // Escape Redis glob pattern metacharacters to treat prefix literally
    const escapedPrefix = prefix.replace(/[*?[\]\\]/g, '\\$&');
    const pattern = escapedPrefix + '*';
    await this.deletePattern(pattern);
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
