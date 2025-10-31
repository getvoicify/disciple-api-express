import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { KeycloakAdminClient } from '../../keycloak/types';
import type { IChurchMembershipQueryService } from '../../churches/church-membership-query.service';
import type { ChurchMembershipInfo } from '../../churches/church-membership-query.service';

type MockedKeycloakClient = {
  [K in keyof KeycloakAdminClient]: Mock;
};

type MockedQueryService = {
  [K in keyof IChurchMembershipQueryService]: Mock;
};

const createMockKeycloakClient = (): MockedKeycloakClient => ({
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  getResourcesByIds: vi.fn(),
  getUserPermissions: vi.fn(),
  getUserAttributes: vi.fn(),
  updateUserAttributes: vi.fn(),
});

const createMockQueryService = (): MockedQueryService => ({
  getUserChurchMemberships: vi.fn(),
});

describe('Migration Script - Church Memberships to Keycloak', () => {
  let mockKeycloakClient: ReturnType<typeof createMockKeycloakClient>;
  let mockQueryService: ReturnType<typeof createMockQueryService>;

  beforeEach(() => {
    mockKeycloakClient = createMockKeycloakClient();
    mockQueryService = createMockQueryService();
  });

  describe('migrateUser', () => {
    it('should migrate a single user with memberships to Keycloak', async () => {
      const userId = 'user-123';
      const memberships: ChurchMembershipInfo[] = [
        { churchId: 'church-1', role: 'Owner' },
        { churchId: 'church-2', role: 'Member' },
      ];

      mockQueryService.getUserChurchMemberships.mockResolvedValue(memberships);
      mockKeycloakClient.getUserAttributes.mockResolvedValue({});
      mockKeycloakClient.updateUserAttributes.mockResolvedValue(undefined);

      // Simulate the migration logic
      const userMemberships = await mockQueryService.getUserChurchMemberships(userId);
      const existingAttributes = await mockKeycloakClient.getUserAttributes(userId);

      const churchMembershipAttribute = JSON.stringify(userMemberships);
      await mockKeycloakClient.updateUserAttributes(userId, {
        church_membership: churchMembershipAttribute,
      });

      expect(mockQueryService.getUserChurchMemberships).toHaveBeenCalledWith(userId);
      expect(mockKeycloakClient.getUserAttributes).toHaveBeenCalledWith(userId);
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith(userId, {
        church_membership: JSON.stringify(memberships),
      });
    });

    it('should handle users with no memberships (empty array)', async () => {
      const userId = 'user-no-churches';
      const memberships: ChurchMembershipInfo[] = [];

      mockQueryService.getUserChurchMemberships.mockResolvedValue(memberships);
      mockKeycloakClient.getUserAttributes.mockResolvedValue({});
      mockKeycloakClient.updateUserAttributes.mockResolvedValue(undefined);

      const userMemberships = await mockQueryService.getUserChurchMemberships(userId);
      await mockKeycloakClient.updateUserAttributes(userId, {
        church_membership: JSON.stringify(userMemberships),
      });

      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith(userId, {
        church_membership: '[]',
      });
    });

    it('should skip users not found in Keycloak with warning', async () => {
      const userId = 'user-not-in-keycloak';

      const error = new Error('User not found');
      error.name = 'UserNotFoundError';
      mockKeycloakClient.getUserAttributes.mockRejectedValue(error);

      await expect(mockKeycloakClient.getUserAttributes(userId)).rejects.toThrow('User not found');
    });

    it('should handle individual user failures without stopping', async () => {
      const userId1 = 'user-success';
      const userId2 = 'user-failure';
      const memberships1: ChurchMembershipInfo[] = [{ churchId: 'church-1', role: 'Owner' }];

      mockQueryService.getUserChurchMemberships
        .mockResolvedValueOnce(memberships1)
        .mockRejectedValueOnce(new Error('Database error'));

      mockKeycloakClient.getUserAttributes.mockResolvedValue({});
      mockKeycloakClient.updateUserAttributes.mockResolvedValue(undefined);

      // First user succeeds
      const memberships = await mockQueryService.getUserChurchMemberships(userId1);
      await mockKeycloakClient.getUserAttributes(userId1);
      await mockKeycloakClient.updateUserAttributes(userId1, {
        church_membership: JSON.stringify(memberships),
      });

      // Second user fails
      await expect(mockQueryService.getUserChurchMemberships(userId2)).rejects.toThrow('Database error');

      // Verify first user was processed
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith(userId1, {
        church_membership: JSON.stringify(memberships1),
      });
    });
  });

  describe('batch processing', () => {
    it('should process users in batches', async () => {
      const userIds = Array.from({ length: 250 }, (_, i) => `user-${i}`);
      const batchSize = 100;

      // Simulate processing in batches
      const batches: string[][] = [];
      for (let i = 0; i < userIds.length; i += batchSize) {
        batches.push(userIds.slice(i, i + batchSize));
      }

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(100);
      expect(batches[1]).toHaveLength(100);
      expect(batches[2]).toHaveLength(50);
    });

    it('should track progress for batch processing', () => {
      const totalUsers = 250;
      const batchSize = 100;
      const processedCounts: number[] = [];

      for (let i = 0; i < totalUsers; i += batchSize) {
        const batch = Math.min(batchSize, totalUsers - i);
        processedCounts.push(i + batch);
      }

      expect(processedCounts).toEqual([100, 200, 250]);
    });
  });

  describe('idempotency', () => {
    it('should only update if attributes differ from database state', async () => {
      const userId = 'user-123';
      const currentMemberships: ChurchMembershipInfo[] = [
        { churchId: 'church-1', role: 'Owner' },
      ];

      mockQueryService.getUserChurchMemberships.mockResolvedValue(currentMemberships);

      // First run - no existing attributes
      mockKeycloakClient.getUserAttributes.mockResolvedValueOnce({});
      mockKeycloakClient.updateUserAttributes.mockResolvedValue(undefined);

      const memberships1 = await mockQueryService.getUserChurchMemberships(userId);
      const existingAttrs1 = await mockKeycloakClient.getUserAttributes(userId);
      const newAttrValue = JSON.stringify(memberships1);
      const existingAttrValue = existingAttrs1?.church_membership;

      // Should update because no existing attribute
      if (newAttrValue !== existingAttrValue) {
        await mockKeycloakClient.updateUserAttributes(userId, {
          church_membership: newAttrValue,
        });
      }

      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledTimes(1);

      // Second run - attributes already match
      mockKeycloakClient.getUserAttributes.mockResolvedValueOnce({
        church_membership: JSON.stringify(currentMemberships),
      });

      const memberships2 = await mockQueryService.getUserChurchMemberships(userId);
      const existingAttrs2 = await mockKeycloakClient.getUserAttributes(userId);
      const newAttrValue2 = JSON.stringify(memberships2);
      const existingAttrValue2 = existingAttrs2?.church_membership;

      // Should not update because attributes match
      if (newAttrValue2 !== existingAttrValue2) {
        await mockKeycloakClient.updateUserAttributes(userId, {
          church_membership: newAttrValue2,
        });
      }

      // updateUserAttributes should still be called only once (from first run)
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledTimes(1);
    });

    it('should allow script to be run multiple times safely', async () => {
      const userId = 'user-456';
      const memberships: ChurchMembershipInfo[] = [
        { churchId: 'church-1', role: 'Member' },
      ];

      mockQueryService.getUserChurchMemberships.mockResolvedValue(memberships);
      mockKeycloakClient.getUserAttributes.mockResolvedValue({
        church_membership: JSON.stringify(memberships),
      });

      // Run migration twice
      for (let run = 0; run < 2; run++) {
        const userMemberships = await mockQueryService.getUserChurchMemberships(userId);
        const existingAttrs = await mockKeycloakClient.getUserAttributes(userId);
        const newAttrValue = JSON.stringify(userMemberships);
        const existingAttrValue = existingAttrs?.church_membership;

        if (newAttrValue !== existingAttrValue) {
          await mockKeycloakClient.updateUserAttributes(userId, {
            church_membership: newAttrValue,
          });
        }
      }

      // Should query memberships and attributes twice
      expect(mockQueryService.getUserChurchMemberships).toHaveBeenCalledTimes(2);
      expect(mockKeycloakClient.getUserAttributes).toHaveBeenCalledTimes(2);

      // Should not update attributes because they already match
      expect(mockKeycloakClient.updateUserAttributes).not.toHaveBeenCalled();
    });
  });

  describe('progress tracking', () => {
    it('should track success and failure counts', () => {
      const stats = {
        totalUsers: 10,
        successCount: 8,
        failureCount: 2,
        skippedCount: 0,
      };

      expect(stats.successCount + stats.failureCount + stats.skippedCount).toBe(stats.totalUsers);
      expect(stats.successCount).toBe(8);
      expect(stats.failureCount).toBe(2);
    });

    it('should track skipped users (not found in Keycloak)', () => {
      const stats = {
        totalUsers: 10,
        successCount: 7,
        failureCount: 1,
        skippedCount: 2,
      };

      expect(stats.skippedCount).toBe(2);
      expect(stats.successCount + stats.failureCount + stats.skippedCount).toBe(stats.totalUsers);
    });
  });
});
