import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrayerRequestService } from '../../../prayer-walls/services/prayer-request.service';
import type { IPrayerRequestRepository } from '../../../prayer-walls/repositories/prayer-request.repository';
import type { IPrayerWallMembershipRepository } from '../../../prayer-walls/repositories/prayer-wall-membership.repository';
import type { PrayerRequest } from '../../../prayer-walls/types/prayer-wall.types';
import {
  WallMembershipRequiredError,
  PrayerRequestNotFoundError,
  ThreadDepthExceededError,
  EditWindowExpiredError,
} from '../../../prayer-walls/errors';

describe('PrayerRequestService', () => {
  let service: PrayerRequestService;
  let mockPrayerRequestRepo: IPrayerRequestRepository;
  let mockMembershipRepo: IPrayerWallMembershipRepository;

  const testWallId = 'wall-123';
  const testAuthorId = 'author-123';
  const testPrayerId = 'prayer-123';
  const testParentId = 'parent-123';

  beforeEach(() => {
    // Mock PrayerRequestRepository
    mockPrayerRequestRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByWallId: vi.fn(),
      findThreadChildren: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      restore: vi.fn(),
      validateThreadDepth: vi.fn(),
    };

    // Mock PrayerWallMembershipRepository
    mockMembershipRepo = {
      join: vi.fn(),
      leave: vi.fn(),
      isMember: vi.fn(),
      findMembers: vi.fn(),
      removeMember: vi.fn(),
      ban: vi.fn(),
      unban: vi.fn(),
      isBanned: vi.fn(),
    };

    service = new PrayerRequestService(mockPrayerRequestRepo, mockMembershipRepo);
  });

  it('should create a prayer when user is a wall member', async () => {
    const prayerData = {
      wall_id: testWallId,
      content: 'Please pray for my family',
      anonymity_level: 'identified' as const,
    };

    const expectedPrayer: PrayerRequest = {
      id: testPrayerId,
      wall_id: testWallId,
      author_id: testAuthorId,
      parent_id: null,
      thread_depth: 0,
      content: prayerData.content,
      anonymity_level: 'identified',
      has_attachment: false,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      deleted_by: null,
    };

    vi.mocked(mockMembershipRepo.isMember).mockResolvedValue(true);
    vi.mocked(mockPrayerRequestRepo.create).mockResolvedValue(expectedPrayer);

    const result = await service.createPrayer(testWallId, prayerData, testAuthorId);

    expect(result).toEqual(expectedPrayer);
    expect(mockMembershipRepo.isMember).toHaveBeenCalledWith(testWallId, testAuthorId);
    expect(mockPrayerRequestRepo.create).toHaveBeenCalledWith({
      wall_id: testWallId,
      author_id: testAuthorId,
      content: prayerData.content,
      anonymity_level: 'identified',
    });
  });

  it('should reject prayer creation when user is not a wall member', async () => {
    const prayerData = {
      wall_id: testWallId,
      content: 'Please pray for my family',
    };

    vi.mocked(mockMembershipRepo.isMember).mockResolvedValue(false);

    await expect(service.createPrayer(testWallId, prayerData, testAuthorId)).rejects.toThrow(
      WallMembershipRequiredError
    );

    expect(mockPrayerRequestRepo.create).not.toHaveBeenCalled();
  });

  it('should reject thread response when parent depth >= 3', async () => {
    const prayerData = {
      wall_id: testWallId,
      content: 'Amen, praying for you',
      parent_id: testParentId,
    };

    vi.mocked(mockMembershipRepo.isMember).mockResolvedValue(true);
    vi.mocked(mockPrayerRequestRepo.validateThreadDepth).mockResolvedValue(3);

    await expect(service.createPrayer(testWallId, prayerData, testAuthorId)).rejects.toThrow(
      ThreadDepthExceededError
    );

    expect(mockPrayerRequestRepo.create).not.toHaveBeenCalled();
  });

  it('should allow prayer edit within 5-minute window', async () => {
    const now = new Date();
    const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);

    const existingPrayer: PrayerRequest = {
      id: testPrayerId,
      wall_id: testWallId,
      author_id: testAuthorId,
      parent_id: null,
      thread_depth: 0,
      content: 'Original prayer',
      anonymity_level: 'identified',
      has_attachment: false,
      created_at: fourMinutesAgo,
      updated_at: fourMinutesAgo,
      deleted_at: null,
      deleted_by: null,
    };

    const updatedPrayer: PrayerRequest = {
      ...existingPrayer,
      content: 'Updated prayer',
      updated_at: now,
    };

    vi.mocked(mockPrayerRequestRepo.findById).mockResolvedValue(existingPrayer);
    vi.mocked(mockPrayerRequestRepo.update).mockResolvedValue(updatedPrayer);

    const result = await service.updatePrayer(testPrayerId, 'Updated prayer', testAuthorId);

    expect(result).toEqual(updatedPrayer);
    expect(mockPrayerRequestRepo.update).toHaveBeenCalledWith(testPrayerId, {
      content: 'Updated prayer',
    });
  });

  it('should reject prayer edit after 5-minute window', async () => {
    const now = new Date();
    const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);

    const existingPrayer: PrayerRequest = {
      id: testPrayerId,
      wall_id: testWallId,
      author_id: testAuthorId,
      parent_id: null,
      thread_depth: 0,
      content: 'Original prayer',
      anonymity_level: 'identified',
      has_attachment: false,
      created_at: sixMinutesAgo,
      updated_at: sixMinutesAgo,
      deleted_at: null,
      deleted_by: null,
    };

    vi.mocked(mockPrayerRequestRepo.findById).mockResolvedValue(existingPrayer);

    await expect(service.updatePrayer(testPrayerId, 'Updated prayer', testAuthorId)).rejects.toThrow(
      EditWindowExpiredError
    );

    expect(mockPrayerRequestRepo.update).not.toHaveBeenCalled();
  });

  it('should list prayers with pagination for wall members', async () => {
    const prayers: PrayerRequest[] = [
      {
        id: 'prayer-1',
        wall_id: testWallId,
        author_id: 'user-1',
        parent_id: null,
        thread_depth: 0,
        content: 'Prayer 1',
        anonymity_level: 'identified',
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null,
      },
      {
        id: 'prayer-2',
        wall_id: testWallId,
        author_id: 'user-2',
        parent_id: null,
        thread_depth: 0,
        content: 'Prayer 2',
        anonymity_level: 'anonymous_to_members',
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null,
      },
    ];

    const pagination = { limit: 20, cursor: undefined };

    vi.mocked(mockMembershipRepo.isMember).mockResolvedValue(true);
    vi.mocked(mockPrayerRequestRepo.findByWallId).mockResolvedValue(prayers);

    const result = await service.listPrayers(testWallId, testAuthorId, pagination);

    expect(result).toEqual(prayers);
    expect(mockMembershipRepo.isMember).toHaveBeenCalledWith(testWallId, testAuthorId);
    expect(mockPrayerRequestRepo.findByWallId).toHaveBeenCalledWith(testWallId, pagination);
  });
});
