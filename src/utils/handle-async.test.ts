import { describe, it, expect } from 'vitest';
import { safeExecute } from './handle-async';

describe('safeExecute', () => {
  describe('with promises', () => {
    it('should return result on successful promise', async () => {
      const promise = Promise.resolve('success');
      const [error, result] = await safeExecute(promise);

      expect(error).toBeUndefined();
      expect(result).toBe('success');
    });

    it('should return error on rejected promise', async () => {
      const expectedError = new Error('test error');
      const promise = Promise.reject(expectedError);
      const [error, result] = await safeExecute(promise);

      expect(error).toBe(expectedError);
      expect(result).toBeUndefined();
    });

    it('should handle promise with complex data types', async () => {
      const data = { id: 1, name: 'test', items: [1, 2, 3] };
      const promise = Promise.resolve(data);
      const [error, result] = await safeExecute(promise);

      expect(error).toBeUndefined();
      expect(result).toEqual(data);
    });
  });

  describe('with functions', () => {
    it('should return result on successful sync function', async () => {
      const fn = () => 'sync result';
      const [error, result] = await safeExecute(fn);

      expect(error).toBeUndefined();
      expect(result).toBe('sync result');
    });

    it('should return result on successful async function', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return 'async result';
      };
      const [error, result] = await safeExecute(fn);

      expect(error).toBeUndefined();
      expect(result).toBe('async result');
    });

    it('should return error on sync function that throws', async () => {
      const expectedError = new Error('sync error');
      const fn = () => {
        throw expectedError;
      };
      const [error, result] = await safeExecute(fn);

      expect(error).toBe(expectedError);
      expect(result).toBeUndefined();
    });

    it('should return error on async function that throws', async () => {
      const expectedError = new Error('async error');
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw expectedError;
      };
      const [error, result] = await safeExecute(fn);

      expect(error).toBe(expectedError);
      expect(result).toBeUndefined();
    });

    it('should handle function returning complex data types', async () => {
      const data = { users: ['alice', 'bob'], count: 2 };
      const fn = () => data;
      const [error, result] = await safeExecute(fn);

      expect(error).toBeUndefined();
      expect(result).toEqual(data);
    });

    it('should handle function returning promise that resolves', async () => {
      const fn = () => Promise.resolve('promised value');
      const [error, result] = await safeExecute(fn);

      expect(error).toBeUndefined();
      expect(result).toBe('promised value');
    });

    it('should handle function returning promise that rejects', async () => {
      const expectedError = new Error('promise rejection');
      const fn = () => Promise.reject(expectedError);
      const [error, result] = await safeExecute(fn);

      expect(error).toBe(expectedError);
      expect(result).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle null return value', async () => {
      const fn = () => null;
      const [error, result] = await safeExecute(fn);

      expect(error).toBeUndefined();
      expect(result).toBeNull();
    });

    it('should handle undefined return value', async () => {
      const fn = () => undefined;
      const [error, result] = await safeExecute(fn);

      expect(error).toBeUndefined();
      expect(result).toBeUndefined();
    });

    it('should handle numeric return value', async () => {
      const fn = () => 42;
      const [error, result] = await safeExecute(fn);

      expect(error).toBeUndefined();
      expect(result).toBe(42);
    });

    it('should handle boolean return value', async () => {
      const fn = () => false;
      const [error, result] = await safeExecute(fn);

      expect(error).toBeUndefined();
      expect(result).toBe(false);
    });
  });
});