import { type CacheRepository } from './cache.repository';
import { serialize, deserialize } from './cache-serialization.util';

interface CacheEntry {
  value: string;
  expiresAt?: number;
}

export class InMemoryCacheRepository implements CacheRepository {
  private cache: Map<string, CacheEntry>;
  private timers: Map<string, NodeJS.Timeout>;

  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  async write<T = string>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = serialize(value);

    this.clearTimer(key);

    if (ttl && ttl > 0) {
      const expiresAt = Date.now() + ttl * 1000;
      this.cache.set(key, { value: serialized, expiresAt });

      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, ttl * 1000);

      this.timers.set(key, timer);
    } else {
      this.cache.set(key, { value: serialized });
    }
  }

  async read<T = string>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.clearTimer(key);
      return null;
    }

    return await deserialize<T>(entry.value);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.clearTimer(key);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}