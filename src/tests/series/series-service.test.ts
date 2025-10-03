import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeriesService } from '../../series/service';
import { SeriesServiceImpl } from '../../series/service';
import type { SeriesRepository } from '../../series/repository';
import type { CreateSeriesInput, Series, UpdateSeriesInput } from '../../series/schemas';
import { SeriesNotFoundError, SeriesUnauthorizedError } from '../../series/errors';
import { InsufficientChurchRoleError, NotChurchMemberError, InactiveMembershipError } from '../../posts/errors';
import type { PostRepository } from '../../posts/repository';

// Mock repository
const createMockRepository = () => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  findByChurchId: vi.fn(),
  findByAuthorId: vi.fn(),
});

// Mock church membership service
const createMockMembershipService = () => ({
  getMembershipByUserAndChurch: vi.fn(),
  getUserMemberships: vi.fn(),
  isOwnerOrManager: vi.fn(),
});

// Mock post repository
const createMockPostRepository = () => ({
  getLatestPostInSeries: vi.fn(),
});

describe('SeriesService', () => {
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockMembershipService: ReturnType<typeof createMockMembershipService>;
  let mockPostRepository: ReturnType<typeof createMockPostRepository>;
  let service: SeriesService;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockMembershipService = createMockMembershipService();
    mockPostRepository = createMockPostRepository();
    service = new SeriesServiceImpl(
      mockRepository as unknown as SeriesRepository,
      mockMembershipService as any,
      mockPostRepository as unknown as PostRepository
    );
  });

  describe('createSeries', () => {
    it('should create series when user is church owner', async () => {
      const input: CreateSeriesInput = {
        title: 'Test Series',
        description: 'Test description',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockMembership = {
        id: 'membership-uuid',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        userId: authorId,
        role: 'Owner',
        status: 'Active'
      };

      const mockSeries: Series = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        title: input.title,
        description: input.description,
        image: null,
        authorId,
        churchId: input.churchId,
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockMembershipService.getMembershipByUserAndChurch.mockResolvedValue(mockMembership);
      mockRepository.create.mockResolvedValue(mockSeries);

      const result = await service.createSeries(input, authorId);

      expect(mockMembershipService.getMembershipByUserAndChurch).toHaveBeenCalledWith(authorId, input.churchId);
      expect(mockRepository.create).toHaveBeenCalledWith(input, authorId);
      expect(result).toEqual(mockSeries);
    });

    it('should create series when user is church manager', async () => {
      const input: CreateSeriesInput = {
        title: 'Test Series',
        description: 'Test description',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockMembership = {
        id: 'membership-uuid',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        userId: authorId,
        role: 'Manager',
        status: 'Active'
      };

      mockMembershipService.getMembershipByUserAndChurch.mockResolvedValue(mockMembership);
      mockRepository.create.mockResolvedValue({} as Series);

      await service.createSeries(input, authorId);

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should throw error when user is not church owner or manager', async () => {
      const input: CreateSeriesInput = {
        title: 'Test Series',
        description: 'Test description',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockMembership = {
        id: 'membership-uuid',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        userId: authorId,
        role: 'Member',
        status: 'Active'
      };

      mockMembershipService.getMembershipByUserAndChurch.mockResolvedValue(mockMembership);

      await expect(service.createSeries(input, authorId)).rejects.toThrow(
        InsufficientChurchRoleError
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when user is not a member of the church', async () => {
      const input: CreateSeriesInput = {
        title: 'Test Series',
        description: 'Test description',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      mockMembershipService.getMembershipByUserAndChurch.mockResolvedValue(null);

      await expect(service.createSeries(input, authorId)).rejects.toThrow(
        NotChurchMemberError
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when membership status is not Active', async () => {
      const input: CreateSeriesInput = {
        title: 'Test Series',
        description: 'Test description',
        churchId: '550e8400-e29b-41d4-a716-446655440001'
      };
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const mockMembership = {
        id: 'membership-uuid',
        churchId: '550e8400-e29b-41d4-a716-446655440001',
        userId: authorId,
        role: 'Owner',
        status: 'Pending'
      };

      mockMembershipService.getMembershipByUserAndChurch.mockResolvedValue(mockMembership);

      await expect(service.createSeries(input, authorId)).rejects.toThrow(
        InactiveMembershipError
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateSeries', () => {
    it('should update series when user is the author', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';
      const input: UpdateSeriesInput = {
        title: 'Updated Title'
      };

      const existingSeries: Series = {
        id: seriesId,
        title: 'Original Title',
        description: 'Description',
        image: null,
        authorId,
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedSeries: Series = {
        ...existingSeries,
        title: 'Updated Title',
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(existingSeries);
      mockRepository.update.mockResolvedValue(updatedSeries);

      const result = await service.updateSeries(seriesId, input, authorId);

      expect(mockRepository.findById).toHaveBeenCalledWith(seriesId);
      expect(mockRepository.update).toHaveBeenCalledWith(seriesId, input);
      expect(result).toEqual(updatedSeries);
    });

    it('should throw SeriesNotFoundError when series does not exist', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      mockRepository.findById.mockResolvedValue(null);

      await expect(service.updateSeries(seriesId, {}, authorId)).rejects.toThrow(
        SeriesNotFoundError
      );

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw SeriesUnauthorizedError when user is not the author', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';
      const differentAuthorId = '550e8400-e29b-41d4-a716-446655440099';

      const existingSeries: Series = {
        id: seriesId,
        title: 'Original Title',
        description: 'Description',
        image: null,
        authorId: differentAuthorId,
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(existingSeries);

      await expect(service.updateSeries(seriesId, {}, authorId)).rejects.toThrow(
        SeriesUnauthorizedError
      );

      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteSeries', () => {
    it('should delete series when user is the author', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const existingSeries: Series = {
        id: seriesId,
        title: 'Test Series',
        description: 'Description',
        image: null,
        authorId,
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(existingSeries);
      mockRepository.delete.mockResolvedValue(true);

      await service.deleteSeries(seriesId, authorId);

      expect(mockRepository.findById).toHaveBeenCalledWith(seriesId);
      expect(mockRepository.delete).toHaveBeenCalledWith(seriesId);
    });

    it('should throw SeriesNotFoundError when series does not exist', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      mockRepository.findById.mockResolvedValue(null);

      await expect(service.deleteSeries(seriesId, authorId)).rejects.toThrow(
        SeriesNotFoundError
      );

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw SeriesUnauthorizedError when user is not the author', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';
      const differentAuthorId = '550e8400-e29b-41d4-a716-446655440099';

      const existingSeries: Series = {
        id: seriesId,
        title: 'Test Series',
        description: 'Description',
        image: null,
        authorId: differentAuthorId,
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(existingSeries);

      await expect(service.deleteSeries(seriesId, authorId)).rejects.toThrow(
        SeriesUnauthorizedError
      );

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw SeriesNotFoundError when delete operation fails', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const existingSeries: Series = {
        id: seriesId,
        title: 'Test Series',
        description: 'Description',
        image: null,
        authorId,
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(existingSeries);
      mockRepository.delete.mockResolvedValue(false);

      await expect(service.deleteSeries(seriesId, authorId)).rejects.toThrow(
        SeriesNotFoundError
      );
    });
  });

  describe('getSeriesById', () => {
    it('should return series when it exists', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';

      const mockSeries: Series = {
        id: seriesId,
        title: 'Test Series',
        description: 'Description',
        image: null,
        authorId: '550e8400-e29b-41d4-a716-446655440002',
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockSeries);

      const result = await service.getSeriesById(seriesId);

      expect(mockRepository.findById).toHaveBeenCalledWith(seriesId);
      expect(result).toEqual(mockSeries);
    });

    it('should throw SeriesNotFoundError when series does not exist', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';

      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getSeriesById(seriesId)).rejects.toThrow(
        SeriesNotFoundError
      );
    });
  });

  describe('listSeries', () => {
    it('should return all series when no filters provided', async () => {
      const mockSeriesList: Series[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Series 1',
          description: 'Description 1',
          image: null,
          authorId: '550e8400-e29b-41d4-a716-446655440002',
          churchId: '550e8400-e29b-41d4-a716-446655440003',
          status: 'published',
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRepository.findAll.mockResolvedValue(mockSeriesList);

      const result = await service.listSeries();

      expect(mockRepository.findAll).toHaveBeenCalledWith();
      expect(result).toEqual(mockSeriesList);
    });

    it('should return filtered series when filters provided', async () => {
      const filters = {
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published' as const
      };

      mockRepository.findAll.mockResolvedValue([]);

      await service.listSeries(filters);

      // Zod adds default authorizedIds: [] to the validated filter
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        ...filters,
        authorizedIds: []
      });
    });
  });

  describe('publishSeries', () => {
    it('should publish series when user is the author', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const existingSeries: Series = {
        id: seriesId,
        title: 'Test Series',
        description: 'Description',
        image: null,
        authorId,
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const publishedSeries: Series = {
        ...existingSeries,
        status: 'published',
        publishedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(existingSeries);
      mockRepository.update.mockResolvedValue(publishedSeries);

      const result = await service.publishSeries(seriesId, authorId);

      expect(mockRepository.findById).toHaveBeenCalledWith(seriesId);
      expect(mockRepository.update).toHaveBeenCalledWith(seriesId, { status: 'published' });
      expect(result.status).toBe('published');
    });

    it('should throw SeriesNotFoundError when series does not exist', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      mockRepository.findById.mockResolvedValue(null);

      await expect(service.publishSeries(seriesId, authorId)).rejects.toThrow(
        SeriesNotFoundError
      );

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw SeriesUnauthorizedError when user is not the author', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';
      const differentAuthorId = '550e8400-e29b-41d4-a716-446655440099';

      const existingSeries: Series = {
        id: seriesId,
        title: 'Test Series',
        description: 'Description',
        image: null,
        authorId: differentAuthorId,
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(existingSeries);

      await expect(service.publishSeries(seriesId, authorId)).rejects.toThrow(
        SeriesUnauthorizedError
      );

      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('unpublishSeries', () => {
    it('should unpublish series when user is the author', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      const existingSeries: Series = {
        id: seriesId,
        title: 'Test Series',
        description: 'Description',
        image: null,
        authorId,
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const unpublishedSeries: Series = {
        ...existingSeries,
        status: 'draft'
      };

      mockRepository.findById.mockResolvedValue(existingSeries);
      mockRepository.update.mockResolvedValue(unpublishedSeries);

      const result = await service.unpublishSeries(seriesId, authorId);

      expect(mockRepository.findById).toHaveBeenCalledWith(seriesId);
      expect(mockRepository.update).toHaveBeenCalledWith(seriesId, { status: 'draft' });
      expect(result.status).toBe('draft');
    });

    it('should throw SeriesNotFoundError when series does not exist', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';

      mockRepository.findById.mockResolvedValue(null);

      await expect(service.unpublishSeries(seriesId, authorId)).rejects.toThrow(
        SeriesNotFoundError
      );

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw SeriesUnauthorizedError when user is not the author', async () => {
      const seriesId = '550e8400-e29b-41d4-a716-446655440001';
      const authorId = '550e8400-e29b-41d4-a716-446655440002';
      const differentAuthorId = '550e8400-e29b-41d4-a716-446655440099';

      const existingSeries: Series = {
        id: seriesId,
        title: 'Test Series',
        description: 'Description',
        image: null,
        authorId: differentAuthorId,
        churchId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(existingSeries);

      await expect(service.unpublishSeries(seriesId, authorId)).rejects.toThrow(
        SeriesUnauthorizedError
      );

      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('getDailyDevotionals', () => {
    it('should return daily devotionals grouped by date for user churches', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      const churchId1 = '550e8400-e29b-41d4-a716-446655440002';
      const churchId2 = '550e8400-e29b-41d4-a716-446655440003';

      // Mock user memberships
      const mockMemberships = [
        {
          id: 'membership-1',
          userId,
          churchId: churchId1,
          role: 'Member',
          status: 'Active'
        },
        {
          id: 'membership-2',
          userId,
          churchId: churchId2,
          role: 'Owner',
          status: 'Active'
        }
      ];

      // Mock published series
      const mockSeries = [
        {
          id: 'series-1',
          title: 'Morning Devotionals',
          description: 'Daily morning devotionals',
          image: null,
          authorId: 'author-1',
          churchId: churchId1,
          status: 'published' as const,
          publishedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        },
        {
          id: 'series-2',
          title: 'Evening Reflections',
          description: 'Daily evening reflections',
          image: null,
          authorId: 'author-2',
          churchId: churchId2,
          status: 'published' as const,
          publishedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        }
      ];

      // Mock latest posts
      const mockPost1 = {
        id: 'post-1',
        title: 'Day 1 Morning',
        content: 'Morning devotional content',
        authorId: 'author-1',
        churchId: churchId1,
        status: 'published' as const,
        publishedAt: new Date('2024-01-15T08:00:00Z'),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: 'series-1',
        seriesName: 'Morning Devotionals',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      };

      const mockPost2 = {
        id: 'post-2',
        title: 'Day 1 Evening',
        content: 'Evening reflection content',
        authorId: 'author-2',
        churchId: churchId2,
        status: 'published' as const,
        publishedAt: new Date('2024-01-15T20:00:00Z'),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: 'series-2',
        seriesName: 'Evening Reflections',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      };

      mockMembershipService.getUserMemberships = vi.fn().mockResolvedValue(mockMemberships);
      mockRepository.findAll = vi.fn().mockResolvedValue(mockSeries);
      mockPostRepository.getLatestPostInSeries = vi.fn()
        .mockResolvedValueOnce(mockPost1)
        .mockResolvedValueOnce(mockPost2);

      const result = await service.getDailyDevotionals(userId);

      // Verify memberships were fetched
      expect(mockMembershipService.getUserMemberships).toHaveBeenCalledWith(userId);

      // Verify series were fetched with correct filters
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        authorizedIds: [churchId1, churchId2],
        status: 'published'
      });

      // Verify latest posts were fetched for each series
      expect(mockPostRepository.getLatestPostInSeries).toHaveBeenCalledWith('series-1');
      expect(mockPostRepository.getLatestPostInSeries).toHaveBeenCalledWith('series-2');

      // Result should be posts grouped by date
      expect(result).toEqual({
        '2024-01-15': [mockPost1, mockPost2]
      });
    });

    it('should return empty object when user has no memberships', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';

      mockMembershipService.getUserMemberships = vi.fn().mockResolvedValue([]);

      const result = await service.getDailyDevotionals(userId);

      expect(mockMembershipService.getUserMemberships).toHaveBeenCalledWith(userId);
      expect(mockRepository.findAll).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should return empty object when no published series exist', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';

      mockMembershipService.getUserMemberships = vi.fn().mockResolvedValue([
        {
          id: 'membership-1',
          userId,
          churchId: '550e8400-e29b-41d4-a716-446655440002',
          role: 'Member',
          status: 'Active'
        }
      ]);
      mockRepository.findAll = vi.fn().mockResolvedValue([]);

      const result = await service.getDailyDevotionals(userId);

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should skip series without published posts', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      const churchId = '550e8400-e29b-41d4-a716-446655440002';

      mockMembershipService.getUserMemberships = vi.fn().mockResolvedValue([
        {
          id: 'membership-1',
          userId,
          churchId,
          role: 'Member',
          status: 'Active'
        }
      ]);

      mockRepository.findAll = vi.fn().mockResolvedValue([
        {
          id: 'series-1',
          title: 'Series with no posts',
          description: 'No posts yet',
          image: null,
          authorId: 'author-1',
          churchId,
          status: 'published' as const,
          publishedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        }
      ]);

      // No published posts in this series
      mockPostRepository.getLatestPostInSeries = vi.fn().mockResolvedValue(null);

      const result = await service.getDailyDevotionals(userId);

      expect(mockPostRepository.getLatestPostInSeries).toHaveBeenCalledWith('series-1');
      expect(result).toEqual({});
    });

    it('should group posts by publishedAt date (YYYY-MM-DD)', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      const churchId = '550e8400-e29b-41d4-a716-446655440002';

      mockMembershipService.getUserMemberships = vi.fn().mockResolvedValue([
        {
          id: 'membership-1',
          userId,
          churchId,
          role: 'Member',
          status: 'Active'
        }
      ]);

      mockRepository.findAll = vi.fn().mockResolvedValue([
        {
          id: 'series-1',
          title: 'Morning',
          description: 'Morning devotionals',
          image: null,
          authorId: 'author-1',
          churchId,
          status: 'published' as const,
          publishedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        },
        {
          id: 'series-2',
          title: 'Evening',
          description: 'Evening devotionals',
          image: null,
          authorId: 'author-1',
          churchId,
          status: 'published' as const,
          publishedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        }
      ]);

      // Same date but different times
      const post1 = {
        id: 'post-1',
        title: 'Morning Post',
        content: 'Content',
        authorId: 'author-1',
        churchId,
        status: 'published' as const,
        publishedAt: new Date('2024-01-15T08:00:00Z'),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: 'series-1',
        seriesName: 'Morning',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      };

      const post2 = {
        id: 'post-2',
        title: 'Evening Post',
        content: 'Content',
        authorId: 'author-1',
        churchId,
        status: 'published' as const,
        publishedAt: new Date('2024-01-15T20:00:00Z'),
        image: null,
        tags: [],
        categories: [],
        scriptureReferences: [],
        seriesId: 'series-2',
        seriesName: 'Evening',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      };

      mockPostRepository.getLatestPostInSeries = vi.fn()
        .mockResolvedValueOnce(post1)
        .mockResolvedValueOnce(post2);

      const result = await service.getDailyDevotionals(userId);

      // Both posts should be grouped under the same date key
      expect(Object.keys(result)).toEqual(['2024-01-15']);
      expect(result['2024-01-15']).toHaveLength(2);
      expect(result['2024-01-15']).toEqual([post1, post2]);
    });
  });
});