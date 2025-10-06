import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawDb } from '../../utils/database';
import { PostgresGalleryRepository } from '../../gallery/pg-repository';
import type { GalleryItemInput } from '../../gallery/repository';

// Mock database functions
const createMockDb = () => {
  const mockTransactionFn = vi.fn();
  Object.assign(mockTransactionFn, {
    unsafe: vi.fn(),
  });

  const mockDbFn = vi.fn();
  Object.assign(mockDbFn, {
    unsafe: vi.fn(),
    begin: vi.fn((callback) => callback(mockTransactionFn)),
  });

  return { mockDb: mockDbFn, mockTransaction: mockTransactionFn };
};

describe('PostgresGalleryRepository', () => {
  let mockDb: any;
  let mockTransaction: any;
  let repository: PostgresGalleryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    const { mockDb: db, mockTransaction: tx } = createMockDb();
    mockDb = db;
    mockTransaction = tx;
    repository = new PostgresGalleryRepository(mockDb as RawDb);
  });

  describe('Constructor and Interface Implementation', () => {
    it('should implement GalleryRepository interface', () => {
      expect(repository).toBeInstanceOf(PostgresGalleryRepository);
      expect(typeof repository.create).toBe('function');
      expect(typeof repository.findByChurchId).toBe('function');
      expect(typeof repository.addMediaItems).toBe('function');
      expect(typeof repository.findById).toBe('function');
      expect(typeof repository.removeMediaItem).toBe('function');
      expect(typeof repository.getGalleryWithItems).toBe('function');
    });

    it('should be constructed with database connection', () => {
      expect(() => new PostgresGalleryRepository(mockDb as RawDb)).not.toThrow();
    });
  });

  describe('create', () => {
    it('should throw error when database insert fails', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.mockRejectedValue(dbError);

      const churchId = 'church-123';

      await expect(repository.create(churchId)).rejects.toThrow('Failed to create gallery');
    });

    it('should throw error when insert returns no data', async () => {
      mockDb.mockResolvedValue([]);

      const churchId = 'church-123';

      await expect(repository.create(churchId)).rejects.toThrow('Gallery creation returned no data');
    });

    it('should throw error when insert returns undefined', async () => {
      mockDb.mockResolvedValue([undefined]);

      const churchId = 'church-123';

      await expect(repository.create(churchId)).rejects.toThrow('Gallery creation returned no data');
    });

    it('should create gallery successfully', async () => {
      const mockResult = [{
        id: 'gallery-uuid-123',
        churchId: 'church-123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      }];

      mockDb.mockResolvedValue(mockResult);

      const result = await repository.create('church-123');

      expect(mockDb).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: 'gallery-uuid-123',
        churchId: 'church-123',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });
  });

  describe('findByChurchId', () => {
    it('should throw error when database query fails', async () => {
      const dbError = new Error('Connection timeout');
      mockDb.mockRejectedValue(dbError);

      await expect(repository.findByChurchId('church-123')).rejects.toThrow('Failed to find gallery by church ID');
    });

    it('should return null when gallery not found', async () => {
      mockDb.mockResolvedValue([]);

      const result = await repository.findByChurchId('church-123');

      expect(result).toBeNull();
    });

    it('should return gallery when found', async () => {
      const mockResult = [{
        id: 'gallery-uuid-123',
        churchId: 'church-123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      }];

      mockDb.mockResolvedValue(mockResult);

      const result = await repository.findByChurchId('church-123');

      expect(result).toEqual(mockResult[0]);
    });
  });

  describe('findById', () => {
    it('should throw error when database query fails', async () => {
      const dbError = new Error('Query execution failed');
      mockDb.mockRejectedValue(dbError);

      await expect(repository.findById('gallery-123')).rejects.toThrow('Failed to find gallery by ID');
    });

    it('should return null when gallery not found', async () => {
      mockDb.mockResolvedValue([]);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return gallery when found', async () => {
      const mockResult = [{
        id: 'gallery-uuid-123',
        churchId: 'church-123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      }];

      mockDb.mockResolvedValue(mockResult);

      const result = await repository.findById('gallery-uuid-123');

      expect(result).toEqual(mockResult[0]);
    });
  });

  describe('addMediaItems', () => {
    it('should return empty array when items array is empty', async () => {
      const result = await repository.addMediaItems('gallery-123', []);

      expect(result).toEqual([]);
      expect(mockDb.begin).not.toHaveBeenCalled();
    });

    it('should throw error when database insert fails', async () => {
      const items: GalleryItemInput[] = [
        { mediaId: 'media-1', thumbnailId: 'thumb-1' },
        { mediaId: 'media-2', thumbnailId: 'thumb-2' }
      ];

      const dbError = new Error('Constraint violation');
      mockTransaction.mockRejectedValue(dbError);

      await expect(repository.addMediaItems('gallery-123', items)).rejects.toThrow('Failed to add media items');
    });

    it('should throw error when transaction fails to begin', async () => {
      const items: GalleryItemInput[] = [
        { mediaId: 'media-1', thumbnailId: 'thumb-1' }
      ];

      const txError = new Error('Transaction start failed');
      mockDb.begin.mockRejectedValue(txError);

      await expect(repository.addMediaItems('gallery-123', items)).rejects.toThrow('Failed to add media items');
    });

    it('should return empty array when all items are duplicates (ON CONFLICT DO NOTHING)', async () => {
      const items: GalleryItemInput[] = [
        { mediaId: 'media-1', thumbnailId: 'thumb-1' },
        { mediaId: 'media-2', thumbnailId: 'thumb-2' }
      ];

      // ON CONFLICT DO NOTHING returns no rows
      mockTransaction.mockResolvedValue([]);

      const result = await repository.addMediaItems('gallery-123', items);

      expect(mockDb.begin).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should return IDs of newly inserted items', async () => {
      const items: GalleryItemInput[] = [
        { mediaId: 'media-1', thumbnailId: 'thumb-1' },
        { mediaId: 'media-2', thumbnailId: 'thumb-2' }
      ];

      const mockInsertResult = [
        { id: 'item-uuid-1' },
        { id: 'item-uuid-2' }
      ];

      mockTransaction.mockResolvedValue(mockInsertResult);

      const result = await repository.addMediaItems('gallery-123', items);

      expect(mockDb.begin).toHaveBeenCalledTimes(1);
      expect(result).toEqual(['item-uuid-1', 'item-uuid-2']);
    });

    it('should handle partial inserts (some duplicates)', async () => {
      const items: GalleryItemInput[] = [
        { mediaId: 'media-1', thumbnailId: 'thumb-1' },
        { mediaId: 'media-2', thumbnailId: 'thumb-2' },
        { mediaId: 'media-3', thumbnailId: 'thumb-3' }
      ];

      // Only 2 items inserted (one was duplicate)
      const mockInsertResult = [
        { id: 'item-uuid-1' },
        { id: 'item-uuid-3' }
      ];

      mockTransaction.mockResolvedValue(mockInsertResult);

      const result = await repository.addMediaItems('gallery-123', items);

      expect(result).toEqual(['item-uuid-1', 'item-uuid-3']);
    });
  });

  describe('removeMediaItem', () => {
    it('should throw error when database delete fails', async () => {
      const dbError = new Error('Delete operation failed');
      mockDb.mockRejectedValue(dbError);

      await expect(repository.removeMediaItem('gallery-123', 'media-456')).rejects.toThrow('Failed to remove media item');
    });

    it('should return false when no rows were deleted', async () => {
      mockDb.mockResolvedValue({ count: 0 });

      const result = await repository.removeMediaItem('gallery-123', 'non-existent-media');

      expect(result).toBe(false);
    });

    it('should return true when media item was deleted', async () => {
      mockDb.mockResolvedValue({ count: 1 });

      const result = await repository.removeMediaItem('gallery-123', 'media-456');

      expect(mockDb).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  });

  describe('getGalleryWithItems', () => {
    it('should throw error when findById fails', async () => {
      const dbError = new Error('Database query failed');
      mockDb.mockRejectedValue(dbError);

      await expect(repository.getGalleryWithItems('gallery-123')).rejects.toThrow('Failed to get gallery with items');
    });

    it('should return null when gallery does not exist', async () => {
      // First call to findById returns empty
      mockDb.mockResolvedValueOnce([]);

      const result = await repository.getGalleryWithItems('non-existent-gallery');

      expect(result).toBeNull();
    });

    it('should throw error when items query fails', async () => {
      // First call succeeds (findById)
      mockDb.mockResolvedValueOnce([{
        id: 'gallery-123',
        churchId: 'church-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }]);

      // Second call fails (items query)
      const dbError = new Error('Items query failed');
      mockTransaction.mockRejectedValueOnce(dbError);

      await expect(repository.getGalleryWithItems('gallery-123')).rejects.toThrow('Failed to get gallery with items');
    });

    it('should return gallery with empty items array when no items exist', async () => {
      const mockGallery = {
        id: 'gallery-123',
        churchId: 'church-123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      };

      // First call: findById
      mockDb.mockResolvedValueOnce([mockGallery]);

      // Second call: items query returns empty
      mockTransaction.mockResolvedValueOnce([]);

      const result = await repository.getGalleryWithItems('gallery-123');

      expect(result).toEqual({
        ...mockGallery,
        items: []
      });
    });

    it('should return gallery with items', async () => {
      const mockGallery = {
        id: 'gallery-123',
        churchId: 'church-123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      };

      const mockItems = [
        {
          id: 'item-1',
          galleryId: 'gallery-123',
          mediaId: 'media-1',
          thumbnailId: 'thumb-1',
          createdAt: new Date('2024-01-02T00:00:00Z')
        },
        {
          id: 'item-2',
          galleryId: 'gallery-123',
          mediaId: 'media-2',
          thumbnailId: 'thumb-2',
          createdAt: new Date('2024-01-01T00:00:00Z')
        }
      ];

      // First call: findById
      mockDb.mockResolvedValueOnce([mockGallery]);

      // Second call: items query
      mockTransaction.mockResolvedValueOnce(mockItems);

      const result = await repository.getGalleryWithItems('gallery-123');

      expect(result).toEqual({
        ...mockGallery,
        items: mockItems
      });
    });
  });
});