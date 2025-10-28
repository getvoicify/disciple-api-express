import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeycloakUserInfoExtractor } from '../../../websocket/services/user-info-extractor.service';
import type { ILogger } from '../../../logging';

describe('KeycloakUserInfoExtractor', () => {
  let extractor: KeycloakUserInfoExtractor;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
    };
    extractor = new KeycloakUserInfoExtractor(mockLogger);
  });

  describe('getFullName()', () => {
    it('should return name claim when present', () => {
      const user = {
        payload: {
          name: 'John Doe',
          given_name: 'John',
          family_name: 'Doe',
        },
      };
      expect(extractor.getFullName(user)).toBe('John Doe');
    });

    it('should construct from given_name + family_name when name absent', () => {
      const user = {
        payload: {
          given_name: 'Jane',
          family_name: 'Smith',
        },
      };
      expect(extractor.getFullName(user)).toBe('Jane Smith');
    });

    it('should return given_name only when family_name missing', () => {
      const user = {
        payload: {
          given_name: 'Alice',
        },
      };
      expect(extractor.getFullName(user)).toBe('Alice');
    });

    it('should return family_name only when given_name missing', () => {
      const user = {
        payload: {
          family_name: 'Johnson',
        },
      };
      expect(extractor.getFullName(user)).toBe('Johnson');
    });

    it('should return Unknown User when all name fields missing', () => {
      const user = {
        payload: {
          sub: 'user-123',
          email: 'test@example.com',
        },
      };
      expect(extractor.getFullName(user)).toBe('Unknown User');
    });

    it('should handle undefined user object returning Unknown User', () => {
      expect(extractor.getFullName(undefined)).toBe('Unknown User');
    });

    it('should handle null user object returning Unknown User', () => {
      expect(extractor.getFullName(null)).toBe('Unknown User');
    });

    it('should treat empty string in name as missing and construct from parts', () => {
      const user = {
        payload: {
          name: '',
          given_name: 'Bob',
          family_name: 'Williams',
        },
      };
      expect(extractor.getFullName(user)).toBe('Bob Williams');
    });

    it('should treat empty strings in both parts as missing returning Unknown User', () => {
      const user = {
        payload: {
          name: '',
          given_name: '',
          family_name: '',
        },
      };
      expect(extractor.getFullName(user)).toBe('Unknown User');
    });

    it('should trim constructed names and handle special characters', () => {
      const user = {
        payload: {
          given_name: "  O'Brien  ",
          family_name: '  José  ',
        },
      };
      expect(extractor.getFullName(user)).toBe("O'Brien José");
    });
  });

  describe('getFirstName()', () => {
    it('should return given_name when present', () => {
      const user = {
        payload: {
          given_name: 'Michael',
        },
      };
      expect(extractor.getFirstName(user)).toBe('Michael');
    });

    it('should return Unknown when given_name missing', () => {
      const user = {
        payload: {
          family_name: 'Brown',
        },
      };
      expect(extractor.getFirstName(user)).toBe('Unknown');
    });

    it('should handle undefined user object returning Unknown', () => {
      expect(extractor.getFirstName(undefined)).toBe('Unknown');
    });

    it('should handle null user object returning Unknown', () => {
      expect(extractor.getFirstName(null)).toBe('Unknown');
    });

    it('should treat empty string as missing returning Unknown', () => {
      const user = {
        payload: {
          given_name: '',
        },
      };
      expect(extractor.getFirstName(user)).toBe('Unknown');
    });

    it('should treat whitespace-only as missing returning Unknown', () => {
      const user = {
        payload: {
          given_name: '   ',
        },
      };
      expect(extractor.getFirstName(user)).toBe('Unknown');
    });
  });

  describe('getLastName()', () => {
    it('should return family_name when present', () => {
      const user = {
        payload: {
          family_name: 'Anderson',
        },
      };
      expect(extractor.getLastName(user)).toBe('Anderson');
    });

    it('should return empty string when family_name missing', () => {
      const user = {
        payload: {
          given_name: 'Chris',
        },
      };
      expect(extractor.getLastName(user)).toBe('');
    });

    it('should handle undefined user object returning empty string', () => {
      expect(extractor.getLastName(undefined)).toBe('');
    });

    it('should handle null user object returning empty string', () => {
      expect(extractor.getLastName(null)).toBe('');
    });

    it('should treat empty string as missing returning empty string', () => {
      const user = {
        payload: {
          family_name: '',
        },
      };
      expect(extractor.getLastName(user)).toBe('');
    });

    it('should treat whitespace-only as missing returning empty string', () => {
      const user = {
        payload: {
          family_name: '   ',
        },
      };
      expect(extractor.getLastName(user)).toBe('');
    });
  });

  describe('getUserId()', () => {
    it('should return sub claim when present', () => {
      const user = {
        payload: {
          sub: 'user-12345',
        },
      };
      expect(extractor.getUserId(user)).toBe('user-12345');
    });

    it('should return undefined when sub missing', () => {
      const user = {
        payload: {
          given_name: 'Test',
        },
      };
      expect(extractor.getUserId(user)).toBeUndefined();
    });

    it('should handle undefined user object returning undefined', () => {
      expect(extractor.getUserId(undefined)).toBeUndefined();
    });

    it('should handle null user object returning undefined', () => {
      expect(extractor.getUserId(null)).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long names (200+ characters)', () => {
      const longName = 'A'.repeat(201);
      const user = {
        payload: {
          given_name: longName,
          family_name: 'Test',
        },
      };
      expect(extractor.getFullName(user)).toBe(`${longName} Test`);
    });

    it('should handle names with apostrophes', () => {
      const user = {
        payload: {
          given_name: "O'Brien",
          family_name: "O'Connor",
        },
      };
      expect(extractor.getFullName(user)).toBe("O'Brien O'Connor");
    });

    it('should handle names with accents', () => {
      const user = {
        payload: {
          given_name: 'José',
          family_name: 'García',
        },
      };
      expect(extractor.getFullName(user)).toBe('José García');
    });

    it('should handle names with hyphens', () => {
      const user = {
        payload: {
          given_name: 'Mary-Jane',
          family_name: 'Parker-Smith',
        },
      };
      expect(extractor.getFullName(user)).toBe('Mary-Jane Parker-Smith');
    });

    it('should handle mixed empty and present fields correctly', () => {
      const user1 = {
        payload: {
          name: 'Valid Name',
          given_name: '',
          family_name: 'Should Not Use',
        },
      };
      expect(extractor.getFullName(user1)).toBe('Valid Name');

      const user2 = {
        payload: {
          name: '',
          given_name: 'First',
          family_name: '',
        },
      };
      expect(extractor.getFullName(user2)).toBe('First');

      const user3 = {
        payload: {
          name: '   ',
          given_name: '',
          family_name: 'Last',
        },
      };
      expect(extractor.getFullName(user3)).toBe('Last');
    });
  });
});
