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
      on: vi.fn(),
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

    it('should store value with TTL when provided', async () => {
      await repository.write('temp-key', 'temp-value', 3600);

      expect(mockRedis.set).toHaveBeenCalledWith('temp-key', '"temp-value"', 'EX', 3600);
    });

    it('should store value without TTL when not provided', async () => {
      await repository.write('permanent-key', 'permanent-value');

      expect(mockRedis.set).toHaveBeenCalledWith('permanent-key', '"permanent-value"');
    });

    it('should store object with TTL', async () => {
      const obj = { session: 'abc123' };
      await repository.write('session-data', obj, 1800);

      expect(mockRedis.set).toHaveBeenCalledWith('session-data', JSON.stringify(obj), 'EX', 1800);
    });

    it('should handle TTL value of 0 as no expiration', async () => {
      await repository.write('no-expire', 'value', 0);

      expect(mockRedis.set).toHaveBeenCalledWith('no-expire', '"value"');
    });

    it('should handle negative TTL values as no expiration', async () => {
      await repository.write('no-expire', 'value', -100);

      expect(mockRedis.set).toHaveBeenCalledWith('no-expire', '"value"');
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
    it('should create Redis client with connection string and options', () => {
      const call = (Redis as any).mock.calls[0];
      const config = call[1];

      expect(call[0]).toBe('redis://localhost:6379');
      expect(config.maxRetriesPerRequest).toBeNull();
      expect(config.enableReadyCheck).toBe(false);
      expect(config.enableOfflineQueue).toBe(false);
      expect(config.connectTimeout).toBe(10000);
      expect(config.lazyConnect).toBe(false);
      expect(typeof config.retryStrategy).toBe('function');
    });

    it('should have retry strategy with exponential backoff', () => {
      const call = (Redis as any).mock.calls[0];
      const retryStrategy = call[1].retryStrategy;

      expect(retryStrategy(1)).toBe(50);
      expect(retryStrategy(10)).toBe(500);
      expect(retryStrategy(100)).toBe(3000); // Max cap at 3 seconds
    });

    it('should disconnect when repository is destroyed', async () => {
      const repo = repository as RedisCacheRepository;
      await repo.disconnect();

      expect(mockRedis.disconnect).toHaveBeenCalled();
    });

    it('should register error event handler', () => {
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should register close event handler', () => {
      expect(mockRedis.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should register reconnecting event handler', () => {
      expect(mockRedis.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
    });
  });

  describe('ping', () => {
    it('should return true when Redis is connected', async () => {
      mockRedis.ping = vi.fn().mockResolvedValue('PONG');

      const result = await repository.ping();

      expect(mockRedis.ping).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when Redis ping fails', async () => {
      mockRedis.ping = vi.fn().mockRejectedValue(new Error('Connection failed'));

      const result = await repository.ping();

      expect(mockRedis.ping).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false when Redis returns unexpected response', async () => {
      mockRedis.ping = vi.fn().mockResolvedValue('UNEXPECTED');

      const result = await repository.ping();

      expect(mockRedis.ping).toHaveBeenCalled();
      expect(result).toBe(false);
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