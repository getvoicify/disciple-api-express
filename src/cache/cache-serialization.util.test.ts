import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from './cache-serialization.util';

describe('Cache Serialization Utilities', () => {
  describe('serialize', () => {
    it('should serialize string values as JSON strings', () => {
      const result = serialize('hello');
      expect(result).toBe('"hello"');
    });

    it('should serialize empty strings', () => {
      const result = serialize('');
      expect(result).toBe('""');
    });

    it('should serialize strings with special characters', () => {
      const result = serialize('hello\nworld\t"test"');
      expect(result).toBe('"hello\\nworld\\t\\"test\\""');
    });

    it('should serialize number values as strings', () => {
      expect(serialize(42)).toBe('42');
      expect(serialize(0)).toBe('0');
      expect(serialize(-100)).toBe('-100');
      expect(serialize(3.14159)).toBe('3.14159');
    });

    it('should serialize boolean values as strings', () => {
      expect(serialize(true)).toBe('true');
      expect(serialize(false)).toBe('false');
    });

    it('should serialize objects as JSON strings', () => {
      const obj = { name: 'John', age: 30 };
      const result = serialize(obj);
      expect(result).toBe('{"name":"John","age":30}');
    });

    it('should serialize nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          address: {
            city: 'NYC',
            zip: '10001'
          }
        }
      };
      const result = serialize(obj);
      expect(result).toBe('{"user":{"name":"John","address":{"city":"NYC","zip":"10001"}}}');
    });

    it('should serialize arrays as JSON strings', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = serialize(arr);
      expect(result).toBe('[1,2,3,4,5]');
    });

    it('should serialize mixed arrays', () => {
      const arr = [1, 'hello', true, { key: 'value' }];
      const result = serialize(arr);
      expect(result).toBe('[1,"hello",true,{"key":"value"}]');
    });

    it('should serialize null as JSON', () => {
      const result = serialize(null);
      expect(result).toBe('null');
    });

    it('should serialize undefined as JSON', () => {
      const result = serialize(undefined);
      expect(result).toBe(undefined);
    });
  });

  describe('deserialize', () => {
    it('should deserialize JSON string to string', async () => {
      const result = await deserialize<string>('"hello"');
      expect(result).toBe('hello');
    });

    it('should deserialize empty JSON string', async () => {
      const result = await deserialize<string>('""');
      expect(result).toBe('');
    });

    it('should deserialize strings with special characters', async () => {
      const result = await deserialize<string>('"hello\\nworld\\t\\"test\\""');
      expect(result).toBe('hello\nworld\t"test"');
    });

    it('should deserialize boolean true', async () => {
      const result = await deserialize<boolean>('true');
      expect(result).toBe(true);
    });

    it('should deserialize boolean false', async () => {
      const result = await deserialize<boolean>('false');
      expect(result).toBe(false);
    });

    it('should deserialize integer numbers', async () => {
      expect(await deserialize<number>('42')).toBe(42);
      expect(await deserialize<number>('0')).toBe(0);
      expect(await deserialize<number>('-100')).toBe(-100);
    });

    it('should deserialize decimal numbers', async () => {
      const result = await deserialize<number>('3.14159');
      expect(result).toBe(3.14159);
    });

    it('should deserialize JSON objects', async () => {
      const result = await deserialize<{ name: string; age: number }>('{"name":"John","age":30}');
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should deserialize nested objects', async () => {
      const json = '{"user":{"name":"John","address":{"city":"NYC","zip":"10001"}}}';
      const result = await deserialize<any>(json);
      expect(result).toEqual({
        user: {
          name: 'John',
          address: {
            city: 'NYC',
            zip: '10001'
          }
        }
      });
    });

    it('should deserialize JSON arrays', async () => {
      const result = await deserialize<number[]>('[1,2,3,4,5]');
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should deserialize mixed arrays', async () => {
      const result = await deserialize<any[]>('[1,"hello",true,{"key":"value"}]');
      expect(result).toEqual([1, 'hello', true, { key: 'value' }]);
    });

    it('should deserialize null', async () => {
      const result = await deserialize<null>('null');
      expect(result).toBe(null);
    });

    it('should handle invalid JSON by returning as plain string', async () => {
      const result = await deserialize<string>('not valid json');
      expect(result).toBe('not valid json');
    });

    it('should handle malformed JSON by returning as plain string', async () => {
      const result = await deserialize<string>('{incomplete');
      expect(result).toBe('{incomplete');
    });

    it('should not misinterpret string "true" in JSON as boolean', async () => {
      const result = await deserialize<string>('"true"');
      expect(result).toBe('true');
    });

    it('should not misinterpret string "false" in JSON as boolean', async () => {
      const result = await deserialize<string>('"false"');
      expect(result).toBe('false');
    });

    it('should not misinterpret numeric strings in JSON as numbers', async () => {
      const result = await deserialize<string>('"123"');
      expect(result).toBe('123');
    });
  });

  describe('round-trip serialization', () => {
    it('should handle string round-trip', async () => {
      const original = 'test string';
      const serialized = serialize(original);
      const deserialized = await deserialize<string>(serialized);
      expect(deserialized).toBe(original);
    });

    it('should handle number round-trip', async () => {
      const original = 42.5;
      const serialized = serialize(original);
      const deserialized = await deserialize<number>(serialized);
      expect(deserialized).toBe(original);
    });

    it('should handle boolean round-trip', async () => {
      const original = true;
      const serialized = serialize(original);
      const deserialized = await deserialize<boolean>(serialized);
      expect(deserialized).toBe(original);
    });

    it('should handle object round-trip', async () => {
      const original = { a: 1, b: 'test', c: true };
      const serialized = serialize(original);
      const deserialized = await deserialize<typeof original>(serialized);
      expect(deserialized).toEqual(original);
    });

    it('should handle array round-trip', async () => {
      const original = [1, 2, 'three', { four: 4 }];
      const serialized = serialize(original);
      const deserialized = await deserialize<typeof original>(serialized);
      expect(deserialized).toEqual(original);
    });

    it('should handle null round-trip', async () => {
      const original = null;
      const serialized = serialize(original);
      const deserialized = await deserialize<null>(serialized);
      expect(deserialized).toBe(original);
    });
  });
});