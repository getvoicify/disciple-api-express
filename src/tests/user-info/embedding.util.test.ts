import { describe, expect, it } from 'vitest';
import { embedUserInfo, extractUniqueUserIds } from '../../user-info/embedding.util';
import type { UserInfo } from '../../user-info/types';

/**
 * TDD Tests for User Info Embedding Utility
 */

describe('User Info Embedding Utility', () => {
  const mockUserInfo1: UserInfo = {
    userId: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
    avatarUrl: null,
    email: 'john@example.com',
  };

  const mockUserInfo2: UserInfo = {
    userId: 'user-2',
    firstName: 'Jane',
    lastName: 'Smith',
    displayName: 'Jane Smith',
    avatarUrl: 'https://example.com/jane.jpg',
    email: 'jane@example.com',
  };

  describe('extractUniqueUserIds', () => {
    it('should extract unique user IDs from entities', () => {
      interface MockEntity {
        id: string;
        authorId: string;
      }

      const entities: MockEntity[] = [
        { id: '1', authorId: 'user-1' },
        { id: '2', authorId: 'user-2' },
        { id: '3', authorId: 'user-1' },
      ];

      const userIds = extractUniqueUserIds(entities, (entity) => [entity.authorId]);

      expect(userIds).toHaveLength(2);
      expect(userIds).toContain('user-1');
      expect(userIds).toContain('user-2');
    });

    it('should handle entities with multiple user ID fields', () => {
      interface MockEntity {
        id: string;
        authorId: string;
        editorId: string;
      }

      const entities: MockEntity[] = [
        { id: '1', authorId: 'user-1', editorId: 'user-2' },
        { id: '2', authorId: 'user-2', editorId: 'user-3' },
      ];

      const userIds = extractUniqueUserIds(entities, (entity) => [
        entity.authorId,
        entity.editorId,
      ]);

      expect(userIds).toHaveLength(3);
      expect(userIds).toContain('user-1');
      expect(userIds).toContain('user-2');
      expect(userIds).toContain('user-3');
    });

    it('should return empty array for empty entities', () => {
      const entities: never[] = [];

      const userIds = extractUniqueUserIds(entities, () => []);

      expect(userIds).toHaveLength(0);
    });

    it('should deduplicate user IDs across multiple fields', () => {
      interface MockEntity {
        id: string;
        authorId: string;
        editorId: string;
      }

      const entities: MockEntity[] = [
        { id: '1', authorId: 'user-1', editorId: 'user-1' },
      ];

      const userIds = extractUniqueUserIds(entities, (entity) => [
        entity.authorId,
        entity.editorId,
      ]);

      expect(userIds).toHaveLength(1);
      expect(userIds[0]).toBe('user-1');
    });
  });

  describe('embedUserInfo', () => {
    it('should embed user info into entities', () => {
      interface MockEntity {
        id: string;
        authorId: string;
        author?: UserInfo;
      }

      const entities: MockEntity[] = [
        { id: '1', authorId: 'user-1' },
        { id: '2', authorId: 'user-2' },
      ];

      const userInfoMap = new Map([
        ['user-1', mockUserInfo1],
        ['user-2', mockUserInfo2],
      ]);

      const result = embedUserInfo(
        entities,
        userInfoMap,
        (entity, userMap) => ({
          ...entity,
          author: userMap.get(entity.authorId),
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0].author).toEqual(mockUserInfo1);
      expect(result[0].author?.userId).toBe('user-1');
      expect(result[0].author?.firstName).toBe('John');
      expect(result[1].author).toEqual(mockUserInfo2);
      expect(result[1].author?.userId).toBe('user-2');
    });

    it('should handle missing user info gracefully', () => {
      interface MockEntity {
        id: string;
        authorId: string;
        author?: UserInfo;
      }

      const entities: MockEntity[] = [
        { id: '1', authorId: 'user-1' },
        { id: '2', authorId: 'user-999' },
      ];

      const userInfoMap = new Map([['user-1', mockUserInfo1]]);

      const result = embedUserInfo(
        entities,
        userInfoMap,
        (entity, userMap) => ({
          ...entity,
          author: userMap.get(entity.authorId),
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0].author).toEqual(mockUserInfo1);
      expect(result[1].author).toBeUndefined();
    });

    it('should embed multiple user info fields into entities', () => {
      interface MockEntity {
        id: string;
        authorId: string;
        responderId: string;
        author?: UserInfo;
        responder?: UserInfo;
      }

      const entities: MockEntity[] = [
        { id: '1', authorId: 'user-1', responderId: 'user-2' },
      ];

      const userInfoMap = new Map([
        ['user-1', mockUserInfo1],
        ['user-2', mockUserInfo2],
      ]);

      const result = embedUserInfo(
        entities,
        userInfoMap,
        (entity, userMap) => ({
          ...entity,
          author: userMap.get(entity.authorId),
          responder: userMap.get(entity.responderId),
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].author).toEqual(mockUserInfo1);
      expect(result[0].responder).toEqual(mockUserInfo2);
    });

    it('should preserve original entity properties', () => {
      interface MockEntity {
        id: string;
        title: string;
        authorId: string;
        createdAt: Date;
        author?: UserInfo;
      }

      const now = new Date();
      const entities: MockEntity[] = [
        { id: '1', title: 'Test', authorId: 'user-1', createdAt: now },
      ];

      const userInfoMap = new Map([['user-1', mockUserInfo1]]);

      const result = embedUserInfo(
        entities,
        userInfoMap,
        (entity, userMap) => ({
          ...entity,
          author: userMap.get(entity.authorId),
        })
      );

      expect(result[0].id).toBe('1');
      expect(result[0].title).toBe('Test');
      expect(result[0].authorId).toBe('user-1');
      expect(result[0].createdAt).toBe(now);
      expect(result[0].author).toEqual(mockUserInfo1);
    });

    it('should return empty array for empty entities', () => {
      const entities: never[] = [];
      const userInfoMap = new Map<string, UserInfo>();

      const result = embedUserInfo(entities, userInfoMap, (entity) => entity);

      expect(result).toHaveLength(0);
    });
  });
});
