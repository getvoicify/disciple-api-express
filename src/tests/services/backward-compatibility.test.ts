import { describe, expect, it, vi } from 'vitest';
import { ChurchMembershipServiceImpl } from '../../churches/membership-service';
import { PostServiceImpl } from '../../posts/service';
import { SeriesServiceImpl } from '../../series/service';

describe('Backward Compatibility - Services Without Info Services', () => {
  const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
  const mockChurchId = '550e8400-e29b-41d4-a716-446655440002';

  describe('Church Membership Service', () => {
    it('should work without UserInfoService (no user embedding)', async () => {
      // Mock dependencies without UserInfoService
      const mockChurchRepo = {
        findById: vi.fn().mockResolvedValue({
          id: mockChurchId,
          name: 'Test Church',
          approvalStatus: 'Approved',
        }),
      };

      const mockMemberRepo = {
        findByChurchAndUser: vi.fn().mockResolvedValue({
          id: 'membership-1',
          churchId: mockChurchId,
          userId: mockUserId,
          role: 'Member',
          status: 'Active',
        }),
        findByChurch: vi.fn().mockResolvedValue([
          {
            id: 'member-1',
            churchId: mockChurchId,
            userId: mockUserId,
            role: 'Member',
            status: 'Active',
            joinedAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      // Service without UserInfoService
      const service = new ChurchMembershipServiceImpl(
        mockChurchRepo as any,
        mockMemberRepo as any,
        undefined // No UserInfoService
      );

      const members = await service.getChurchMembers(mockChurchId, mockUserId);

      // Verify service works and returns members without embedded user
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe(mockUserId);
      expect(members[0].user).toBeUndefined(); // No embedding
    });

    it('should embed user info in getUserMemberships when service is available', async () => {
      const mockMemberRepo = {
        findByUser: vi.fn().mockResolvedValue([
          {
            id: 'member-1',
            churchId: mockChurchId,
            userId: mockUserId,
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
            [
              mockUserId,
              {
                userId: mockUserId,
                firstName: 'John',
                lastName: 'Doe',
                displayName: 'John Doe',
                avatarUrl: null,
                email: 'john@example.com',
              },
            ],
          ])
        ),
      };

      const service = new ChurchMembershipServiceImpl(
        null as any,
        mockMemberRepo as any,
        mockUserInfoService as any
      );

      const memberships = await service.getUserMemberships(mockUserId);

      // Verify embedding occurred
      expect(memberships).toHaveLength(1);
      expect(memberships[0].user).toBeDefined();
      expect(memberships[0].user?.displayName).toBe('John Doe');
      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledWith([mockUserId]);
    });
  });

  describe('Posts Service', () => {
    it('should work without info services (no embedding)', async () => {
      const mockPostRepo = {
        findAll: vi.fn().mockResolvedValue([
          {
            id: 'post-1',
            title: 'Test Post',
            content: 'Content',
            authorId: mockUserId,
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

      // Service without info services
      const service = new PostServiceImpl(
        mockPostRepo as any,
        null as any,
        null as any,
        undefined, // No UserInfoService
        undefined  // No ChurchInfoService
      );

      const posts = await service.listPosts();

      // Verify service works without embedding
      expect(posts).toHaveLength(1);
      expect(posts[0].authorId).toBe(mockUserId);
      expect(posts[0].churchId).toBe(mockChurchId);
      expect(posts[0].author).toBeUndefined(); // No user embedding
      expect(posts[0].church).toBeUndefined(); // No church embedding
    });
  });

  describe('Series Service', () => {
    it('should work without info services (no embedding)', async () => {
      const mockSeriesRepo = {
        findAll: vi.fn().mockResolvedValue([
          {
            id: 'series-1',
            title: 'Test Series',
            description: 'Description',
            image: null,
            authorId: mockUserId,
            churchId: mockChurchId,
            status: 'published',
            publishedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      // Service without info services
      const service = new SeriesServiceImpl(
        mockSeriesRepo as any,
        null as any,
        null as any,
        undefined, // No UserInfoService
        undefined  // No ChurchInfoService
      );

      const series = await service.listSeries();

      // Verify service works without embedding
      expect(series).toHaveLength(1);
      expect(series[0].authorId).toBe(mockUserId);
      expect(series[0].churchId).toBe(mockChurchId);
      expect(series[0].author).toBeUndefined(); // No user embedding
      expect(series[0].church).toBeUndefined(); // No church embedding
    });
  });
});
