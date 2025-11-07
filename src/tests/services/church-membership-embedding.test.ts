import { describe, expect, it, vi } from 'vitest';
import { ChurchMembershipServiceImpl } from '../../churches/membership-service';
import type { ChurchInfoService } from '../../church-info';

describe('Church Membership Service - Church Info Embedding', () => {
  const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
  const mockChurchId = '550e8400-e29b-41d4-a716-446655440002';
  const mockChurchId2 = '550e8400-e29b-41d4-a716-446655440003';

  const mockChurchInfo = {
    id: mockChurchId,
    slug: 'test-church',
    name: 'Test Church',
    description: 'A test church',
    logoUrl: 'https://example.com/logo.jpg',
    byline: 'Test Byline',
  };

  const mockChurchInfo2 = {
    id: mockChurchId2,
    slug: 'test-church-2',
    name: 'Test Church 2',
    description: 'Another test church',
    logoUrl: 'https://example.com/logo2.jpg',
    byline: 'Test Byline 2',
  };

  describe('getChurchMembers', () => {
    it('should embed church info when ChurchInfoService is provided', async () => {
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

      const mockChurchInfoService: ChurchInfoService = {
        getBatchChurchInfo: vi.fn().mockResolvedValue(
          new Map([[mockChurchId, mockChurchInfo]])
        ),
      };

      const service = new ChurchMembershipServiceImpl(
        mockChurchRepo as any,
        mockMemberRepo as any,
        undefined, // No UserInfoService
        mockChurchInfoService
      );

      const members = await service.getChurchMembers(mockChurchId, mockUserId);

      expect(members).toHaveLength(1);
      expect(members[0].church).toBeDefined();
      expect(members[0].church?.name).toBe('Test Church');
      expect(members[0].church?.slug).toBe('test-church');
      expect(mockChurchInfoService.getBatchChurchInfo).toHaveBeenCalledWith([mockChurchId]);
    });

    it('should work without ChurchInfoService (backward compatibility)', async () => {
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

      const service = new ChurchMembershipServiceImpl(
        mockChurchRepo as any,
        mockMemberRepo as any,
        undefined, // No UserInfoService
        undefined  // No ChurchInfoService
      );

      const members = await service.getChurchMembers(mockChurchId, mockUserId);

      expect(members).toHaveLength(1);
      expect(members[0].churchId).toBe(mockChurchId);
      expect(members[0].church).toBeUndefined(); // No embedding
    });
  });

  describe('getUserMemberships', () => {
    it('should embed church info when ChurchInfoService is provided', async () => {
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
          {
            id: 'member-2',
            churchId: mockChurchId2,
            userId: mockUserId,
            role: 'Manager',
            status: 'Active',
            joinedAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      const mockChurchInfoService: ChurchInfoService = {
        getBatchChurchInfo: vi.fn().mockResolvedValue(
          new Map([
            [mockChurchId, mockChurchInfo],
            [mockChurchId2, mockChurchInfo2],
          ])
        ),
      };

      const service = new ChurchMembershipServiceImpl(
        null as any,
        mockMemberRepo as any,
        undefined, // No UserInfoService
        mockChurchInfoService
      );

      const memberships = await service.getUserMemberships(mockUserId);

      expect(memberships).toHaveLength(2);
      expect(memberships[0].church).toBeDefined();
      expect(memberships[0].church?.name).toBe('Test Church');
      expect(memberships[1].church).toBeDefined();
      expect(memberships[1].church?.name).toBe('Test Church 2');
      expect(mockChurchInfoService.getBatchChurchInfo).toHaveBeenCalledWith([
        mockChurchId,
        mockChurchId2,
      ]);
    });

    it('should work without ChurchInfoService (backward compatibility)', async () => {
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

      const service = new ChurchMembershipServiceImpl(
        null as any,
        mockMemberRepo as any,
        undefined, // No UserInfoService
        undefined  // No ChurchInfoService
      );

      const memberships = await service.getUserMemberships(mockUserId);

      expect(memberships).toHaveLength(1);
      expect(memberships[0].churchId).toBe(mockChurchId);
      expect(memberships[0].church).toBeUndefined(); // No embedding
    });
  });

  describe('Combined User and Church Info Embedding', () => {
    it('should embed both user and church info together', async () => {
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

      const mockChurchInfoService: ChurchInfoService = {
        getBatchChurchInfo: vi.fn().mockResolvedValue(
          new Map([[mockChurchId, mockChurchInfo]])
        ),
      };

      const service = new ChurchMembershipServiceImpl(
        null as any,
        mockMemberRepo as any,
        mockUserInfoService as any,
        mockChurchInfoService
      );

      const memberships = await service.getUserMemberships(mockUserId);

      expect(memberships).toHaveLength(1);
      expect(memberships[0].user).toBeDefined();
      expect(memberships[0].user?.displayName).toBe('John Doe');
      expect(memberships[0].church).toBeDefined();
      expect(memberships[0].church?.name).toBe('Test Church');
      expect(mockUserInfoService.getBatchUserInfo).toHaveBeenCalledWith([mockUserId]);
      expect(mockChurchInfoService.getBatchChurchInfo).toHaveBeenCalledWith([mockChurchId]);
    });
  });

  describe('Church Info Batch Fetching', () => {
    it('should extract unique church IDs for batch fetching', async () => {
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
          {
            id: 'member-2',
            churchId: mockChurchId, // Same church ID - should deduplicate
            userId: mockUserId,
            role: 'Member',
            status: 'Active',
            joinedAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'member-3',
            churchId: mockChurchId2, // Different church ID
            userId: mockUserId,
            role: 'Manager',
            status: 'Active',
            joinedAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      const mockChurchInfoService: ChurchInfoService = {
        getBatchChurchInfo: vi.fn().mockResolvedValue(
          new Map([
            [mockChurchId, mockChurchInfo],
            [mockChurchId2, mockChurchInfo2],
          ])
        ),
      };

      const service = new ChurchMembershipServiceImpl(
        null as any,
        mockMemberRepo as any,
        undefined,
        mockChurchInfoService
      );

      await service.getUserMemberships(mockUserId);

      // Should only call with unique church IDs
      expect(mockChurchInfoService.getBatchChurchInfo).toHaveBeenCalledWith([
        mockChurchId,
        mockChurchId2,
      ]);
    });
  });
});
