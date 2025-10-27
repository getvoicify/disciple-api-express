import { describe, it, expect } from 'vitest';
import { getUserIdFromRequest } from '../../utils/get-user-id';
import type { EndpointRequest } from '../../types/endpoint-handler';

describe('getUserIdFromRequest', () => {
  // ============================================================================
  // Valid User Extraction Tests
  // ============================================================================

  it('should extract valid userId from req.user', () => {
    const mockRequest = {
      user: [
        null,
        {
          payload: {
            sub: 'user-123',
            email: 'test@example.com',
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBe('user-123');
  });

  it('should handle array index [1] correctly', () => {
    const mockRequest = {
      user: [
        { some: 'data' }, // Index 0 - not used
        {
          payload: {
            sub: 'correct-user-id',
          },
        }, // Index 1 - should use this
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBe('correct-user-id');
  });

  it('should extract UUID format userId', () => {
    const mockRequest = {
      user: [
        null,
        {
          payload: {
            sub: '550e8400-e29b-41d4-a716-446655440000',
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  // ============================================================================
  // Invalid/Missing Data Tests
  // ============================================================================

  it('should return undefined when req.user is undefined', () => {
    const mockRequest = {} as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  it('should return undefined when req.user is null', () => {
    const mockRequest = {
      user: null,
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  it('should return undefined when req.user array is empty', () => {
    const mockRequest = {
      user: [],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  it('should return undefined when array has only one element', () => {
    const mockRequest = {
      user: [
        {
          payload: {
            sub: 'user-123',
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  it('should return undefined when payload is missing', () => {
    const mockRequest = {
      user: [null, {}],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  it('should return undefined when payload is null', () => {
    const mockRequest = {
      user: [
        null,
        {
          payload: null,
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  it('should return undefined when sub property is missing', () => {
    const mockRequest = {
      user: [
        null,
        {
          payload: {
            email: 'test@example.com',
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  it('should return undefined when sub is not a string', () => {
    const mockRequest = {
      user: [
        null,
        {
          payload: {
            sub: 12345, // Number instead of string
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  it('should return undefined when sub is a number', () => {
    const mockRequest = {
      user: [
        null,
        {
          payload: {
            sub: 0,
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  it('should return undefined when sub is an object', () => {
    const mockRequest = {
      user: [
        null,
        {
          payload: {
            sub: { id: 'user-123' },
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  it('should return undefined when sub is an array', () => {
    const mockRequest = {
      user: [
        null,
        {
          payload: {
            sub: ['user-123'],
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  it('should return undefined when sub is empty string', () => {
    const mockRequest = {
      user: [
        null,
        {
          payload: {
            sub: '',
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBeUndefined();
  });

  it('should return undefined when sub is whitespace only', () => {
    const mockRequest = {
      user: [
        null,
        {
          payload: {
            sub: '   ',
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    // Note: This depends on implementation - should we trim or reject whitespace?
    // For now, expecting undefined for whitespace-only strings
    expect(result).toBeUndefined();
  });

  it('should handle very long valid userId strings', () => {
    const longUserId = 'a'.repeat(500);
    const mockRequest = {
      user: [
        null,
        {
          payload: {
            sub: longUserId,
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBe(longUserId);
  });

  it('should preserve userId with special characters', () => {
    const mockRequest = {
      user: [
        null,
        {
          payload: {
            sub: 'user-123_special@email.com',
          },
        },
      ],
    } as unknown as EndpointRequest;

    const result = getUserIdFromRequest(mockRequest);
    expect(result).toBe('user-123_special@email.com');
  });
});