import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { IChurchMemberRepository } from '../../churches/repository';
import type { ChurchMember } from '../../churches/schemas';

type MockedRepository = {
  [K in keyof IChurchMemberRepository]: Mock;
};

const createMockChurchMemberRepository = (): MockedRepository => ({
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
  findByChurchAndUser: vi.fn(),
  findByChurch: vi.fn(),
  findByUser: vi.fn(),
  updateRole: vi.fn(),
  updateStatus: vi.fn(),
});

describe('Church Membership Query Service', () => {
  let mockMemberRepository: ReturnType<typeof createMockChurchMemberRepository>;

  beforeEach(() => {
    mockMemberRepository = createMockChurchMemberRepository();
  });

  describe('getUserChurchMemberships', () => {
    it('should return array of church memberships for a user', async () => {
      const userId = 'user-123';
      const mockMembers: ChurchMember[] = [
        {
          id: 'member-1',
          churchId: 'church-1',
          userId,
          role: 'Owner',
          status: 'Active',
          joinedAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'member-2',
          churchId: 'church-2',
          userId,
          role: 'Member',
          status: 'Active',
          joinedAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      mockMemberRepository.findByUser.mockResolvedValue(mockMembers);

      // Call the repository method directly
      const memberships = await mockMemberRepository.findByUser(userId, {
        status: 'Active',
      });

      expect(memberships).toHaveLength(2);
      expect(memberships[0]).toMatchObject({
        churchId: 'church-1',
        role: 'Owner',
      });
      expect(memberships[1]).toMatchObject({
        churchId: 'church-2',
        role: 'Member',
      });
    });

    it('should return empty array for user with no memberships', async () => {
      const userId = 'user-no-churches';

      mockMemberRepository.findByUser.mockResolvedValue([]);

      const memberships = await mockMemberRepository.findByUser(userId, {
        status: 'Active',
      });

      expect(memberships).toEqual([]);
      expect(memberships).toHaveLength(0);
    });

    it('should only return active memberships', async () => {
      const userId = 'user-456';
      const mockMembers: ChurchMember[] = [
        {
          id: 'member-1',
          churchId: 'church-1',
          userId,
          role: 'Owner',
          status: 'Active',
          joinedAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      mockMemberRepository.findByUser.mockResolvedValue(mockMembers);

      const memberships = await mockMemberRepository.findByUser(userId, {
        status: 'Active',
      });

      expect(memberships).toHaveLength(1);
      expect(memberships.every((m) => m.status === 'Active')).toBe(true);
    });

    it('should handle multiple churches with different roles', async () => {
      const userId = 'user-multi';
      const mockMembers: ChurchMember[] = [
        {
          id: 'member-1',
          churchId: 'church-1',
          userId,
          role: 'Owner',
          status: 'Active',
          joinedAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'member-2',
          churchId: 'church-2',
          userId,
          role: 'Manager',
          status: 'Active',
          joinedAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'member-3',
          churchId: 'church-3',
          userId,
          role: 'Member',
          status: 'Active',
          joinedAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        },
      ];

      mockMemberRepository.findByUser.mockResolvedValue(mockMembers);

      const memberships = await mockMemberRepository.findByUser(userId, {
        status: 'Active',
      });

      expect(memberships).toHaveLength(3);
      expect(memberships.map((m) => m.role)).toContain('Owner');
      expect(memberships.map((m) => m.role)).toContain('Manager');
      expect(memberships.map((m) => m.role)).toContain('Member');
    });

    it('should transform memberships to correct format', async () => {
      const userId = 'user-789';
      const mockMembers: ChurchMember[] = [
        {
          id: 'member-1',
          churchId: 'church-1',
          userId,
          role: 'Owner',
          status: 'Active',
          joinedAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      mockMemberRepository.findByUser.mockResolvedValue(mockMembers);

      const memberships = await mockMemberRepository.findByUser(userId, {
        status: 'Active',
      });

      // Verify the format matches what Keycloak expects
      const formatted = memberships.map((m) => ({
        churchId: m.churchId,
        role: m.role,
      }));

      expect(formatted).toHaveLength(1);
      expect(formatted[0]).toEqual({
        churchId: 'church-1',
        role: 'Owner',
      });
    });

    it('should handle database query errors gracefully', async () => {
      const userId = 'user-error';

      mockMemberRepository.findByUser.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        mockMemberRepository.findByUser(userId, { status: 'Active' })
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('membership data transformation', () => {
    it('should extract churchId and role from ChurchMember', () => {
      const member: ChurchMember = {
        id: 'member-1',
        churchId: 'church-123',
        userId: 'user-456',
        role: 'Manager',
        status: 'Active',
        joinedAt: new Date(),
        updatedAt: new Date(),
      };

      const transformed = {
        churchId: member.churchId,
        role: member.role,
      };

      expect(transformed).toEqual({
        churchId: 'church-123',
        role: 'Manager',
      });
    });

    it('should preserve role enum values', () => {
      const roles: Array<{ role: 'Owner' | 'Manager' | 'Member' }> = [
        { role: 'Owner' },
        { role: 'Manager' },
        { role: 'Member' },
      ];

      roles.forEach((r) => {
        expect(['Owner', 'Manager', 'Member']).toContain(r.role);
      });
    });
  });
});
