import { describe, it, expect } from 'vitest';
import { Note } from '../../notes/schemas';
import { Post } from '../../posts/schemas';
import { Series } from '../../series/schemas';
import { PrayerResponse } from '../../prayer-walls/schemas/prayer.schemas';

describe('Entity Schema Extensions with Embedded User Info', () => {
  describe('Note Schema with Owner', () => {
    it('should accept note without owner field (backward compatibility)', () => {
      const noteWithoutOwner = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'My Note',
        content: 'Note content',
        date: new Date(),
        scriptureReferences: [],
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => Note.parse(noteWithoutOwner)).not.toThrow();
    });

    it('should accept note with owner field containing user info', () => {
      const noteWithOwner = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'My Note',
        content: 'Note content',
        date: new Date(),
        scriptureReferences: [],
        images: [],
        owner: {
          userId: '550e8400-e29b-41d4-a716-446655440002',
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John Doe',
          avatarUrl: 'https://example.com/avatar.jpg',
          email: 'john@example.com',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => Note.parse(noteWithOwner)).not.toThrow();
      const parsed = Note.parse(noteWithOwner);
      expect(parsed.owner).toBeDefined();
      expect(parsed.owner?.userId).toBe('550e8400-e29b-41d4-a716-446655440002');
    });
  });

  describe('Post Schema with Author', () => {
    it('should accept post without author field (backward compatibility)', () => {
      const postWithoutAuthor = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'My Post',
        content: 'Post content',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => Post.parse(postWithoutAuthor)).not.toThrow();
    });

    it('should accept post with author field containing user info', () => {
      const postWithAuthor = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'My Post',
        content: 'Post content',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        publishedAt: new Date(),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        author: {
          userId: '550e8400-e29b-41d4-a716-446655440002',
          firstName: 'Jane',
          lastName: 'Smith',
          displayName: 'Jane Smith',
          avatarUrl: null,
          email: 'jane@example.com',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => Post.parse(postWithAuthor)).not.toThrow();
      const parsed = Post.parse(postWithAuthor);
      expect(parsed.author).toBeDefined();
      expect(parsed.author?.userId).toBe('550e8400-e29b-41d4-a716-446655440002');
    });
  });

  describe('Series Schema with Author', () => {
    it('should accept series without author field (backward compatibility)', () => {
      const seriesWithoutAuthor = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'My Series',
        description: 'Series description',
        image: null,
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => Series.parse(seriesWithoutAuthor)).not.toThrow();
    });

    it('should accept series with author field containing user info', () => {
      const seriesWithAuthor = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'My Series',
        description: 'Series description',
        image: null,
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        publishedAt: new Date(),
        author: {
          userId: '550e8400-e29b-41d4-a716-446655440002',
          firstName: 'Bob',
          lastName: 'Johnson',
          displayName: 'Bob Johnson',
          avatarUrl: 'https://example.com/bob.jpg',
          email: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => Series.parse(seriesWithAuthor)).not.toThrow();
      const parsed = Series.parse(seriesWithAuthor);
      expect(parsed.author).toBeDefined();
      expect(parsed.author?.userId).toBe('550e8400-e29b-41d4-a716-446655440002');
    });
  });

  describe('PrayerResponse Schema with Author and Responder', () => {
    it('should accept prayer without author field (backward compatibility)', () => {
      const prayerWithoutAuthor = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        wall_id: '550e8400-e29b-41d4-a716-446655440002',
        author_id: '550e8400-e29b-41d4-a716-446655440003',
        parent_id: null,
        thread_depth: 0,
        content: 'Prayer request content',
        anonymity_level: 'identified',
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null,
      };

      expect(() => PrayerResponse.parse(prayerWithoutAuthor)).not.toThrow();
    });

    it('should accept prayer with author field containing user info', () => {
      const prayerWithAuthor = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        wall_id: '550e8400-e29b-41d4-a716-446655440002',
        author_id: '550e8400-e29b-41d4-a716-446655440003',
        parent_id: null,
        thread_depth: 0,
        content: 'Prayer request content',
        anonymity_level: 'identified',
        has_attachment: false,
        author: {
          userId: '550e8400-e29b-41d4-a716-446655440003',
          firstName: 'Alice',
          lastName: 'Williams',
          displayName: 'Alice Williams',
          avatarUrl: null,
          email: 'alice@example.com',
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null,
      };

      expect(() => PrayerResponse.parse(prayerWithAuthor)).not.toThrow();
      const parsed = PrayerResponse.parse(prayerWithAuthor);
      expect(parsed.author).toBeDefined();
      expect(parsed.author?.userId).toBe('550e8400-e29b-41d4-a716-446655440003');
    });

    it('should accept prayer response with both author and responder fields', () => {
      const prayerResponse = {
        id: '550e8400-e29b-41d4-a716-446655440004',
        wall_id: '550e8400-e29b-41d4-a716-446655440002',
        author_id: '550e8400-e29b-41d4-a716-446655440005',
        parent_id: '550e8400-e29b-41d4-a716-446655440001',
        thread_depth: 1,
        content: 'Praying for you!',
        anonymity_level: 'identified',
        has_attachment: false,
        author: {
          userId: '550e8400-e29b-41d4-a716-446655440005',
          firstName: 'Charlie',
          lastName: 'Brown',
          displayName: 'Charlie Brown',
          avatarUrl: 'https://example.com/charlie.jpg',
          email: null,
        },
        responder: {
          userId: '550e8400-e29b-41d4-a716-446655440003',
          firstName: 'Alice',
          lastName: 'Williams',
          displayName: 'Alice Williams',
          avatarUrl: null,
          email: 'alice@example.com',
        },
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null,
      };

      expect(() => PrayerResponse.parse(prayerResponse)).not.toThrow();
      const parsed = PrayerResponse.parse(prayerResponse);
      expect(parsed.author).toBeDefined();
      expect(parsed.author?.userId).toBe('550e8400-e29b-41d4-a716-446655440005');
      expect(parsed.responder).toBeDefined();
      expect(parsed.responder?.userId).toBe('550e8400-e29b-41d4-a716-446655440003');
    });
  });
});
