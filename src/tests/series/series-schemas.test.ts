import { describe, it, expect } from 'vitest';
import {
  Series,
  CreateSeriesInput,
  UpdateSeriesInput,
  SeriesFilters,
  SeriesStatus,
  type Series as SeriesType,
  type CreateSeriesInput as CreateSeriesInputType,
  type UpdateSeriesInput as UpdateSeriesInputType,
  type SeriesFilters as SeriesFiltersType
} from '../../series/schemas';

describe('Series Schemas', () => {
  describe('SeriesStatus', () => {
    it('should accept "draft" status', () => {
      const result = SeriesStatus.parse('draft');
      expect(result).toBe('draft');
    });

    it('should accept "published" status', () => {
      const result = SeriesStatus.parse('published');
      expect(result).toBe('published');
    });

    it('should reject invalid status', () => {
      expect(() => SeriesStatus.parse('invalid')).toThrow();
    });
  });

  describe('Series', () => {
    it('should validate a complete series object', () => {
      const series = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Morning Devotionals',
        description: 'Daily morning devotionals for spiritual growth',
        image: 'https://example.com/image.jpg',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'draft' as const,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = Series.parse(series);
      expect(result).toEqual(series);
    });

    it('should validate series with published status and publishedAt date', () => {
      const publishedDate = new Date();
      const series = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Morning Devotionals',
        description: 'Daily morning devotionals',
        image: 'https://example.com/image.jpg',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published' as const,
        publishedAt: publishedDate,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = Series.parse(series);
      expect(result.status).toBe('published');
      expect(result.publishedAt).toEqual(publishedDate);
    });

    it('should require id to be a UUID', () => {
      const series = {
        id: 'not-a-uuid',
        title: 'Test',
        description: 'Test description',
        image: 'https://example.com/image.jpg',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'draft' as const,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => Series.parse(series)).toThrow();
    });

    it('should require title to be non-empty', () => {
      const series = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: '',
        description: 'Test description',
        image: 'https://example.com/image.jpg',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'draft' as const,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => Series.parse(series)).toThrow();
    });

    it('should allow image to be null', () => {
      const series = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Test Series',
        description: 'Test description',
        image: null,
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'draft' as const,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = Series.parse(series);
      expect(result.image).toBeNull();
    });
  });

  describe('CreateSeriesInput', () => {
    it('should validate valid input with required fields only', () => {
      const input = {
        title: 'New Series',
        description: 'A new devotional series',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };

      const result = CreateSeriesInput.parse(input);
      expect(result.title).toBe('New Series');
      expect(result.description).toBe('A new devotional series');
      expect(result.churchId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should validate input with image URL', () => {
      const input = {
        title: 'New Series',
        description: 'A new devotional series',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        image: 'https://example.com/series-image.jpg'
      };

      const result = CreateSeriesInput.parse(input);
      expect(result.image).toBe('https://example.com/series-image.jpg');
    });

    it('should reject invalid image URL', () => {
      const input = {
        title: 'New Series',
        description: 'A new devotional series',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        image: 'not-a-url'
      };

      expect(() => CreateSeriesInput.parse(input)).toThrow();
    });

    it('should require title to be at least 1 character', () => {
      const input = {
        title: '',
        description: 'A new devotional series',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };

      expect(() => CreateSeriesInput.parse(input)).toThrow();
    });

    it('should require title to be max 255 characters', () => {
      const input = {
        title: 'a'.repeat(256),
        description: 'A new devotional series',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };

      expect(() => CreateSeriesInput.parse(input)).toThrow();
    });

    it('should require description to be non-empty', () => {
      const input = {
        title: 'New Series',
        description: '',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };

      expect(() => CreateSeriesInput.parse(input)).toThrow();
    });

    it('should require churchId to be a valid UUID', () => {
      const input = {
        title: 'New Series',
        description: 'A new devotional series',
        churchId: 'not-a-uuid'
      };

      expect(() => CreateSeriesInput.parse(input)).toThrow();
    });
  });

  describe('UpdateSeriesInput', () => {
    it('should allow updating title only', () => {
      const input = {
        title: 'Updated Title'
      };

      const result = UpdateSeriesInput.parse(input);
      expect(result.title).toBe('Updated Title');
    });

    it('should allow updating description only', () => {
      const input = {
        description: 'Updated description'
      };

      const result = UpdateSeriesInput.parse(input);
      expect(result.description).toBe('Updated description');
    });

    it('should allow updating status only', () => {
      const input = {
        status: 'published' as const
      };

      const result = UpdateSeriesInput.parse(input);
      expect(result.status).toBe('published');
    });

    it('should allow updating image only', () => {
      const input = {
        image: 'https://example.com/new-image.jpg'
      };

      const result = UpdateSeriesInput.parse(input);
      expect(result.image).toBe('https://example.com/new-image.jpg');
    });

    it('should allow updating multiple fields', () => {
      const input = {
        title: 'Updated Title',
        description: 'Updated description',
        status: 'published' as const,
        image: 'https://example.com/new-image.jpg'
      };

      const result = UpdateSeriesInput.parse(input);
      expect(result.title).toBe('Updated Title');
      expect(result.description).toBe('Updated description');
      expect(result.status).toBe('published');
      expect(result.image).toBe('https://example.com/new-image.jpg');
    });

    it('should reject invalid status in update', () => {
      const input = {
        status: 'invalid'
      };

      expect(() => UpdateSeriesInput.parse(input)).toThrow();
    });

    it('should reject invalid image URL in update', () => {
      const input = {
        image: 'not-a-url'
      };

      expect(() => UpdateSeriesInput.parse(input)).toThrow();
    });

    it('should allow empty update object', () => {
      const input = {};

      const result = UpdateSeriesInput.parse(input);
      expect(result).toEqual({});
    });
  });

  describe('SeriesFilters', () => {
    it('should parse empty filters with default authorizedIds', () => {
      const filters = {};

      const result = SeriesFilters.parse(filters);
      expect(result.authorizedIds).toEqual([]);
    });

    it('should parse churchId filter', () => {
      const filters = {
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };

      const result = SeriesFilters.parse(filters);
      expect(result.churchId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should parse authorId filter', () => {
      const filters = {
        authorId: '550e8400-e29b-41d4-a716-446655440002'
      };

      const result = SeriesFilters.parse(filters);
      expect(result.authorId).toBe('550e8400-e29b-41d4-a716-446655440002');
    });

    it('should parse status filter', () => {
      const filters = {
        status: 'published' as const
      };

      const result = SeriesFilters.parse(filters);
      expect(result.status).toBe('published');
    });

    it('should parse authorizedIds filter with default empty array', () => {
      const filters = {};

      const result = SeriesFilters.parse(filters);
      expect(result.authorizedIds).toEqual([]);
    });

    it('should parse authorizedIds filter with provided array', () => {
      const filters = {
        authorizedIds: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002']
      };

      const result = SeriesFilters.parse(filters);
      expect(result.authorizedIds).toEqual(['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002']);
    });

    it('should parse multiple filters', () => {
      const filters = {
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'published' as const,
        authorId: '550e8400-e29b-41d4-a716-446655440002'
      };

      const result = SeriesFilters.parse(filters);
      expect(result.churchId).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(result.status).toBe('published');
      expect(result.authorId).toBe('550e8400-e29b-41d4-a716-446655440002');
    });

    it('should reject invalid UUID in churchId filter', () => {
      const filters = {
        churchId: 'not-a-uuid'
      };

      expect(() => SeriesFilters.parse(filters)).toThrow();
    });

    it('should reject invalid status in filter', () => {
      const filters = {
        status: 'invalid'
      };

      expect(() => SeriesFilters.parse(filters)).toThrow();
    });
  });
});
