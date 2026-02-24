import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {RawDb} from '../../utils/database';
import {PostgresMediaRepository} from '../../media/pg-repository';
import type {CreateMediaInput, MediaFilters, UpdateMediaInput} from '../../media/schemas';

// Mock database functions
const createMockDb = () => {
  // Create mock function for template literals
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

describe('PostgresMediaRepository', () => {
  let mockDb: any;
  let mockTransaction: any;
  let repository: PostgresMediaRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    const { mockDb: db, mockTransaction: tx } = createMockDb();
    mockDb = db;
    mockTransaction = tx;
    repository = new PostgresMediaRepository(mockDb as RawDb);
  });

  describe('Constructor and Interface Implementation', () => {
    it('should implement MediaRepository interface', () => {
      expect(repository).toBeInstanceOf(PostgresMediaRepository);
      expect(typeof repository.create).toBe('function');
      expect(typeof repository.update).toBe('function');
      expect(typeof repository.delete).toBe('function');
      expect(typeof repository.findById).toBe('function');
      expect(typeof repository.findAll).toBe('function');
      expect(typeof repository.findByUploadedBy).toBe('function');
    });

    it('should be constructed with database', () => {
      expect(() => new PostgresMediaRepository(mockDb as RawDb)).not.toThrow();
    });
  });

  describe('create', () => {
    it('should create new media record with proper SQL and return Media object', async () => {
      const mockInput: CreateMediaInput = {
        filename: 'test-image.jpg',
        originalFilename: 'original-image.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024000,
        r2Url: 'https://r2.example.com/bucket/test-image.jpg',
        r2Key: 'uploads/2024/test-image.jpg'
      };

      const mockDbResult = [{
        id: 'generated-uuid-123',
        filename: 'test-image.jpg',
        original_filename: 'original-image.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024000,
        r2_url: 'https://r2.example.com/bucket/test-image.jpg',
        r2_key: 'uploads/2024/test-image.jpg',
        uploaded_by: 'user-uuid-456',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockDb.mockResolvedValue(mockDbResult);

      const uploadedBy = 'user-uuid-456';
      const result = await repository.create(mockInput, uploadedBy);

      // Check database was called (direct insert, no transaction)
      expect(mockDb).toHaveBeenCalled();

      // Check returned Media object structure
      expect(result).toMatchObject({
        id: 'generated-uuid-123',
        filename: 'test-image.jpg',
        originalFilename: 'original-image.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024000,
        r2Url: 'https://r2.example.com/bucket/test-image.jpg',
        r2Key: 'uploads/2024/test-image.jpg',
        uploadedBy: 'user-uuid-456',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });

    it('should generate UUID and timestamps automatically', async () => {
      const mockInput: CreateMediaInput = {
        filename: 'test.jpg',
        originalFilename: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1000,
        r2Url: 'https://example.com/test.jpg',
        r2Key: 'test.jpg'
      };

      mockDb.mockResolvedValue([{
        id: 'generated-uuid',
        filename: 'test.jpg',
        original_filename: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
        r2_url: 'https://example.com/test.jpg',
        r2_key: 'test.jpg',
        uploaded_by: 'user-123',
        created_at: new Date(),
        updated_at: new Date()
      }]);

      const result = await repository.create(mockInput, 'user-123');

      expect(mockDb).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update existing media record and return updated Media object', async () => {
      const mediaId = 'media-uuid-123';
      const updateInput: UpdateMediaInput = {
        filename: 'updated-filename.jpg',
        mimeType: 'image/png'
      };

      const mockDbResult = [{
        id: mediaId,
        filename: 'updated-filename.jpg',
        original_filename: 'original.jpg',
        mime_type: 'image/png',
        file_size: 2048000,
        r2_url: 'https://r2.example.com/bucket/updated.jpg',
        r2_key: 'uploads/2024/updated.jpg',
        uploaded_by: 'user-uuid-456',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-02T00:00:00Z')
      }];

      mockTransaction.unsafe.mockResolvedValue(mockDbResult);

      const result = await repository.update(mediaId, updateInput);

      // Check database transaction was called
      expect(mockDb.begin).toHaveBeenCalledTimes(1);
      expect(mockTransaction.unsafe).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE media'),
        expect.arrayContaining([
          'updated-filename.jpg',
          'image/png',
          expect.any(Date), // updated_at
          mediaId
        ])
      );

      // Check returned Media object
      expect(result).toMatchObject({
        id: mediaId,
        filename: 'updated-filename.jpg',
        mimeType: 'image/png',
        updatedAt: expect.any(Date)
      });
    });

    it('should return null when media record not found', async () => {
      mockTransaction.unsafe.mockResolvedValue([]); // No rows returned

      const result = await repository.update('non-existent-id', { filename: 'test.jpg' });

      expect(result).toBeNull();
    });

    it('should handle empty update input by returning existing record', async () => {
      const mediaId = 'media-uuid-123';

      // Mock findById call for empty update
      mockDb.mockResolvedValue([{
        id: mediaId,
        filename: 'existing.jpg',
        original_filename: 'existing.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
        r2_url: 'https://example.com/existing.jpg',
        r2_key: 'existing.jpg',
        uploaded_by: 'user-123',
        created_at: new Date(),
        updated_at: new Date()
      }]);

      const result = await repository.update(mediaId, {});

      // Should call findById instead of update
      expect(mockDb).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: mediaId,
        filename: 'existing.jpg'
      });
    });
  });

  describe('delete', () => {
    it('should delete media record and return true when successful', async () => {
      const mediaId = 'media-uuid-123';

      mockDb.mockResolvedValue([{ id: mediaId }]); // Successful deletion

      const result = await repository.delete(mediaId);

      expect(mockDb).toHaveBeenCalledWith(
        expect.anything(),
        mediaId
      );

      expect(result).toBe(true);
    });

    it('should return false when media record not found', async () => {
      mockDb.mockResolvedValue([]); // No rows deleted

      const result = await repository.delete('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('findById', () => {
    it('should return Media object when record exists', async () => {
      const mediaId = 'media-uuid-123';
      const mockDbResult = [{
        id: mediaId,
        filename: 'test.jpg',
        original_filename: 'test-original.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        r2_url: 'https://example.com/test.jpg',
        r2_key: 'test.jpg',
        uploaded_by: 'user-123',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockDb.mockResolvedValue(mockDbResult);

      const result = await repository.findById(mediaId);

      expect(mockDb).toHaveBeenCalledWith(
        expect.anything(),
        mediaId
      );

      expect(result).toMatchObject({
        id: mediaId,
        filename: 'test.jpg',
        originalFilename: 'test-original.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        r2Url: 'https://example.com/test.jpg',
        r2Key: 'test.jpg',
        uploadedBy: 'user-123',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });

    it('should return null when record not found', async () => {
      mockDb.mockResolvedValue([]); // No rows found

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all media records when no filters provided', async () => {
      const mockDbResult = [
        {
          id: 'media-1',
          filename: 'test1.jpg',
          original_filename: 'original1.jpg',
          mime_type: 'image/jpeg',
          file_size: 1024,
          r2_url: 'https://example.com/test1.jpg',
          r2_key: 'test1.jpg',
          uploaded_by: 'user-123',
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z')
        }
      ];

      mockDb.mockResolvedValue(mockDbResult);

      const result = await repository.findAll();

      expect(mockDb).toHaveBeenCalledWith(expect.anything());
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'media-1',
        filename: 'test1.jpg',
        originalFilename: 'original1.jpg'
      });
    });

    it('should apply filters when provided', async () => {
      const filters: MediaFilters = {
        uploadedBy: 'user-123',
        mimeType: 'image/jpeg',
        minFileSize: 1000,
        maxFileSize: 5000000
      };

      mockDb.unsafe.mockResolvedValue([]);

      await repository.findAll(filters);

      expect(mockDb.unsafe).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining([
          'user-123',
          'image/jpeg',
          1000,
          5000000
        ])
      );
    });
  });

  describe('findByUploadedBy', () => {
    it('should return media records uploaded by specific user', async () => {
      const uploadedBy = 'user-123';
      const mockDbResult = [
        {
          id: 'media-1',
          filename: 'user-file.jpg',
          original_filename: 'user-original.jpg',
          mime_type: 'image/jpeg',
          file_size: 2048,
          r2_url: 'https://example.com/user-file.jpg',
          r2_key: 'user-file.jpg',
          uploaded_by: uploadedBy,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.mockResolvedValue(mockDbResult);

      const result = await repository.findByUploadedBy(uploadedBy);

      expect(mockDb).toHaveBeenCalledWith(
        expect.anything(),
        uploadedBy
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'media-1',
        filename: 'user-file.jpg',
        uploadedBy: uploadedBy
      });
    });
  });

  describe('mapRowToMedia private method', () => {
    it('should properly map database row to Media object', async () => {
      // Test the mapping through a public method
      const mockDbRow = {
        id: 'test-id',
        filename: 'test.jpg',
        original_filename: 'original.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024,
        r2_url: 'https://example.com/test.jpg',
        r2_key: 'test.jpg',
        uploaded_by: 'user-123',
        created_at: '2024-01-01T00:00:00Z', // String format from DB
        updated_at: '2024-01-01T00:00:00Z'  // String format from DB
      };

      mockDb.mockResolvedValue([mockDbRow]);

      const result = await repository.findById('test-id');

      expect(result).toEqual({
        id: 'test-id',
        filename: 'test.jpg',
        originalFilename: 'original.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        r2Url: 'https://example.com/test.jpg',
        r2Key: 'test.jpg',
        uploadedBy: 'user-123',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });
  });
});
