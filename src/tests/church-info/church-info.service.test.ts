import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChurchInfoServiceImpl } from '../../church-info/church-info.service';
import type { IChurchRepository } from '../../churches/repository';
import type { CacheRepository } from '../../cache/cache.repository';
import type { ChurchInfo } from '../../church-info/types';
import type { Church } from '../../churches/schemas';

const createMockChurchRepository = () => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
  findByIds: vi.fn(),
  findBySlug: vi.fn(),
  findAll: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  checkSlugExists: vi.fn(),
  generateUniqueSlug: vi.fn(),
});

const createMockCacheRepository = () => ({
  write: vi.fn(),
  read: vi.fn(),
  delete: vi.fn(),
  deletePattern: vi.fn(),
  deleteByPrefix: vi.fn(),
  ping: vi.fn(),
});

describe('ChurchInfoService', () => {
  let mockChurchRepository: ReturnType<typeof createMockChurchRepository>;
  let mockCacheRepository: ReturnType<typeof createMockCacheRepository>;
  let service: ChurchInfoServiceImpl;

  const CHURCH_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
  const CHURCH_ID_2 = '550e8400-e29b-41d4-a716-446655440002';

  beforeEach(() => {
    mockChurchRepository = createMockChurchRepository();
    mockCacheRepository = createMockCacheRepository();

    service = new ChurchInfoServiceImpl(
      mockChurchRepository as unknown as IChurchRepository,
      mockCacheRepository as unknown as CacheRepository
    );
  });

  it('should fetch and return church info for all requested church IDs', async () => {
    const mockChurches: Church[] = [
      {
        id: CHURCH_ID_1,
        slug: 'church-1',
        name: 'First Church',
        description: 'A great church',
        logoUrl: 'https://example.com/logo1.jpg',
        coverImageUrl: null,
        byline: 'Come as you are',
        missionStatement: null,
        address: null,
        latitude: null,
        longitude: null,
        email: null,
        phoneNumber: null,
        websiteUrl: null,
        socialLinks: null,
        approvalStatus: 'Approved',
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        visibility: 'Public',
      } as Church,
      {
        id: CHURCH_ID_2,
        slug: 'church-2',
        name: 'Second Church',
        description: 'Another great church',
        logoUrl: 'https://example.com/logo2.jpg',
        coverImageUrl: null,
        byline: 'All are welcome',
        missionStatement: null,
        address: null,
        latitude: null,
        longitude: null,
        email: null,
        phoneNumber: null,
        websiteUrl: null,
        socialLinks: null,
        approvalStatus: 'Approved',
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        createdBy: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        visibility: 'Public',
      } as Church,
    ];

    mockCacheRepository.read.mockResolvedValue(null);
    mockChurchRepository.findByIds.mockResolvedValue(mockChurches);

    const result = await service.getBatchChurchInfo([CHURCH_ID_1, CHURCH_ID_2]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.get(CHURCH_ID_1)).toEqual({
      id: CHURCH_ID_1,
      slug: 'church-1',
      name: 'First Church',
      description: 'A great church',
      logoUrl: 'https://example.com/logo1.jpg',
      byline: 'Come as you are',
    });
    expect(mockChurchRepository.findByIds).toHaveBeenCalledWith([CHURCH_ID_1, CHURCH_ID_2]);
  });

  it('should return cached church info without querying database', async () => {
    const cachedChurchInfo: ChurchInfo = {
      id: CHURCH_ID_1,
      slug: 'church-1',
      name: 'First Church',
      description: 'A great church',
      logoUrl: 'https://example.com/logo1.jpg',
      byline: 'Come as you are',
    };

    mockCacheRepository.read.mockResolvedValue(cachedChurchInfo);

    const result = await service.getBatchChurchInfo([CHURCH_ID_1]);

    expect(result.size).toBe(1);
    expect(result.get(CHURCH_ID_1)).toEqual(cachedChurchInfo);
    expect(mockChurchRepository.findByIds).not.toHaveBeenCalled();
  });

  it('should query database on cache miss and populate cache with 3600s TTL', async () => {
    const mockChurch: Church = {
      id: CHURCH_ID_1,
      slug: 'church-1',
      name: 'First Church',
      description: 'A great church',
      logoUrl: 'https://example.com/logo1.jpg',
      coverImageUrl: null,
      byline: 'Come as you are',
      missionStatement: null,
      address: null,
      latitude: null,
      longitude: null,
      email: null,
      phoneNumber: null,
      websiteUrl: null,
      socialLinks: null,
      approvalStatus: 'Approved',
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      visibility: 'Public',
    } as Church;

    mockCacheRepository.read.mockResolvedValue(null);
    mockChurchRepository.findByIds.mockResolvedValue([mockChurch]);

    const result = await service.getBatchChurchInfo([CHURCH_ID_1]);

    expect(mockChurchRepository.findByIds).toHaveBeenCalledWith([CHURCH_ID_1]);
    expect(mockCacheRepository.write).toHaveBeenCalledWith(
      `church:info:${CHURCH_ID_1}`,
      expect.objectContaining({ id: CHURCH_ID_1 }),
      3600
    );
    expect(result.get(CHURCH_ID_1)?.id).toBe(CHURCH_ID_1);
  });

  it('should handle partial cache hits by fetching missing churches from database', async () => {
    const cachedChurchInfo: ChurchInfo = {
      id: CHURCH_ID_1,
      slug: 'church-1',
      name: 'First Church',
      description: 'A great church',
      logoUrl: 'https://example.com/logo1.jpg',
      byline: 'Come as you are',
    };

    const dbChurch: Church = {
      id: CHURCH_ID_2,
      slug: 'church-2',
      name: 'Second Church',
      description: 'Another great church',
      logoUrl: 'https://example.com/logo2.jpg',
      coverImageUrl: null,
      byline: 'All are welcome',
      missionStatement: null,
      address: null,
      latitude: null,
      longitude: null,
      email: null,
      phoneNumber: null,
      websiteUrl: null,
      socialLinks: null,
      approvalStatus: 'Approved',
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      createdBy: 'user-2',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      visibility: 'Public',
    } as Church;

    mockCacheRepository.read.mockImplementation((key: string) => {
      if (key === `church:info:${CHURCH_ID_1}`) {
        return Promise.resolve(cachedChurchInfo);
      }
      return Promise.resolve(null);
    });

    mockChurchRepository.findByIds.mockResolvedValue([dbChurch]);

    const result = await service.getBatchChurchInfo([CHURCH_ID_1, CHURCH_ID_2]);

    expect(result.size).toBe(2);
    expect(result.get(CHURCH_ID_1)).toEqual(cachedChurchInfo);
    expect(result.get(CHURCH_ID_2)?.id).toBe(CHURCH_ID_2);
    expect(mockChurchRepository.findByIds).toHaveBeenCalledWith([CHURCH_ID_2]);
    expect(mockCacheRepository.write).toHaveBeenCalledWith(
      `church:info:${CHURCH_ID_2}`,
      expect.objectContaining({ id: CHURCH_ID_2 }),
      3600
    );
  });

  it('should deduplicate church IDs before fetching', async () => {
    const mockChurch: Church = {
      id: CHURCH_ID_1,
      slug: 'church-1',
      name: 'First Church',
      description: 'A great church',
      logoUrl: 'https://example.com/logo1.jpg',
      coverImageUrl: null,
      byline: 'Come as you are',
      missionStatement: null,
      address: null,
      latitude: null,
      longitude: null,
      email: null,
      phoneNumber: null,
      websiteUrl: null,
      socialLinks: null,
      approvalStatus: 'Approved',
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      visibility: 'Public',
    } as Church;

    mockCacheRepository.read.mockResolvedValue(null);
    mockChurchRepository.findByIds.mockResolvedValue([mockChurch]);

    const result = await service.getBatchChurchInfo([
      CHURCH_ID_1,
      CHURCH_ID_1,
      CHURCH_ID_1,
    ]);

    expect(result.size).toBe(1);
    expect(mockChurchRepository.findByIds).toHaveBeenCalledWith([CHURCH_ID_1]);
    expect(mockChurchRepository.findByIds).toHaveBeenCalledTimes(1);
  });

  it('should skip missing churches instead of throwing error', async () => {
    const mockChurch: Church = {
      id: CHURCH_ID_1,
      slug: 'church-1',
      name: 'First Church',
      description: 'A great church',
      logoUrl: 'https://example.com/logo1.jpg',
      coverImageUrl: null,
      byline: 'Come as you are',
      missionStatement: null,
      address: null,
      latitude: null,
      longitude: null,
      email: null,
      phoneNumber: null,
      websiteUrl: null,
      socialLinks: null,
      approvalStatus: 'Approved',
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      visibility: 'Public',
    } as Church;

    mockCacheRepository.read.mockResolvedValue(null);
    mockChurchRepository.findByIds.mockResolvedValue([mockChurch]);

    const result = await service.getBatchChurchInfo([CHURCH_ID_1, CHURCH_ID_2]);

    expect(result.size).toBe(1);
    expect(result.has(CHURCH_ID_1)).toBe(true);
    expect(result.has(CHURCH_ID_2)).toBe(false);
  });
});
