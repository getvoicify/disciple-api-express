import { describe, it, expect } from 'vitest';
import {
  PostStatus,
  Post,
  CreatePostInput,
  UpdatePostInput,
  PostFilters,
  ScriptureReference
} from '../../posts/schemas';

describe('Post Schemas', () => {
  describe('PostStatus enum', () => {
    it('should accept valid status values', () => {
      expect(() => PostStatus.parse('draft')).not.toThrow();
      expect(() => PostStatus.parse('published')).not.toThrow();
    });

    it('should reject invalid status values', () => {
      expect(() => PostStatus.parse('pending')).toThrow();
      expect(() => PostStatus.parse('archived')).toThrow();
      expect(() => PostStatus.parse('')).toThrow();
    });
  });

  describe('ScriptureReference schema', () => {
    it('should accept valid scripture reference', () => {
      const validRef = {
        book: 'John',
        chapter: 3,
        verse: 16
      };
      expect(() => ScriptureReference.parse(validRef)).not.toThrow();
    });

    it('should accept scripture reference with end verse', () => {
      const validRef = {
        book: 'John',
        chapter: 3,
        verse: 16,
        endVerse: 18
      };
      expect(() => ScriptureReference.parse(validRef)).not.toThrow();
    });

    it('should reject invalid scripture reference', () => {
      expect(() => ScriptureReference.parse({ book: '', chapter: 3, verse: 16 })).toThrow();
      expect(() => ScriptureReference.parse({ book: 'John', chapter: 0, verse: 16 })).toThrow();
      expect(() => ScriptureReference.parse({ book: 'John', chapter: 3, verse: -1 })).toThrow();
    });
  });

  describe('CreatePostInput schema', () => {
    it('should accept valid post creation input', () => {
      const validInput = {
        title: 'Test Post',
        content: 'This is test content',
        churchId: '123e4567-e89b-12d3-a456-426614174000'
      };
      expect(() => CreatePostInput.parse(validInput)).not.toThrow();
    });

    it('should accept post with all optional fields', () => {
      const validInput = {
        title: 'Test Post',
        content: 'This is test content',
        churchId: '123e4567-e89b-12d3-a456-426614174000',
        image: 'https://example.com/image.jpg',
        tags: ['devotional', 'faith'],
        categories: ['sermon', 'teaching'],
        scriptureReferences: [{ book: 'John', chapter: 3, verse: 16 }],
        seriesId: '123e4567-e89b-12d3-a456-426614174001',
        seriesName: 'Advent Series'
      };
      expect(() => CreatePostInput.parse(validInput)).not.toThrow();
    });

    it('should reject post with invalid title', () => {
      expect(() => CreatePostInput.parse({
        title: '',
        content: 'Content',
        churchId: '123e4567-e89b-12d3-a456-426614174000'
      })).toThrow();
    });

    it('should reject post with invalid church ID', () => {
      expect(() => CreatePostInput.parse({
        title: 'Title',
        content: 'Content',
        churchId: 'invalid-uuid'
      })).toThrow();
    });

    it('should reject post with invalid image URL', () => {
      expect(() => CreatePostInput.parse({
        title: 'Title',
        content: 'Content',
        churchId: '123e4567-e89b-12d3-a456-426614174000',
        image: 'not-a-url'
      })).toThrow();
    });
  });

  describe('UpdatePostInput schema', () => {
    it('should accept partial updates', () => {
      expect(() => UpdatePostInput.parse({ title: 'Updated Title' })).not.toThrow();
      expect(() => UpdatePostInput.parse({ content: 'Updated content' })).not.toThrow();
      expect(() => UpdatePostInput.parse({ status: 'published' })).not.toThrow();
    });

    it('should accept empty object for no updates', () => {
      expect(() => UpdatePostInput.parse({})).not.toThrow();
    });

    it('should reject invalid status in update', () => {
      expect(() => UpdatePostInput.parse({ status: 'invalid' })).toThrow();
    });

    it('should reject invalid title in update', () => {
      expect(() => UpdatePostInput.parse({ title: '' })).toThrow();
    });
  });

  describe('PostFilters schema', () => {
    it('should accept empty filters', () => {
      expect(() => PostFilters.parse({})).not.toThrow();
    });

    it('should accept all filter options', () => {
      const validFilters = {
        authorizedIds: ['123e4567-e89b-12d3-a456-426614174000'],
        churchId: '123e4567-e89b-12d3-a456-426614174001',
        authorId: '123e4567-e89b-12d3-a456-426614174002',
        status: 'published',
        seriesId: '123e4567-e89b-12d3-a456-426614174003',
        tags: ['faith', 'devotional'],
        categories: ['sermon'],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        scripture: {
          book: 'John',
          chapter: 3,
          verse: 16
        }
      };
      expect(() => PostFilters.parse(validFilters)).not.toThrow();
    });

    it('should accept partial scripture filter', () => {
      expect(() => PostFilters.parse({
        scripture: { book: 'John' }
      })).not.toThrow();

      expect(() => PostFilters.parse({
        scripture: { book: 'John', chapter: 3 }
      })).not.toThrow();
    });

    it('should reject invalid status filter', () => {
      expect(() => PostFilters.parse({ status: 'invalid' })).toThrow();
    });
  });

  describe('Post schema', () => {
    it('should accept valid post object', () => {
      const validPost = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Post',
        content: 'Test content',
        authorId: '123e4567-e89b-12d3-a456-426614174001',
        churchId: '123e4567-e89b-12d3-a456-426614174002',
        status: 'draft',
        publishedAt: null,
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      expect(() => Post.parse(validPost)).not.toThrow();
    });

    it('should accept published post with published date', () => {
      const validPost = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Post',
        content: 'Test content',
        authorId: '123e4567-e89b-12d3-a456-426614174001',
        churchId: '123e4567-e89b-12d3-a456-426614174002',
        status: 'published',
        publishedAt: new Date(),
        image: 'https://example.com/image.jpg',
        tags: ['faith'],
        categories: ['sermon'],
        scriptureReferences: [{ book: 'John', chapter: 3, verse: 16 }],
        seriesId: '123e4567-e89b-12d3-a456-426614174003',
        seriesName: 'Advent Series',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      expect(() => Post.parse(validPost)).not.toThrow();
    });

    it('should reject post with invalid UUID', () => {
      expect(() => Post.parse({
        id: 'invalid-uuid',
        title: 'Test',
        content: 'Content',
        authorId: '123e4567-e89b-12d3-a456-426614174000',
        churchId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      })).toThrow();
    });
  });
});