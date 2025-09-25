import { describe, it, expect, beforeEach } from 'vitest';
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
});