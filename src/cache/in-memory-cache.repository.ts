import { type CacheRepository } from './cache.repository';
import { serialize, deserialize } from './cache-serialization.util';
import { logger } from '../logging';

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

  async deletePattern(pattern: string): Promise<void> {
    const startTime = Date.now();
    const regex = this.globToRegex(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.clearTimer(key);
    }

    const duration = Date.now() - startTime;
    logger.debug(
      { pattern, deletedCount: keysToDelete.length, duration },
      'In-memory cache pattern deletion completed'
    );
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const startTime = Date.now();
    const keysToDelete: string[] = [];

    // Optimized: use simple string comparison instead of regex
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.clearTimer(key);
    }

    const duration = Date.now() - startTime;
    logger.debug(
      { prefix, deletedCount: keysToDelete.length, duration },
      'In-memory cache prefix deletion completed'
    );
  }

  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  private globToRegex(pattern: string): RegExp {
    let regexStr = '';
    let i = 0;

    while (i < pattern.length) {
      const char = pattern[i];

      if (char === '*') {
        regexStr += '.*';
        i++;
      } else if (char === '?') {
        regexStr += '.';
        i++;
      } else if (char === '[') {
        // Fix: Start search after '[' to handle ']' as first char
        const closingBracket = pattern.indexOf(']', i + 1);
        // Fix: Ensure non-empty character set
        if (closingBracket !== -1 && closingBracket > i + 1) {
          const charSet = pattern.substring(i + 1, closingBracket);
          regexStr += '[' + charSet + ']';
          i = closingBracket + 1;
        } else {
          // Treat as literal bracket if no valid closing bracket or empty set
          regexStr += '\\[';
          i++;
        }
      } else if (char === '\\') {
        if (i + 1 < pattern.length) {
          const nextChar = pattern[i + 1];
          // Fix: Escape the character for regex to make it literal
          // This prevents \d from being interpreted as a digit pattern
          regexStr += nextChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          i += 2;
        } else {
          regexStr += '\\\\';
          i++;
        }
      } else {
        regexStr += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        i++;
      }
    }

    return new RegExp('^' + regexStr + '$');
  }
}