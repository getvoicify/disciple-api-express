import { describe, expect, it } from 'vitest';
import { extractUniqueChurchIds, embedChurchInfo } from '../../church-info/embedding.util';
import type { ChurchInfo } from '../../church-info/types';

describe('Church Embedding Utilities', () => {
  const CHURCH_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
  const CHURCH_ID_2 = '550e8400-e29b-41d4-a716-446655440002';

  describe('extractUniqueChurchIds', () => {
    it('should extract unique church IDs from entity arrays', () => {
      const posts = [
        { id: '1', churchId: CHURCH_ID_1, title: 'Post 1' },
        { id: '2', churchId: CHURCH_ID_2, title: 'Post 2' },
        { id: '3', churchId: CHURCH_ID_1, title: 'Post 3' },
      ];

      const churchIds = extractUniqueChurchIds(posts, (post) => [post.churchId]);

      expect(churchIds).toHaveLength(2);
      expect(churchIds).toContain(CHURCH_ID_1);
      expect(churchIds).toContain(CHURCH_ID_2);
    });

    it('should return empty array for empty input', () => {
      const result = extractUniqueChurchIds([], () => []);
      expect(result).toEqual([]);
    });
  });

  describe('embedChurchInfo', () => {
    it('should embed church info into entity arrays', () => {
      const posts = [
        { id: '1', churchId: CHURCH_ID_1, title: 'Post 1' },
        { id: '2', churchId: CHURCH_ID_2, title: 'Post 2' },
      ];

      const churchInfoMap = new Map<string, ChurchInfo>([
        [
          CHURCH_ID_1,
          {
            id: CHURCH_ID_1,
            slug: 'church-1',
            name: 'Church 1',
            description: 'Description 1',
            logoUrl: 'https://example.com/logo1.jpg',
            byline: 'Byline 1',
          },
        ],
        [
          CHURCH_ID_2,
          {
            id: CHURCH_ID_2,
            slug: 'church-2',
            name: 'Church 2',
            description: 'Description 2',
            logoUrl: 'https://example.com/logo2.jpg',
            byline: 'Byline 2',
          },
        ],
      ]);

      const result = embedChurchInfo(
        posts,
        (post) => [post.churchId],
        churchInfoMap,
        (post, churchMap) => ({
          ...post,
          church: churchMap.get(post.churchId),
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0].church).toBeDefined();
      expect(result[0].church?.name).toBe('Church 1');
      expect(result[1].church?.name).toBe('Church 2');
    });

    it('should handle missing church info gracefully', () => {
      const posts = [{ id: '1', churchId: CHURCH_ID_1, title: 'Post 1' }];

      const churchInfoMap = new Map<string, ChurchInfo>();

      const result = embedChurchInfo(
        posts,
        (post) => [post.churchId],
        churchInfoMap,
        (post, churchMap) => ({
          ...post,
          church: churchMap.get(post.churchId),
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].church).toBeUndefined();
    });
  });
});
