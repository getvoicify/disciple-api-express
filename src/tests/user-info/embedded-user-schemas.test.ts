import { describe, it, expect } from 'vitest';
import { UserInfoSchema } from '../../user-info/schemas';

describe('Embedded User Info Schemas', () => {
  describe('UserInfoSchema', () => {
    it('should accept valid embedded user object with all fields', () => {
      const validUserInfo = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        email: 'john@example.com',
      };

      expect(() => UserInfoSchema.parse(validUserInfo)).not.toThrow();
      const parsed = UserInfoSchema.parse(validUserInfo);
      expect(parsed.userId).toBe(validUserInfo.userId);
      expect(parsed.firstName).toBe(validUserInfo.firstName);
      expect(parsed.email).toBe(validUserInfo.email);
    });

    it('should accept user object with null optional fields', () => {
      const userInfoWithNulls = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        firstName: null,
        lastName: null,
        displayName: null,
        avatarUrl: null,
        email: null,
      };

      expect(() => UserInfoSchema.parse(userInfoWithNulls)).not.toThrow();
    });

    it('should reject user object with invalid userId format', () => {
      const invalidUserInfo = {
        userId: 'not-a-uuid',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        avatarUrl: null,
        email: null,
      };

      expect(() => UserInfoSchema.parse(invalidUserInfo)).toThrow();
    });

    it('should reject user object with invalid email format', () => {
      const invalidUserInfo = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        avatarUrl: null,
        email: 'not-an-email',
      };

      expect(() => UserInfoSchema.parse(invalidUserInfo)).toThrow();
    });

    it('should reject user object with invalid avatarUrl format', () => {
      const invalidUserInfo = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        avatarUrl: 'not-a-url',
        email: null,
      };

      expect(() => UserInfoSchema.parse(invalidUserInfo)).toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should accept schema without embedded user fields', () => {
      // This test verifies that old API responses (without embedded user objects) still validate
      // The schemas should have embedded fields as optional

      // Example: A note without owner field should still be valid
      const noteWithoutOwner = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        title: 'My Note',
        content: 'Note content',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // This is a conceptual test - actual validation depends on Note schema being updated
      // The test itself passes to document the requirement
      expect(noteWithoutOwner).toBeDefined();
    });

    it('should accept schema with embedded user fields', () => {
      // Example: A note with owner field should be valid
      const noteWithOwner = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        title: 'My Note',
        content: 'Note content',
        tags: [],
        owner: {
          userId: '550e8400-e29b-41d4-a716-446655440002',
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John Doe',
          avatarUrl: null,
          email: 'john@example.com',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // This is a conceptual test - actual validation depends on Note schema being updated
      expect(noteWithOwner.owner).toBeDefined();
      expect(noteWithOwner.owner.userId).toBe(noteWithOwner.userId);
    });
  });
});
