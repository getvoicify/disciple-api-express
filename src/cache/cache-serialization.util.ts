import { safeExecute } from '../utils/handle-async';

export function serialize<T>(value: T): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export async function deserialize<T>(value: string): Promise<T> {
  if (value === 'true') {
    return true as T;
  }
  if (value === 'false') {
    return false as T;
  }

  const numberValue = Number(value);
  if (!isNaN(numberValue) && value === String(numberValue)) {
    return numberValue as T;
  }

  const [error, parsed] = await safeExecute(() => JSON.parse(value) as T);
  if (!error) {
    return parsed;
  }

  return value as T;
}