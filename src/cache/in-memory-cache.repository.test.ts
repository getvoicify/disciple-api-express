import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryCacheRepository } from './in-memory-cache.repository';
import { CacheRepository } from './cache.repository';

describe('InMemoryCacheRepository', () => {
  let repository: CacheRepository;

  beforeEach(() => {
    repository = new InMemoryCacheRepository();
  });

  describe('write', () => {
    it('should store a string value', async () => {
      await repository.write('key1', 'value1');
      const result = await repository.read<string>('key1');
      expect(result).toBe('value1');
    });

    it('should store an object value', async () => {
      const obj = { name: 'John', age: 30 };
      await repository.write('user1', obj);
      const result = await repository.read<typeof obj>('user1');
      expect(result).toEqual(obj);
    });

    it('should overwrite existing values', async () => {
      await repository.write('key1', 'value1');
      await repository.write('key1', 'value2');
      const result = await repository.read<string>('key1');
      expect(result).toBe('value2');
    });

    it('should store array values', async () => {
      const arr = [1, 2, 3, 4, 5];
      await repository.write('numbers', arr);
      const result = await repository.read<number[]>('numbers');
      expect(result).toEqual(arr);
    });
  });

  describe('read', () => {
    it('should return null for non-existent keys', async () => {
      const result = await repository.read('nonexistent');
      expect(result).toBeNull();
    });

    it('should return stored string value', async () => {
      await repository.write('key1', 'value1');
      const result = await repository.read<string>('key1');
      expect(result).toBe('value1');
    });

    it('should return stored object value', async () => {
      const obj = { id: 1, data: { nested: true } };
      await repository.write('complex', obj);
      const result = await repository.read<typeof obj>('complex');
      expect(result).toEqual(obj);
    });

    it('should handle boolean values', async () => {
      await repository.write('flag', true);
      const result = await repository.read<boolean>('flag');
      expect(result).toBe(true);
    });

    it('should handle number values', async () => {
      await repository.write('count', 42);
      const result = await repository.read<number>('count');
      expect(result).toBe(42);
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      await repository.write('key1', 'value1');
      await repository.delete('key1');
      const result = await repository.read('key1');
      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent key', async () => {
      await expect(repository.delete('nonexistent')).resolves.not.toThrow();
    });

    it('should only delete specified key', async () => {
      await repository.write('key1', 'value1');
      await repository.write('key2', 'value2');
      await repository.delete('key1');

      const result1 = await repository.read('key1');
      const result2 = await repository.read('key2');

      expect(result1).toBeNull();
      expect(result2).toBe('value2');
    });
  });

  describe('TTL support', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should store value with TTL and expire after timeout', async () => {
      await repository.write('temp-key', 'temp-value', 1);

      let result = await repository.read('temp-key');
      expect(result).toBe('temp-value');

      vi.advanceTimersByTime(999);
      result = await repository.read('temp-key');
      expect(result).toBe('temp-value');

      vi.advanceTimersByTime(2);
      result = await repository.read('temp-key');
      expect(result).toBeNull();
    });

    it('should store value without TTL permanently', async () => {
      await repository.write('permanent-key', 'permanent-value');

      vi.advanceTimersByTime(1000000);
      const result = await repository.read('permanent-key');
      expect(result).toBe('permanent-value');
    });

    it('should handle TTL value of 0 as no expiration', async () => {
      await repository.write('no-expire', 'value', 0);

      vi.advanceTimersByTime(1000000);
      const result = await repository.read('no-expire');
      expect(result).toBe('value');
    });

    it('should handle negative TTL values as no expiration', async () => {
      await repository.write('no-expire', 'value', -100);

      vi.advanceTimersByTime(1000000);
      const result = await repository.read('no-expire');
      expect(result).toBe('value');
    });

    it('should reset TTL when overwriting with new TTL', async () => {
      await repository.write('key', 'value1', 1);

      vi.advanceTimersByTime(500);
      await repository.write('key', 'value2', 2);

      vi.advanceTimersByTime(1500);
      let result = await repository.read('key');
      expect(result).toBe('value2');

      vi.advanceTimersByTime(501);
      result = await repository.read('key');
      expect(result).toBeNull();
    });

    it('should clear TTL when overwriting without TTL', async () => {
      await repository.write('key', 'value1', 1);

      vi.advanceTimersByTime(500);
      await repository.write('key', 'value2');

      vi.advanceTimersByTime(1000000);
      const result = await repository.read('key');
      expect(result).toBe('value2');
    });
  });

  describe('ping', () => {
    it('should always return true for in-memory cache', async () => {
      const result = await repository.ping();
      expect(result).toBe(true);
    });

    it('should be fast for in-memory cache', async () => {
      const startTime = Date.now();
      const result = await repository.ping();
      const endTime = Date.now();

      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent writes', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        repository.write(`key${i}`, `value${i}`)
      );

      await Promise.all(promises);

      for (let i = 0; i < 100; i++) {
        const result = await repository.read(`key${i}`);
        expect(result).toBe(`value${i}`);
      }
    });

    it('should handle mixed concurrent operations', async () => {
      await repository.write('key1', 'initial');

      const operations = [
        repository.write('key2', 'value2'),
        repository.read('key1'),
        repository.write('key3', 'value3'),
        repository.delete('key1'),
        repository.read('key2'),
      ];

      const results = await Promise.all(operations);

      expect(results[1]).toBe('initial'); // read key1
      expect(results[4]).toBe('value2');  // read key2

      const finalKey1 = await repository.read('key1');
      expect(finalKey1).toBeNull();
    });
  });

  describe('deletePattern', () => {
    it('should delete all keys matching wildcard pattern', async () => {
      await repository.write('prod:note:list:hash1', 'value1');
      await repository.write('prod:note:list:hash2', 'value2');
      await repository.write('prod:note:single:uuid-123', 'value3');
      await repository.write('prod:post:list', 'value4');

      await repository.deletePattern('prod:note:*');

      const result1 = await repository.read('prod:note:list:hash1');
      const result2 = await repository.read('prod:note:list:hash2');
      const result3 = await repository.read('prod:note:single:uuid-123');
      const result4 = await repository.read('prod:post:list');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
      expect(result4).toBe('value4'); // Should not be deleted
    });

    it('should handle pattern with no matching keys', async () => {
      await repository.write('key1', 'value1');
      await repository.write('key2', 'value2');

      await expect(repository.deletePattern('nonexistent:*')).resolves.not.toThrow();

      const result1 = await repository.read('key1');
      const result2 = await repository.read('key2');

      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
    });

    it('should delete multiple keys matching pattern', async () => {
      await repository.write('test:key:1', 'value1');
      await repository.write('test:key:2', 'value2');
      await repository.write('test:key:3', 'value3');
      await repository.write('test:key:4', 'value4');
      await repository.write('test:key:5', 'value5');
      await repository.write('other:key', 'value6');

      await repository.deletePattern('test:key:*');

      const result1 = await repository.read('test:key:1');
      const result2 = await repository.read('test:key:2');
      const result3 = await repository.read('test:key:3');
      const result4 = await repository.read('test:key:4');
      const result5 = await repository.read('test:key:5');
      const result6 = await repository.read('other:key');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
      expect(result4).toBeNull();
      expect(result5).toBeNull();
      expect(result6).toBe('value6');
    });

    it('should handle pattern with single character wildcard', async () => {
      await repository.write('key:a:suffix', 'value1');
      await repository.write('key:b:suffix', 'value2');
      await repository.write('key:ab:suffix', 'value3');

      await repository.deletePattern('key:?:suffix');

      const result1 = await repository.read('key:a:suffix');
      const result2 = await repository.read('key:b:suffix');
      const result3 = await repository.read('key:ab:suffix');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBe('value3'); // Should not match single-char wildcard
    });

    it('should handle pattern with character sets', async () => {
      await repository.write('key:1', 'value1');
      await repository.write('key:2', 'value2');
      await repository.write('key:a', 'value3');

      await repository.deletePattern('key:[12]');

      const result1 = await repository.read('key:1');
      const result2 = await repository.read('key:2');
      const result3 = await repository.read('key:a');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBe('value3');
    });

    it('should handle exact match pattern', async () => {
      await repository.write('exact:key', 'value1');
      await repository.write('exact:key2', 'value2');

      await repository.deletePattern('exact:key');

      const result1 = await repository.read('exact:key');
      const result2 = await repository.read('exact:key2');

      expect(result1).toBeNull();
      expect(result2).toBe('value2');
    });
  });

  describe('deleteByPrefix', () => {
    it('should delete all keys with given prefix', async () => {
      await repository.write('prod:note:list', 'value1');
      await repository.write('prod:note:list:hash1', 'value2');
      await repository.write('prod:note:single:uuid-123', 'value3');
      await repository.write('prod:post:list', 'value4');

      await repository.deleteByPrefix('prod:note:');

      const result1 = await repository.read('prod:note:list');
      const result2 = await repository.read('prod:note:list:hash1');
      const result3 = await repository.read('prod:note:single:uuid-123');
      const result4 = await repository.read('prod:post:list');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
      expect(result4).toBe('value4');
    });

    it('should handle prefix with no matching keys', async () => {
      await repository.write('key1', 'value1');
      await repository.write('key2', 'value2');

      await expect(repository.deleteByPrefix('nonexistent:')).resolves.not.toThrow();

      const result1 = await repository.read('key1');
      const result2 = await repository.read('key2');

      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
    });

    it('should append wildcard to prefix automatically', async () => {
      await repository.write('test:key1', 'value1');
      await repository.write('test:key2', 'value2');
      await repository.write('other:key', 'value3');

      await repository.deleteByPrefix('test:');

      const result1 = await repository.read('test:key1');
      const result2 = await repository.read('test:key2');
      const result3 = await repository.read('other:key');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBe('value3');
    });

    it('should handle empty prefix', async () => {
      await repository.write('key1', 'value1');
      await repository.write('key2', 'value2');
      await repository.write('key3', 'value3');

      await repository.deleteByPrefix('');

      const result1 = await repository.read('key1');
      const result2 = await repository.read('key2');
      const result3 = await repository.read('key3');

      // Empty prefix should match all keys
      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should escape special glob characters in prefix', async () => {
      await repository.write('key:*:test', 'value1');
      await repository.write('key:a:test', 'value2');
      await repository.write('key:*:other', 'value3');

      await repository.deleteByPrefix('key:*:');

      const result1 = await repository.read('key:*:test');
      const result2 = await repository.read('key:a:test');
      const result3 = await repository.read('key:*:other');

      // Should only delete keys that literally start with "key:*:"
      expect(result1).toBeNull();
      expect(result2).toBe('value2');
      expect(result3).toBeNull();
    });

    it('should delete large number of keys efficiently', async () => {
      const promises = Array.from({ length: 1000 }, (_, i) =>
        repository.write(`prefix:${i}`, `value${i}`)
      );
      await Promise.all(promises);

      await repository.write('other:key', 'value');

      await repository.deleteByPrefix('prefix:');

      for (let i = 0; i < 1000; i++) {
        const result = await repository.read(`prefix:${i}`);
        expect(result).toBeNull();
      }

      const otherResult = await repository.read('other:key');
      expect(otherResult).toBe('value');
    });
  });
});