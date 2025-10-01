import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {RawDb} from '../../utils/database';
import {PostgresPostRepository} from '../../posts/pg-repository';
import type {CreatePostInput, PostFilters, UpdatePostInput} from '../../posts/schemas';
import {GeneralizedKeycloakOutboxAdapter} from '../../keycloak/generalized-outbox.adapter';

// Mock the Keycloak adapter
const mockKeycloakAdapter = {
  enqueueResourceCreate: vi.fn(),
  enqueueResourceDelete: vi.fn(),
  enqueueResourceUpdate: vi.fn(),
} as unknown as GeneralizedKeycloakOutboxAdapter;

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

describe('PostgresPostRepository', () => {
  let mockDb: any;
  let mockTransaction: any;
  let repository: PostgresPostRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    const { mockDb: db, mockTransaction: tx } = createMockDb();
    mockDb = db;
    mockTransaction = tx;
    repository = new PostgresPostRepository(mockDb as RawDb, mockKeycloakAdapter);
  });

  describe('Constructor and Interface Implementation', () => {
    it('should implement PostRepository interface', () => {
      expect(repository).toBeInstanceOf(PostgresPostRepository);
      expect(typeof repository.create).toBe('function');
      expect(typeof repository.update).toBe('function');
      expect(typeof repository.delete).toBe('function');
      expect(typeof repository.findById).toBe('function');
      expect(typeof repository.findAll).toBe('function');
      expect(typeof repository.findByChurchId).toBe('function');
      expect(typeof repository.findByAuthorId).toBe('function');
    });

    it('should be constructed with database and keycloak adapter', () => {
      expect(() => new PostgresPostRepository(mockDb as RawDb, mockKeycloakAdapter)).not.toThrow();
    });
  });

  describe('create', () => {
    it('should create new post record with proper SQL and return Post object', async () => {
      const mockInput: CreatePostInput = {
        title: 'Test Post',
        content: 'This is test content',
        churchId: 'church-uuid-123'
      };

      const mockDbResult = [{
        id: 'generated-uuid-123',
        title: 'Test Post',
        content: 'This is test content',
        author_id: 'author-uuid-456',
        church_id: 'church-uuid-123',
        status: 'draft',
        published_at: null,
        image: null,
        tags: [],
        categories: [],
        scripture_references: [],
        series_id: null,
        series_name: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockTransaction.mockResolvedValue(mockDbResult);

      const authorId = 'author-uuid-456';
      const result = await repository.create(mockInput, authorId);

      // Check database transaction was called
      expect(mockDb.begin).toHaveBeenCalledTimes(1);
      expect(mockTransaction).toHaveBeenCalled();

      // Verify the call includes the expected values
      const callArgs = mockTransaction.mock.calls[0];
      expect(callArgs).toContain(mockInput.title);
      expect(callArgs).toContain(mockInput.content);
      expect(callArgs).toContain(authorId);
      expect(callArgs).toContain(mockInput.churchId);

      // Check Keycloak outbox event was queued
      expect(mockKeycloakAdapter.enqueueResourceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'generated-uuid-123',
          title: 'Test Post',
          authorId: 'author-uuid-456',
          churchId: 'church-uuid-123'
        }),
        'posts',
        authorId
      );

      // Check returned Post object structure
      expect(result).toMatchObject({
        id: 'generated-uuid-123',
        title: 'Test Post',
        content: 'This is test content',
        authorId: 'author-uuid-456',
        churchId: 'church-uuid-123',
        status: 'draft',
        publishedAt: null,
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: null,
        seriesName: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });

    it('should create post with all optional fields', async () => {
      const mockInput: CreatePostInput = {
        title: 'Test Post',
        content: 'This is test content',
        churchId: 'church-uuid-123',
        image: 'https://example.com/image.jpg',
        tags: ['devotional', 'faith'],
        categories: ['sermon'],
        scriptureReferences: [{ book: 'John', chapter: 3, verse: 16 }],
        seriesId: 'series-uuid-789',
        seriesName: 'Advent Series'
      };

      mockTransaction.mockResolvedValue([{
        id: 'generated-uuid-123',
        title: mockInput.title,
        content: mockInput.content,
        author_id: 'author-uuid-456',
        church_id: mockInput.churchId,
        status: 'draft',
        published_at: null,
        image: mockInput.image,
        tags: mockInput.tags,
        categories: mockInput.categories,
        scripture_references: mockInput.scriptureReferences,
        series_id: mockInput.seriesId,
        series_name: mockInput.seriesName,
        created_at: new Date(),
        updated_at: new Date()
      }]);

      const result = await repository.create(mockInput, 'author-uuid-456');

      expect(result).toMatchObject({
        image: 'https://example.com/image.jpg',
        tags: ['devotional', 'faith'],
        categories: ['sermon'],
        scriptureReferences: [{ book: 'John', chapter: 3, verse: 16 }],
        seriesId: 'series-uuid-789',
        seriesName: 'Advent Series'
      });
    });
  });

  describe('update', () => {
    it('should update existing post record and return updated Post object', async () => {
      const postId = 'post-uuid-123';
      const updateInput: UpdatePostInput = {
        title: 'Updated Title',
        content: 'Updated content'
      };

      const mockDbResult = [{
        id: postId,
        title: 'Updated Title',
        content: 'Updated content',
        author_id: 'author-uuid-456',
        church_id: 'church-uuid-123',
        status: 'draft',
        published_at: null,
        image: null,
        tags: [],
        categories: [],
        scripture_references: [],
        series_id: null,
        series_name: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-02T00:00:00Z')
      }];

      mockTransaction.unsafe.mockResolvedValue(mockDbResult);

      const result = await repository.update(postId, updateInput);

      // Check database transaction was called
      expect(mockDb.begin).toHaveBeenCalledTimes(1);
      expect(mockTransaction.unsafe).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE posts'),
        expect.arrayContaining([
          'Updated Title',
          'Updated content',
          expect.any(Date), // updated_at
          postId
        ])
      );

      // Check returned Post object
      expect(result).toMatchObject({
        id: postId,
        title: 'Updated Title',
        content: 'Updated content',
        updatedAt: expect.any(Date)
      });
    });

    it('should return null when post record not found', async () => {
      mockTransaction.unsafe.mockResolvedValue([]); // No rows returned

      const result = await repository.update('non-existent-id', { title: 'Test' });

      expect(result).toBeNull();
    });

    it('should handle empty update input by returning existing record', async () => {
      const postId = 'post-uuid-123';

      // Mock findById call for empty update
      mockDb.mockResolvedValue([{
        id: postId,
        title: 'Existing Title',
        content: 'Existing content',
        author_id: 'author-uuid-456',
        church_id: 'church-uuid-123',
        status: 'draft',
        published_at: null,
        image: null,
        tags: [],
        categories: [],
        scripture_references: [],
        series_id: null,
        series_name: null,
        created_at: new Date(),
        updated_at: new Date()
      }]);

      const result = await repository.update(postId, {});

      // Should call findById instead of update
      expect(mockDb).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: postId,
        title: 'Existing Title'
      });
    });

    it('should update status and published date when publishing', async () => {
      const postId = 'post-uuid-123';
      const updateInput: UpdatePostInput = {
        status: 'published'
      };

      const mockDbResult = [{
        id: postId,
        title: 'Test Post',
        content: 'Test content',
        author_id: 'author-uuid-456',
        church_id: 'church-uuid-123',
        status: 'published',
        published_at: new Date('2024-01-02T00:00:00Z'),
        image: null,
        tags: [],
        categories: [],
        scripture_references: [],
        series_id: null,
        series_name: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-02T00:00:00Z')
      }];

      mockTransaction.unsafe.mockResolvedValue(mockDbResult);

      const result = await repository.update(postId, updateInput);

      expect(result).toMatchObject({
        status: 'published',
        publishedAt: expect.any(Date)
      });
    });
  });

  describe('delete', () => {
    it('should delete post record and return true when successful', async () => {
      const postId = 'post-uuid-123';

      mockTransaction.mockResolvedValue([{ id: postId }]); // Successful deletion

      const result = await repository.delete(postId);

      expect(mockDb.begin).toHaveBeenCalledTimes(1);
      expect(mockTransaction).toHaveBeenCalledWith(
        expect.anything(),
        postId
      );

      // Check Keycloak outbox delete event was queued
      expect(mockKeycloakAdapter.enqueueResourceDelete).toHaveBeenCalledWith(
        postId,
        'posts'
      );

      expect(result).toBe(true);
    });

    it('should return false when post record not found', async () => {
      mockTransaction.mockResolvedValue([]); // No rows deleted

      const result = await repository.delete('non-existent-id');

      expect(result).toBe(false);
      expect(mockKeycloakAdapter.enqueueResourceDelete).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return Post object when record exists', async () => {
      const postId = 'post-uuid-123';
      const mockDbResult = [{
        id: postId,
        title: 'Test Post',
        content: 'Test content',
        author_id: 'author-uuid-456',
        church_id: 'church-uuid-123',
        status: 'draft',
        published_at: null,
        image: null,
        tags: ['faith'],
        categories: ['sermon'],
        scripture_references: [{ book: 'John', chapter: 3, verse: 16 }],
        series_id: null,
        series_name: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      }];

      mockDb.mockResolvedValue(mockDbResult);

      const result = await repository.findById(postId);

      expect(mockDb).toHaveBeenCalledWith(
        expect.anything(),
        postId
      );

      expect(result).toMatchObject({
        id: postId,
        title: 'Test Post',
        content: 'Test content',
        authorId: 'author-uuid-456',
        churchId: 'church-uuid-123',
        status: 'draft',
        publishedAt: null,
        tags: ['faith'],
        categories: ['sermon'],
        scriptureReferences: [{ book: 'John', chapter: 3, verse: 16 }],
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
    it('should return all post records when no filters provided', async () => {
      const mockDbResult = [
        {
          id: 'post-1',
          title: 'Post 1',
          content: 'Content 1',
          author_id: 'author-1',
          church_id: 'church-1',
          status: 'published',
          published_at: new Date(),
          image: null,
          tags: [],
          categories: [],
          scripture_references: [],
          series_id: null,
          series_name: null,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z')
        }
      ];

      mockDb.mockResolvedValue(mockDbResult);

      const result = await repository.findAll();

      expect(mockDb).toHaveBeenCalledWith(expect.anything());
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'post-1',
        title: 'Post 1',
        content: 'Content 1'
      });
    });

    it('should apply filters when provided', async () => {
      const filters: PostFilters = {
        authorizedIds: ['post-1', 'post-2'],
        churchId: 'church-uuid-123',
        status: 'published',
        tags: ['faith']
      };

      mockDb.unsafe.mockResolvedValue([]);

      await repository.findAll(filters);

      expect(mockDb.unsafe).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.any(Array)
      );
    });

    it('should return empty array when no authorized IDs provided', async () => {
      const filters: PostFilters = {
        authorizedIds: [] // Empty authorized IDs should return empty result
      };

      const result = await repository.findAll(filters);

      expect(result).toEqual([]);
      expect(mockDb).not.toHaveBeenCalled();
      expect(mockDb.unsafe).not.toHaveBeenCalled();
    });
  });

  describe('findByChurchId', () => {
    it('should return posts for specific church', async () => {
      const churchId = 'church-uuid-123';
      const mockDbResult = [
        {
          id: 'post-1',
          title: 'Church Post',
          content: 'Content',
          author_id: 'author-1',
          church_id: churchId,
          status: 'published',
          published_at: new Date(),
          image: null,
          tags: [],
          categories: [],
          scripture_references: [],
          series_id: null,
          series_name: null,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.mockResolvedValue(mockDbResult);

      const result = await repository.findByChurchId(churchId);

      expect(mockDb).toHaveBeenCalledWith(
        expect.anything(),
        churchId
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'post-1',
        churchId: churchId
      });
    });
  });

  describe('findByAuthorId', () => {
    it('should return posts by specific author', async () => {
      const authorId = 'author-uuid-123';
      const mockDbResult = [
        {
          id: 'post-1',
          title: 'Author Post',
          content: 'Content',
          author_id: authorId,
          church_id: 'church-1',
          status: 'draft',
          published_at: null,
          image: null,
          tags: [],
          categories: [],
          scripture_references: [],
          series_id: null,
          series_name: null,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.mockResolvedValue(mockDbResult);

      const result = await repository.findByAuthorId(authorId);

      expect(mockDb).toHaveBeenCalledWith(
        expect.anything(),
        authorId
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'post-1',
        authorId: authorId
      });
    });
  });

  describe('mapRowToPost private method', () => {
    it('should properly map database row to Post object', async () => {
      // Test the mapping through a public method
      const mockDbRow = {
        id: 'test-id',
        title: 'Test',
        content: 'Content',
        author_id: 'author-123',
        church_id: 'church-123',
        status: 'draft',
        published_at: null,
        image: null,
        tags: '["faith"]', // String format from DB
        categories: '["sermon"]', // String format from DB
        scripture_references: '[{"book":"John","chapter":3,"verse":16}]', // String format from DB
        series_id: null,
        series_name: null,
        created_at: '2024-01-01T00:00:00Z', // String format from DB
        updated_at: '2024-01-01T00:00:00Z'  // String format from DB
      };

      mockDb.mockResolvedValue([mockDbRow]);

      const result = await repository.findById('test-id');

      expect(result).toEqual({
        id: 'test-id',
        title: 'Test',
        content: 'Content',
        authorId: 'author-123',
        churchId: 'church-123',
        status: 'draft',
        publishedAt: null,
        image: null,
        tags: ['faith'],
        categories: ['sermon'],
        scriptureReferences: [{ book: 'John', chapter: 3, verse: 16 }],
        seriesId: null,
        seriesName: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });
  });
});
