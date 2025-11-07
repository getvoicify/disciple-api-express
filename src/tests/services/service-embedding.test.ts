import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ChurchMembershipServiceImpl } from '../../churches/membership-service';
import { PostServiceImpl } from '../../posts/service';
import { SeriesServiceImpl } from '../../series/service';
import { PrayerWallService } from '../../prayer-walls/services/prayer-wall.service';
import type { ChurchMember } from '../../churches/schemas';
import type { Post } from '../../posts/schemas';
import type { Series } from '../../series/schemas';
import type { PrayerWallMembership, PrayerWall } from '../../prayer-walls/types/prayer-wall.types';
import type { UserInfo } from '../../user-info/types';
import type { ChurchInfo } from '../../church-info/types';

describe('Service Layer Embedding Integration Tests', () => {
  const mockUserId1 = '550e8400-e29b-41d4-a716-446655440001';
  const mockUserId2 = '550e8400-e29b-41d4-a716-446655440002';
  const mockChurchId = '550e8400-e29b-41d4-a716-446655440003';
  const mockWallId = 'wall-123';

  const mockUserInfo1: UserInfo = {
    userId: mockUserId1,
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
    avatarUrl: 'https://example.com/avatar.jpg',
    email: 'john@example.com',
  };

  const mockUserInfo2: UserInfo = {
    userId: mockUserId2,
    firstName: 'Jane',
    lastName: 'Smith',
    displayName: 'Jane Smith',
    avatarUrl: null,
    email: null, // Privacy: email hidden
  };

  const mockChurchInfo: ChurchInfo = {
    id: mockChurchId,
    slug: 'test-church',
    name: 'Test Church',
    description: 'A test church',
    logoUrl: 'https://example.com/logo.jpg',
    byline: 'Come as you are',
  };

  describe('Church Membership Service - User Embedding', () => {
    it('should embed user info in church members when getChurchMembers is called', async () => {
      // Mock dependencies
      const mockChurchRepo = {
        findById: vi.fn().mockResolvedValue({ id: mockChurchId, name: 'Test Church', approvalStatus: 'Approved' }),
      };

      const mockMemberRepo = {
        findByChurchAndUser: vi.fn().mockResolvedValue({
          id: 'membership-1',
          churchId: mockChurchId,
          userId: mockUserId1,
          role: 'Member',
          status: 'Active',
        }),
        findByChurch: vi.fn().mockResolvedValue([
          {
            id: 'member-1',
            churchId: mockChurchId,
            userId: mockUserId1,
            role: 'Member',
            status: 'Active',
            joinedAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'member-2',
            churchId: mockChurchId,
            userId: mockUserId2,
            role: 'Member',
            status: 'Active',
            joinedAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      const mockUserInfoService = {
        getBatchUserInfo: vi.fn().mockResolvedValue(
          new Map([
            [mockUserId1, mockUserInfo1],
            [mockUserId2, mockUserInfo2],
          ])
        ),
      };

      const service = new ChurchMembershipServiceImpl(
        mockChurchRepo as any,
        mockMemberRepo as any,
        mockUserInfoService as any
      );

      const members = await service.getChurchMembers(mockChurchId, mockUserId1);

      // Verify user embedding
      expect(members).toHaveLength(2);
      expect(members[0].user).toBeDefined();
      expect(members[0].user?.userId).toBe(mockUserId1);
      expect(members[0].user?.email).toBe('john@example.com');
      expect(members[1].user).toBeDefined();
      expect(members[1].user?.email).toBeNull(); // Privacy setting
      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledWith([mockUserId1, mockUserId2]);
    });
  });

  describe('Prayer Wall Service - User Embedding', () => {
    it('should embed user info in prayer wall memberships when listMembers is called', async () => {
      // Mock dependencies
      const mockWallRepo = {
        findById: vi.fn().mockResolvedValue({
          id: mockWallId,
          church_id: mockChurchId,
          name: 'Test Wall',
        }),
      };

      const mockMembershipRepo = {
        isMember: vi.fn().mockResolvedValue(true),
        findMembers: vi.fn().mockResolvedValue([
          {
            id: 'membership-1',
            wall_id: mockWallId,
            user_id: mockUserId1,
            joined_at: new Date(),
            invited_by: null,
            left_at: null,
            is_banned: false,
            banned_at: null,
            banned_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]),
      };

      const mockUserInfoService = {
        getBatchUserInfo: vi.fn().mockResolvedValue(
          new Map([[mockUserId1, mockUserInfo1]])
        ),
      };

      const service = new PrayerWallService(
        mockWallRepo as any,
        mockMembershipRepo as any,
        null as any,
        null as any,
        mockUserInfoService as any
      );

      const members = await service.listMembers(mockWallId, mockUserId1);

      // Verify user embedding
      expect(members).toHaveLength(1);
      expect(members[0].user).toBeDefined();
      expect(members[0].user?.userId).toBe(mockUserId1);
      expect(members[0].user?.displayName).toBe('John Doe');
      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledWith([mockUserId1]);
    });
  });

  describe('Posts Service - Church Embedding', () => {
    it('should embed church info in posts when listPosts is called', async () => {
      // Mock dependencies
      const mockPostRepo = {
        findAll: vi.fn().mockResolvedValue([
          {
            id: 'post-1',
            title: 'Test Post',
            content: 'Content',
            authorId: mockUserId1,
            churchId: mockChurchId,
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
          },
        ]),
      };

      const mockUserInfoService = {
        getBatchUserInfo: vi.fn().mockResolvedValue(
          new Map([[mockUserId1, mockUserInfo1]])
        ),
      };

      const mockChurchInfoService = {
        getBatchChurchInfo: vi.fn().mockResolvedValue(
          new Map([[mockChurchId, mockChurchInfo]])
        ),
      };

      const service = new PostServiceImpl(
        mockPostRepo as any,
        null as any,
        null as any,
        mockUserInfoService as any,
        mockChurchInfoService as any
      );

      const posts = await service.listPosts();

      // Verify both user and church embedding
      expect(posts).toHaveLength(1);
      expect(posts[0].author).toBeDefined();
      expect(posts[0].author?.userId).toBe(mockUserId1);
      expect(posts[0].church).toBeDefined();
      expect(posts[0].church?.id).toBe(mockChurchId);
      expect(posts[0].church?.name).toBe('Test Church');
      expect(mockChurchInfoService.getBatchChurchInfo).toHaveBeenCalledWith([mockChurchId]);
    });
  });

  describe('Series Service - Church Embedding', () => {
    it('should embed church info in series when listSeries is called', async () => {
      // Mock dependencies
      const mockSeriesRepo = {
        findAll: vi.fn().mockResolvedValue([
          {
            id: 'series-1',
            title: 'Test Series',
            description: 'Description',
            image: null,
            authorId: mockUserId1,
            churchId: mockChurchId,
            status: 'published',
            publishedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      const mockUserInfoService = {
        getBatchUserInfo: vi.fn().mockResolvedValue(
          new Map([[mockUserId1, mockUserInfo1]])
        ),
      };

      const mockChurchInfoService = {
        getBatchChurchInfo: vi.fn().mockResolvedValue(
          new Map([[mockChurchId, mockChurchInfo]])
        ),
      };

      const service = new SeriesServiceImpl(
        mockSeriesRepo as any,
        null as any,
        null as any,
        mockUserInfoService as any,
        mockChurchInfoService as any
      );

      const series = await service.listSeries();

      // Verify both user and church embedding
      expect(series).toHaveLength(1);
      expect(series[0].author).toBeDefined();
      expect(series[0].author?.userId).toBe(mockUserId1);
      expect(series[0].church).toBeDefined();
      expect(series[0].church?.id).toBe(mockChurchId);
      expect(series[0].church?.name).toBe('Test Church');
      expect(mockChurchInfoService.getBatchChurchInfo).toHaveBeenCalledWith([mockChurchId]);
    });
  });

  describe('Prayer Wall Service - Church Embedding', () => {
    it('should embed church info in prayer walls when listWalls is called', async () => {
      // Mock dependencies
      const mockWallRepo = {
        findByChurchId: vi.fn().mockResolvedValue([
          {
            id: mockWallId,
            church_id: mockChurchId,
            name: 'Test Wall',
            description: 'Description',
            created_by: mockUserId1,
            is_private: false,
            has_restricted_access: false,
            schedule: null,
            video_call_link: null,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          },
        ]),
      };

      const mockMembershipRepo = {
        isMember: vi.fn().mockResolvedValue(true),
      };

      const mockChurchInfoService = {
        getBatchChurchInfo: vi.fn().mockResolvedValue(
          new Map([[mockChurchId, mockChurchInfo]])
        ),
      };

      const service = new PrayerWallService(
        mockWallRepo as any,
        mockMembershipRepo as any,
        null as any,
        null as any,
        null as any,
        mockChurchInfoService as any
      );

      const walls = await service.listWalls(mockChurchId, mockUserId1, { limit: 10 });

      // Verify church embedding
      expect(walls).toHaveLength(1);
      expect(walls[0].church).toBeDefined();
      expect(walls[0].church?.id).toBe(mockChurchId);
      expect(walls[0].church?.slug).toBe('test-church');
      expect(mockChurchInfoService.getBatchChurchInfo).toHaveBeenCalledWith([mockChurchId]);
    });
  });
});
