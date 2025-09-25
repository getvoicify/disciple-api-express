import Redis from 'ioredis';
import { CacheRepository } from './cache.repository';
import { safeExecute } from '../utils/handle-async';
import { serialize, deserialize } from './cache-serialization.util';

export class RedisCacheRepository implements CacheRepository {
  private redis: Redis;

  constructor(connectionString: string) {
    this.redis = new Redis(connectionString);
  }

  async write<T = string>(key: string, value: T): Promise<void> {
    const serialized = serialize(value);
    const [error] = await safeExecute(this.redis.set(key, serialized));
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

  async disconnect(): Promise<void> {
    const [error] = await safeExecute(() => this.redis.disconnect());
    if (error) {
      throw error;
    }
  }
}
