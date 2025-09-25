import { CacheRepository } from './cache.repository';
import { serialize, deserialize } from './cache-serialization.util';

export class InMemoryCacheRepository implements CacheRepository {
  private cache: Map<string, string>;

  constructor() {
    this.cache = new Map();
  }

  async write<T = string>(key: string, value: T): Promise<void> {
    const serialized = serialize(value);
    this.cache.set(key, serialized);
  }

  async read<T = string>(key: string): Promise<T | null> {
    if (this.cache.has(key)) {
      const value = this.cache.get(key)!;
      return await deserialize<T>(value);
    }
    return null;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}