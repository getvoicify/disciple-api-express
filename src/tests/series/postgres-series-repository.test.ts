import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {RawDb} from '../../utils/database';
import {PostgresSeriesRepository} from '../../series/pg-repository';
import type {CreateSeriesInput, SeriesFilters, UpdateSeriesInput} from '../../series/schemas';

// Mock database functions
const createMockDb = () => {
  const mockTransactionFn = vi.fn();
  Object.assign(mockTransactionFn, {
    unsafe: vi.fn(),
  });

  const mockUnsafeFn = vi.fn();

  const mockDbFn = vi.fn();
  Object.assign(mockDbFn, {
    unsafe: mockUnsafeFn,
    begin: vi.fn((callback) => callback(mockTransactionFn)),
  });

  return { mockDb: mockDbFn, mockTransaction: mockTransactionFn, mockUnsafe: mockUnsafeFn };
};

describe('PostgresSeriesRepository', () => {
  let mockDb: any;
  let mockTransaction: any;
  let mockUnsafe: any;
  let repository: PostgresSeriesRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    const { mockDb: db, mockTransaction: tx, mockUnsafe: unsafe } = createMockDb();
    mockDb = db;
    mockTransaction = tx;
    mockUnsafe = unsafe;
    repository = new PostgresSeriesRepository(mockDb as RawDb);
  });

  describe('Constructor and Interface Implementation', () => {
    it('should implement SeriesRepository interface', () => {
      expect(repository).toBeInstanceOf(PostgresSeriesRepository);
      expect(typeof repository.create).toBe('function');
      expect(typeof repository.update).toBe('function');
      expect(typeof repository.delete).toBe('function');
      expect(typeof repository.findById).toBe('function');
      expect(typeof repository.findAll).toBe('function');
      expect(typeof repository.findByChurchId).toBe('function');
      expect(typeof repository.findByAuthorId).toBe('function');
    });

    it('should be constructed with database', () => {
      expect(() => new PostgresSeriesRepository(mockDb as RawDb)).not.toThrow();
    });
  });

  describe('create', () => {
    it('should create new series record and return Series object', async () => {
      const mockInput: CreateSeriesInput = {
        title: 'Morning Devotionals',
        description: 'Daily morning devotionals for spiritual growth',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };

      const mockDbResult = [{
        id: '550e8400-e29b-41d4-a716-446655440003',
        title: 'Morning Devotionals',
        description: 'Daily morning devotionals for spiritual growth',
        image: null,
        author_id: '550e8400-e29b-41d4-a716-446655440002',
        church_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'draft',
        published_at: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockTransaction.mockResolvedValue(mockDbResult);

      const authorId = '550e8400-e29b-41d4-a716-446655440002';
      const result = await repository.create(mockInput, authorId);

      expect(mockDb.begin).toHaveBeenCalledTimes(1);
      expect(mockTransaction).toHaveBeenCalled();

      const callArgs = mockTransaction.mock.calls[0];
      expect(callArgs).toContain(mockInput.title);
      expect(callArgs).toContain(mockInput.description);
      expect(callArgs).toContain(authorId);
      expect(callArgs).toContain(mockInput.churchId);

      expect(result).toMatchObject({
        id: '550e8400-e29b-41d4-a716-446655440003',
        title: 'Morning Devotionals',
        description: 'Daily morning devotionals for spiritual growth',
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'draft',
        publishedAt: null
      });
    });

    it('should create series with image URL', async () => {
      const mockInput: CreateSeriesInput = {
        title: 'Evening Devotionals',
        description: 'Daily evening reflections',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        image: 'https://example.com/series-image.jpg'
      };

      const mockDbResult = [{
        id: '550e8400-e29b-41d4-a716-446655440003',
        title: 'Evening Devotionals',
        description: 'Daily evening reflections',
        image: 'https://example.com/series-image.jpg',
        author_id: '550e8400-e29b-41d4-a716-446655440002',
        church_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'draft',
        published_at: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockTransaction.mockResolvedValue(mockDbResult);

      const result = await repository.create(mockInput, '550e8400-e29b-41d4-a716-446655440002');

      expect(result.image).toBe('https://example.com/series-image.jpg');
    });

    it('should handle database errors during create', async () => {
      const mockInput: CreateSeriesInput = {
        title: 'Test Series',
        description: 'Test description',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };

      mockTransaction.mockRejectedValue(new Error('Database error'));

      await expect(
        repository.create(mockInput, '550e8400-e29b-41d4-a716-446655440002')
      ).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    it('should update series and return updated Series object', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440003';
      const mockInput: UpdateSeriesInput = {
        title: 'Updated Title',
        description: 'Updated description'
      };

      const mockDbResult = [{
        id: seriesId,
        title: 'Updated Title',
        description: 'Updated description',
        image: null,
        author_id: '550e8400-e29b-41d4-a716-446655440002',
        church_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'draft',
        published_at: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-02T00:00:00Z')
      }];

      mockUnsafe.mockResolvedValue(mockDbResult);

      const result = await repository.update(seriesId, mockInput);

      expect(mockUnsafe).toHaveBeenCalled();
      const callArgs = mockUnsafe.mock.calls[0];
      expect(callArgs[1]).toContain(seriesId);
      expect(callArgs[1]).toContain(mockInput.title);
      expect(callArgs[1]).toContain(mockInput.description);

      expect(result).toMatchObject({
        id: seriesId,
        title: 'Updated Title',
        description: 'Updated description'
      });
    });

    it('should update only status when provided', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440003';
      const mockInput: UpdateSeriesInput = {
        status: 'published'
      };

      const mockDbResult = [{
        id: seriesId,
        title: 'Original Title',
        description: 'Original description',
        image: null,
        author_id: '550e8400-e29b-41d4-a716-446655440002',
        church_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'published',
        published_at: new Date('2024-01-02T00:00:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-02T00:00:00Z')
      }];

      mockUnsafe.mockResolvedValue(mockDbResult);

      const result = await repository.update(seriesId, mockInput);

      expect(result?.status).toBe('published');
      expect(result?.publishedAt).toBeInstanceOf(Date);
    });

    it('should return null when series not found', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440999';
      const mockInput: UpdateSeriesInput = {
        title: 'Updated Title'
      };

      mockUnsafe.mockResolvedValue([]);

      const result = await repository.update(seriesId, mockInput);

      expect(result).toBeNull();
    });

    it('should handle database errors during update', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440003';
      const mockInput: UpdateSeriesInput = {
        title: 'Updated Title'
      };

      mockUnsafe.mockRejectedValue(new Error('Database error'));

      await expect(repository.update(seriesId, mockInput)).rejects.toThrow('Database error');
    });
  });

  describe('delete', () => {
    it('should delete series and return true', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440003';

      mockDb.mockResolvedValue([{ id: seriesId }]);

      const result = await repository.delete(seriesId);

      expect(mockDb).toHaveBeenCalled();
      const callArgs = mockDb.mock.calls[0];
      expect(callArgs).toContain(seriesId);

      expect(result).toBe(true);
    });

    it('should return false when series not found', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440999';

      mockDb.mockResolvedValue([]);

      const result = await repository.delete(seriesId);

      expect(result).toBe(false);
    });

    it('should handle database errors during delete', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440003';

      mockDb.mockRejectedValue(new Error('Database error'));

      await expect(repository.delete(seriesId)).rejects.toThrow('Database error');
    });
  });

  describe('findById', () => {
    it('should find series by id and return Series object', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440003';

      const mockDbResult = [{
        id: seriesId,
        title: 'Test Series',
        description: 'Test description',
        image: 'https://example.com/image.jpg',
        author_id: '550e8400-e29b-41d4-a716-446655440002',
        church_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'published',
        published_at: new Date('2024-01-01T00:00:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockDb.mockResolvedValue(mockDbResult);

      const result = await repository.findById(seriesId);

      expect(mockDb).toHaveBeenCalled();
      const callArgs = mockDb.mock.calls[0];
      expect(callArgs).toContain(seriesId);

      expect(result).toMatchObject({
        id: seriesId,
        title: 'Test Series',
        description: 'Test description',
        status: 'published'
      });
    });

    it('should return null when series not found', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440999';

      mockDb.mockResolvedValue([]);

      const result = await repository.findById(seriesId);

      expect(result).toBeNull();
    });

    it('should handle database errors during findById', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440003';

      mockDb.mockRejectedValue(new Error('Database error'));

      await expect(repository.findById(seriesId)).rejects.toThrow('Database error');
    });
  });

  describe('findAll', () => {
    it('should find all series without filters', async () => {
      const mockDbResult = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Series 1',
          description: 'Description 1',
          image: null,
          author_id: '550e8400-e29b-41d4-a716-446655440002',
          church_id: '550e8400-e29b-41d4-a716-446655440003',
          status: 'published',
          published_at: new Date('2024-01-01T00:00:00Z'),
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z')
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440004',
          title: 'Series 2',
          description: 'Description 2',
          image: null,
          author_id: '550e8400-e29b-41d4-a716-446655440002',
          church_id: '550e8400-e29b-41d4-a716-446655440003',
          status: 'draft',
          published_at: null,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z')
        }
      ];

      mockDb.mockResolvedValue(mockDbResult);

      const result = await repository.findAll();

      expect(mockDb).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Series 1');
      expect(result[1].title).toBe('Series 2');
    });

    it('should find series filtered by churchId', async () => {
      const filters: SeriesFilters = {
        churchId: '550e8400-e29b-41d4-a716-446655440003'
      };

      const mockDbResult = [{
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Series 1',
        description: 'Description 1',
        image: null,
        author_id: '550e8400-e29b-41d4-a716-446655440002',
        church_id: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        published_at: new Date('2024-01-01T00:00:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockUnsafe.mockResolvedValue(mockDbResult);

      const result = await repository.findAll(filters);

      expect(mockUnsafe).toHaveBeenCalled();
      const callArgs = mockUnsafe.mock.calls[0];
      expect(callArgs[1]).toContain(filters.churchId);

      expect(result).toHaveLength(1);
      expect(result[0].churchId).toBe(filters.churchId);
    });

    it('should find series filtered by status', async () => {
      const filters: SeriesFilters = {
        status: 'published'
      };

      const mockDbResult = [{
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Published Series',
        description: 'Description',
        image: null,
        author_id: '550e8400-e29b-41d4-a716-446655440002',
        church_id: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        published_at: new Date('2024-01-01T00:00:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockUnsafe.mockResolvedValue(mockDbResult);

      const result = await repository.findAll(filters);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('published');
    });

    it('should find series filtered by authorizedIds', async () => {
      const filters: SeriesFilters = {
        authorizedIds: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002']
      };

      const mockDbResult = [{
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Series 1',
        description: 'Description 1',
        image: null,
        author_id: '550e8400-e29b-41d4-a716-446655440002',
        church_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'published',
        published_at: new Date('2024-01-01T00:00:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockUnsafe.mockResolvedValue(mockDbResult);

      const result = await repository.findAll(filters);

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no series found', async () => {
      mockDb.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should handle database errors during findAll', async () => {
      mockDb.mockRejectedValue(new Error('Database error'));

      await expect(repository.findAll()).rejects.toThrow('Database error');
    });
  });

  describe('findByChurchId', () => {
    it('should find all series for a church', async () => {
      const churchId = '550e8400-e29b-41d4-a716-446655440003';

      const mockDbResult = [{
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Church Series',
        description: 'Description',
        image: null,
        author_id: '550e8400-e29b-41d4-a716-446655440002',
        church_id: churchId,
        status: 'published',
        published_at: new Date('2024-01-01T00:00:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockDb.mockResolvedValue(mockDbResult);

      const result = await repository.findByChurchId(churchId);

      expect(mockDb).toHaveBeenCalled();
      const callArgs = mockDb.mock.calls[0];
      expect(callArgs).toContain(churchId);

      expect(result).toHaveLength(1);
      expect(result[0].churchId).toBe(churchId);
    });

    it('should return empty array when no series found for church', async () => {
      const churchId = '550e8400-e29b-41d4-a716-446655440999';

      mockDb.mockResolvedValue([]);

      const result = await repository.findByChurchId(churchId);

      expect(result).toEqual([]);
    });
  });

  describe('findByAuthorId', () => {
    it('should find all series by author', async () => {
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockDbResult = [{
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Author Series',
        description: 'Description',
        image: null,
        author_id: authorId,
        church_id: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        published_at: new Date('2024-01-01T00:00:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockDb.mockResolvedValue(mockDbResult);

      const result = await repository.findByAuthorId(authorId);

      expect(mockDb).toHaveBeenCalled();
      const callArgs = mockDb.mock.calls[0];
      expect(callArgs).toContain(authorId);

      expect(result).toHaveLength(1);
      expect(result[0].authorId).toBe(authorId);
    });

    it('should return empty array when no series found for author', async () => {
      const authorId = '550e8400-e29b-41d4-a716-446655440999';

      mockDb.mockResolvedValue([]);

      const result = await repository.findByAuthorId(authorId);

      expect(result).toEqual([]);
    });
  });
});
