import { describe, expect, it } from 'vitest';
import { extractUniqueIds, embedInfo } from '../../utils/embedding.util';

describe('Generic Embedding Utilities', () => {
  describe('extractUniqueIds', () => {
    it('should extract unique IDs from entity arrays', () => {
      const posts = [
        { id: '1', authorId: 'user-1', churchId: 'church-1' },
        { id: '2', authorId: 'user-2', churchId: 'church-2' },
        { id: '3', authorId: 'user-1', churchId: 'church-1' },
      ];

      const authorIds = extractUniqueIds(posts, (post) => [post.authorId]);
      const churchIds = extractUniqueIds(posts, (post) => [post.churchId]);

      expect(authorIds).toHaveLength(2);
      expect(authorIds).toContain('user-1');
      expect(authorIds).toContain('user-2');

      expect(churchIds).toHaveLength(2);
      expect(churchIds).toContain('church-1');
      expect(churchIds).toContain('church-2');
    });

    it('should return empty array for empty input', () => {
      const result = extractUniqueIds([], () => []);
      expect(result).toEqual([]);
    });

    it('should handle entities with multiple IDs per entity', () => {
      const conversations = [
        { id: '1', participantIds: ['user-1', 'user-2'] },
        { id: '2', participantIds: ['user-2', 'user-3'] },
      ];

      const participantIds = extractUniqueIds(
        conversations,
        (conv) => conv.participantIds
      );

      expect(participantIds).toHaveLength(3);
      expect(participantIds).toContain('user-1');
      expect(participantIds).toContain('user-2');
      expect(participantIds).toContain('user-3');
    });
  });

  describe('embedInfo', () => {
    it('should embed info objects into entity arrays', () => {
      type Post = { id: string; authorId: string; author?: { name: string } };
      const posts: Post[] = [
        { id: '1', authorId: 'user-1' },
        { id: '2', authorId: 'user-2' },
      ];

      const authorMap = new Map([
        ['user-1', { name: 'John Doe' }],
        ['user-2', { name: 'Jane Smith' }],
      ]);

      const result = embedInfo(
        posts,
        authorMap,
        (post, authors) => ({
          ...post,
          author: authors.get(post.authorId),
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0].author?.name).toBe('John Doe');
      expect(result[1].author?.name).toBe('Jane Smith');
    });

    it('should handle missing info gracefully', () => {
      type Note = { id: string; churchId: string; church?: { name: string } };
      const notes: Note[] = [{ id: '1', churchId: 'church-1' }];

      const churchMap = new Map<string, { name: string }>();

      const result = embedInfo(
        notes,
        churchMap,
        (note, churches) => ({
          ...note,
          church: churches.get(note.churchId),
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].church).toBeUndefined();
    });

    it('should work with different info types', () => {
      type Series = {
        id: string;
        churchId: string;
        church?: { id: string; name: string };
      };
      const series: Series[] = [
        { id: '1', churchId: 'church-1' },
        { id: '2', churchId: 'church-2' },
      ];

      const churchInfo = new Map([
        ['church-1', { id: 'church-1', name: 'First Church' }],
        ['church-2', { id: 'church-2', name: 'Second Church' }],
      ]);

      const result = embedInfo(
        series,
        churchInfo,
        (s, churches) => ({
          ...s,
          church: churches.get(s.churchId),
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0].church?.name).toBe('First Church');
      expect(result[1].church?.name).toBe('Second Church');
    });
  });
});
