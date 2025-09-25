import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisCacheRepository } from './redis-cache.repository';
import { CacheRepository } from './cache.repository';
import Redis from 'ioredis';

vi.mock('ioredis');

describe('RedisCacheRepository', () => {
  let repository: CacheRepository;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
      disconnect: vi.fn(),
    };

    (Redis as any).mockImplementation(() => mockRedis);
    repository = new RedisCacheRepository('redis://localhost:6379');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('write', () => {
    it('should store a string value', async () => {
      await repository.write('key1', 'value1');

      expect(mockRedis.set).toHaveBeenCalledWith('key1', '"value1"');
    });

    it('should store an object value as JSON', async () => {
      const obj = { name: 'John', age: 30 };
      await repository.write('user1', obj);

      expect(mockRedis.set).toHaveBeenCalledWith('user1', JSON.stringify(obj));
    });

    it('should overwrite existing values', async () => {
      await repository.write('key1', 'value1');
      await repository.write('key1', 'value2');

      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockRedis.set).toHaveBeenLastCalledWith('key1', '"value2"');
    });

    it('should store array values', async () => {
      const arr = [1, 2, 3, 4, 5];
      await repository.write('numbers', arr);

      expect(mockRedis.set).toHaveBeenCalledWith('numbers', JSON.stringify(arr));
    });

    it('should handle boolean values', async () => {
      await repository.write('flag', true);

      expect(mockRedis.set).toHaveBeenCalledWith('flag', 'true');
    });

    it('should handle number values', async () => {
      await repository.write('count', 42);

      expect(mockRedis.set).toHaveBeenCalledWith('count', '42');
    });
  });

  describe('read', () => {
    it('should return null for non-existent keys', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await repository.read('nonexistent');

      expect(mockRedis.get).toHaveBeenCalledWith('nonexistent');
      expect(result).toBeNull();
    });

    it('should return stored string value', async () => {
      mockRedis.get.mockResolvedValue('"value1"');

      const result = await repository.read<string>('key1');

      expect(mockRedis.get).toHaveBeenCalledWith('key1');
      expect(result).toBe('value1');
    });

    it('should return stored object value', async () => {
      const obj = { id: 1, data: { nested: true } };
      mockRedis.get.mockResolvedValue(JSON.stringify(obj));

      const result = await repository.read<typeof obj>('complex');

      expect(mockRedis.get).toHaveBeenCalledWith('complex');
      expect(result).toEqual(obj);
    });

    it('should handle boolean values', async () => {
      mockRedis.get.mockResolvedValue('true');

      const result = await repository.read<boolean>('flag');

      expect(result).toBe(true);
    });

    it('should handle number values', async () => {
      mockRedis.get.mockResolvedValue('42');

      const result = await repository.read<number>('count');

      expect(result).toBe(42);
    });

    it('should handle JSON parse errors gracefully', async () => {
      mockRedis.get.mockResolvedValue('invalid json {');

      const result = await repository.read('malformed');

      expect(result).toBe('invalid json {');
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      await repository.delete('key1');

      expect(mockRedis.del).toHaveBeenCalledWith('key1');
    });

    it('should not throw when deleting non-existent key', async () => {
      mockRedis.del.mockResolvedValue(0);

      await expect(repository.delete('nonexistent')).resolves.not.toThrow();
      expect(mockRedis.del).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('connection handling', () => {
    it('should create Redis client with connection string', () => {
      expect(Redis).toHaveBeenCalledWith('redis://localhost:6379');
    });

    it('should disconnect when repository is destroyed', async () => {
      const repo = repository as RedisCacheRepository;
      await repo.disconnect();

      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });

  describe('error handling with safeExecute', () => {
    it('should handle write errors gracefully', async () => {
      const error = new Error('Redis write error');
      mockRedis.set.mockRejectedValue(error);

      await expect(repository.write('key', 'value')).rejects.toThrow('Redis write error');
    });

    it('should handle read errors gracefully', async () => {
      const error = new Error('Redis read error');
      mockRedis.get.mockRejectedValue(error);

      await expect(repository.read('key')).rejects.toThrow('Redis read error');
    });

    it('should handle delete errors gracefully', async () => {
      const error = new Error('Redis delete error');
      mockRedis.del.mockRejectedValue(error);

      await expect(repository.delete('key')).rejects.toThrow('Redis delete error');
    });
  });
});