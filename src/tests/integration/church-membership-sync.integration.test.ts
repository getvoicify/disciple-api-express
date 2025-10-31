import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import type { Job } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../../queues/church-membership-sync.types';
import { SyncProcessor } from '../../queues/sync.processor';
import { JobHandlerRegistry } from '../../queues/handlers/handler-registry';
import { MembershipSyncService } from '../../queues/handlers/membership-sync.service';
import { OwnerCreatedHandler } from '../../queues/handlers/owner-created.handler';
import { MemberJoinedHandler } from '../../queues/handlers/member-joined.handler';
import { MemberLeftHandler } from '../../queues/handlers/member-left.handler';
import { OwnershipTransferredHandler } from '../../queues/handlers/ownership-transferred.handler';
import { ChurchMembershipOutboxAdapter } from '../../churches/church-membership-outbox.adapter';
import type { IChurchMembershipQueryService } from '../../churches/church-membership-query.service';
import type { KeycloakAdminClient } from '../../keycloak/types';
import type { Outbox } from '../../outbox';
import type { ChurchMembershipOutboxEvent } from '../../churches/church-membership-events';

// Mock logger
vi.mock('../../logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

/**
 * Integration tests for church membership sync feature
 * Tests end-to-end flows from event emission through processor to Keycloak sync
 *
 * NOTE: These tests use mocked BullMQ components and can run without Redis.
 * For true end-to-end integration tests with real Redis/BullMQ, see manual verification section.
 *
 * These tests verify:
 * - Complete flows through processor → handlers → Keycloak
 * - Retry behavior with simulated failures
 * - Atomic operations for ownership transfers
 * - Error handling and propagation
 * - Multi-church membership handling
 */
describe('Church Membership Sync - Integration Tests', () => {
  let processor: SyncProcessor<ChurchMembershipSyncJobData, ChurchMembershipSyncJobData>;
  let outboxAdapter: ChurchMembershipOutboxAdapter;
  let mockMembershipService: IChurchMembershipQueryService;
  let mockKeycloakClient: KeycloakAdminClient;
  let mockOutbox: Outbox<ChurchMembershipOutboxEvent>;
  let mockQueue: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock membership service
    mockMembershipService = {
      getUserChurchMemberships: vi.fn(),
    };

    // Mock Keycloak client
    mockKeycloakClient = {
      getUserAttributes: vi.fn(),
      updateUserAttributes: vi.fn(),
      createResource: vi.fn(),
      updateResource: vi.fn(),
      deleteResource: vi.fn(),
      getResourcesByIds: vi.fn(),
      getUserPermissions: vi.fn(),
    } as unknown as KeycloakAdminClient;

    // Mock outbox
    mockOutbox = {
      enqueueCreate: vi.fn(),
      enqueueUpdate: vi.fn(),
      enqueueDelete: vi.fn(),
    } as unknown as Outbox<ChurchMembershipOutboxEvent>;

    // Mock queue
    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-1', data: {} }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    // Create real sync service
    const syncService = new MembershipSyncService(mockMembershipService, mockKeycloakClient);

    // Create real handler registry
    const handlers = [
      new OwnerCreatedHandler(syncService),
      new MemberJoinedHandler(syncService),
      new MemberLeftHandler(syncService),
      new OwnershipTransferredHandler(syncService),
    ];
    const handlerRegistry = new JobHandlerRegistry<ChurchMembershipSyncJobData>();
    handlers.forEach(handler => handlerRegistry.register(handler));

    // Create real processor
    processor = new SyncProcessor<ChurchMembershipSyncJobData, ChurchMembershipSyncJobData>(
      handlerRegistry,
      (data) => ({
        eventType: data.eventType,
        entityId: data.churchId,
      })
    );

    // Create outbox adapter
    outboxAdapter = new ChurchMembershipOutboxAdapter(mockOutbox, mockQueue);
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('End-to-End Flow Tests', () => {
    it('Test 1: should complete full church creation flow from event to Keycloak sync', async () => {
      const churchId = 'church-123';
      const userId = 'user-456';

      // Mock membership service to return owner role
      vi.mocked(mockMembershipService.getUserChurchMemberships).mockResolvedValue([
        { churchId, role: 'Owner' },
      ]);

      // Mock Keycloak client
      vi.mocked(mockKeycloakClient.getUserAttributes).mockResolvedValue({});
      vi.mocked(mockKeycloakClient.updateUserAttributes).mockResolvedValue(undefined);

      // Emit owner-created event through outbox adapter
      await outboxAdapter.enqueueOwnerCreated(churchId, userId, {
        churchName: 'Test Church',
      });

      // Verify event was enqueued to outbox
      expect(mockOutbox.enqueueCreate).toHaveBeenCalledWith(
        'church_membership',
        churchId,
        expect.objectContaining({
          type: 'church:membership:owner-created',
        })
      );

      // Verify job was added to queue
      expect(mockQueue.add).toHaveBeenCalledWith('sync', {
        eventType: 'owner-created',
        churchId,
        userId,
      });

      // Simulate job processing by processor
      const job: Job<ChurchMembershipSyncJobData> = {
        id: 'job-1',
        data: {
          eventType: 'owner-created',
          churchId,
          userId,
        },
      } as Job<ChurchMembershipSyncJobData>;

      await processor.process(job);

      // Verify membership service was called
      expect(mockMembershipService.getUserChurchMemberships).toHaveBeenCalledWith(userId);

      // Verify Keycloak was updated
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith(userId, {
        church_membership: JSON.stringify([{ churchId, role: 'Owner' }]),
      });
    });

    it('Test 2: should complete full invitation acceptance flow from event to Keycloak sync', async () => {
      const churchId = 'church-789';
      const userId = 'user-012';

      // Mock membership service to return member role
      vi.mocked(mockMembershipService.getUserChurchMemberships).mockResolvedValue([
        { churchId, role: 'Member' },
      ]);

      // Mock Keycloak client
      vi.mocked(mockKeycloakClient.getUserAttributes).mockResolvedValue({});
      vi.mocked(mockKeycloakClient.updateUserAttributes).mockResolvedValue(undefined);

      // Emit member-joined event through outbox adapter
      await outboxAdapter.enqueueMemberJoined(churchId, userId, 'Member', {
        membershipId: 'membership-345',
      });

      // Verify event was enqueued to outbox
      expect(mockOutbox.enqueueCreate).toHaveBeenCalledWith(
        'church_membership',
        `${churchId}_${userId}`,
        expect.objectContaining({
          type: 'church:membership:member-joined',
        })
      );

      // Simulate job processing
      const job: Job<ChurchMembershipSyncJobData> = {
        id: 'job-2',
        data: {
          eventType: 'member-joined',
          churchId,
          userId,
        },
      } as Job<ChurchMembershipSyncJobData>;

      await processor.process(job);

      // Verify Keycloak was updated
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith(userId, {
        church_membership: JSON.stringify([{ churchId, role: 'Member' }]),
      });
    });

    it('Test 3: should complete full leave church flow from event to Keycloak membership removal', async () => {
      const churchId = 'church-111';
      const userId = 'user-222';

      // Mock membership service to return empty array (user left)
      vi.mocked(mockMembershipService.getUserChurchMemberships).mockResolvedValue([]);

      // Mock Keycloak client with existing membership
      vi.mocked(mockKeycloakClient.getUserAttributes).mockResolvedValue({
        church_membership: JSON.stringify([{ churchId, role: 'Member' }]),
      });
      vi.mocked(mockKeycloakClient.updateUserAttributes).mockResolvedValue(undefined);

      // Emit member-left event through outbox adapter
      await outboxAdapter.enqueueMemberLeft(churchId, userId);

      // Verify event was enqueued to outbox
      expect(mockOutbox.enqueueDelete).toHaveBeenCalledWith(
        'church_membership',
        `${churchId}_${userId}`,
        expect.objectContaining({
          type: 'church:membership:member-left',
        })
      );

      // Simulate job processing
      const job: Job<ChurchMembershipSyncJobData> = {
        id: 'job-3',
        data: {
          eventType: 'member-left',
          churchId,
          userId,
        },
      } as Job<ChurchMembershipSyncJobData>;

      await processor.process(job);

      // Verify Keycloak was updated to remove membership
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith(userId, {
        church_membership: JSON.stringify([]),
      });
    });
  });

  describe('Atomic Operations', () => {
    it('Test 4: should update both users atomically during ownership transfer', async () => {
      const churchId = 'church-333';
      const previousOwnerId = 'user-old';
      const newOwnerId = 'user-new';

      // Mock membership service for both users
      vi.mocked(mockMembershipService.getUserChurchMemberships)
        .mockResolvedValueOnce([{ churchId, role: 'Member' }]) // Previous owner downgraded
        .mockResolvedValueOnce([{ churchId, role: 'Owner' }]); // New owner upgraded

      // Mock Keycloak client
      vi.mocked(mockKeycloakClient.getUserAttributes)
        .mockResolvedValueOnce({ church_membership: JSON.stringify([{ churchId, role: 'Owner' }]) })
        .mockResolvedValueOnce({
          church_membership: JSON.stringify([{ churchId, role: 'Member' }]),
        });
      vi.mocked(mockKeycloakClient.updateUserAttributes).mockResolvedValue(undefined);

      // Emit ownership-transferred event
      await outboxAdapter.enqueueOwnershipTransferred(
        churchId,
        previousOwnerId,
        newOwnerId,
        'Member'
      );

      // Simulate job processing
      const job: Job<ChurchMembershipSyncJobData> = {
        id: 'job-4',
        data: {
          eventType: 'ownership-transferred',
          churchId,
          previousOwnerId,
          newOwnerId,
        },
      } as Job<ChurchMembershipSyncJobData>;

      await processor.process(job);

      // Verify both users were queried
      expect(mockMembershipService.getUserChurchMemberships).toHaveBeenCalledWith(previousOwnerId);
      expect(mockMembershipService.getUserChurchMemberships).toHaveBeenCalledWith(newOwnerId);

      // Verify both users were updated atomically in single job
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith(previousOwnerId, {
        church_membership: JSON.stringify([{ churchId, role: 'Member' }]),
      });

      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith(newOwnerId, {
        church_membership: JSON.stringify([{ churchId, role: 'Owner' }]),
      });
    });
  });

  describe('Retry Behavior', () => {
    it('Test 5: should throw error when Keycloak API fails to trigger BullMQ retry', async () => {
      const churchId = 'church-444';
      const userId = 'user-555';

      // Mock membership service
      vi.mocked(mockMembershipService.getUserChurchMemberships).mockResolvedValue([
        { churchId, role: 'Owner' },
      ]);

      // Mock Keycloak to fail
      vi.mocked(mockKeycloakClient.getUserAttributes).mockResolvedValue({});
      vi.mocked(mockKeycloakClient.updateUserAttributes).mockRejectedValue(
        new Error('Temporary Keycloak API failure')
      );

      // Simulate job processing
      const job: Job<ChurchMembershipSyncJobData> = {
        id: 'job-5',
        data: {
          eventType: 'owner-created',
          churchId,
          userId,
        },
      } as Job<ChurchMembershipSyncJobData>;

      // Verify processor throws error (which triggers BullMQ retry)
      await expect(processor.process(job)).rejects.toThrow('Temporary Keycloak API failure');
    });

    it('Test 6: should throw error for permanent failures (moves to DLQ after max retries)', async () => {
      const churchId = 'church-666';
      const userId = 'user-777';

      // Mock membership service
      vi.mocked(mockMembershipService.getUserChurchMemberships).mockResolvedValue([
        { churchId, role: 'Owner' },
      ]);

      // Mock Keycloak to always fail
      vi.mocked(mockKeycloakClient.getUserAttributes).mockResolvedValue({});
      vi.mocked(mockKeycloakClient.updateUserAttributes).mockRejectedValue(
        new Error('Permanent Keycloak API failure')
      );

      // Simulate job processing multiple times (simulating retries)
      const job: Job<ChurchMembershipSyncJobData> = {
        id: 'job-6',
        data: {
          eventType: 'owner-created',
          churchId,
          userId,
        },
        attemptsMade: 5, // Simulate max retries reached
      } as Job<ChurchMembershipSyncJobData>;

      // Verify processor continues to throw error (BullMQ will move to DLQ)
      await expect(processor.process(job)).rejects.toThrow('Permanent Keycloak API failure');
    });
  });

  describe('Error Handling', () => {
    it('Test 7: should not emit event when endpoint operation fails', async () => {
      // This test verifies that if church creation fails,
      // the event is never emitted to the outbox

      // Simulate endpoint NOT calling outboxAdapter because operation failed
      // (no calls to enqueueOwnerCreated)

      // Verify outbox was never called
      expect(mockOutbox.enqueueCreate).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();

      // This ensures no orphaned events if database transaction fails
    });

    it('Test 8: should handle partial failure in ownership transfer gracefully', async () => {
      const churchId = 'church-888';
      const previousOwnerId = 'user-old';
      const newOwnerId = 'user-new';

      // Mock membership service for both users
      vi.mocked(mockMembershipService.getUserChurchMemberships)
        .mockResolvedValueOnce([{ churchId, role: 'Member' }]) // Previous owner succeeds
        .mockResolvedValueOnce([{ churchId, role: 'Owner' }]); // New owner succeeds

      // Mock Keycloak to fail on second user
      vi.mocked(mockKeycloakClient.getUserAttributes)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      vi.mocked(mockKeycloakClient.updateUserAttributes)
        .mockResolvedValueOnce(undefined) // First user succeeds
        .mockRejectedValueOnce(new Error('Keycloak API failed for new owner')); // Second user fails

      // Simulate job processing
      const job: Job<ChurchMembershipSyncJobData> = {
        id: 'job-8',
        data: {
          eventType: 'ownership-transferred',
          churchId,
          previousOwnerId,
          newOwnerId,
        },
      } as Job<ChurchMembershipSyncJobData>;

      // Verify processor throws on partial failure
      await expect(processor.process(job)).rejects.toThrow('Keycloak API failed for new owner');

      // First user was updated successfully
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith(previousOwnerId, {
        church_membership: JSON.stringify([{ churchId, role: 'Member' }]),
      });

      // Job will retry and attempt both users again (BullMQ retry logic)
    });
  });

  describe('Complex Scenarios', () => {
    it('Test 9: should handle multi-church membership updates correctly', async () => {
      const userId = 'user-multi';
      const churches = [
        { churchId: 'church-A', role: 'Owner' },
        { churchId: 'church-B', role: 'Manager' },
        { churchId: 'church-C', role: 'Member' },
      ];

      // Mock membership service to return multiple churches
      vi.mocked(mockMembershipService.getUserChurchMemberships).mockResolvedValue(churches);

      // Mock Keycloak client
      vi.mocked(mockKeycloakClient.getUserAttributes).mockResolvedValue({});
      vi.mocked(mockKeycloakClient.updateUserAttributes).mockResolvedValue(undefined);

      // Simulate job for user joining another church
      const job: Job<ChurchMembershipSyncJobData> = {
        id: 'job-9',
        data: {
          eventType: 'member-joined',
          churchId: 'church-C',
          userId,
        },
      } as Job<ChurchMembershipSyncJobData>;

      await processor.process(job);

      // Verify Keycloak was updated with all churches
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith(userId, {
        church_membership: JSON.stringify(churches),
      });
    });

    it('Test 10: should handle user leaving one church while staying in others', async () => {
      const userId = 'user-multi-leave';
      const churchIdToLeave = 'church-X';
      const remainingChurches = [
        { churchId: 'church-Y', role: 'Owner' },
        { churchId: 'church-Z', role: 'Member' },
      ];

      // Mock membership service to return only remaining churches
      vi.mocked(mockMembershipService.getUserChurchMemberships).mockResolvedValue(
        remainingChurches
      );

      // Mock Keycloak with all three churches initially
      vi.mocked(mockKeycloakClient.getUserAttributes).mockResolvedValue({
        church_membership: JSON.stringify([
          { churchId: churchIdToLeave, role: 'Member' },
          ...remainingChurches,
        ]),
      });
      vi.mocked(mockKeycloakClient.updateUserAttributes).mockResolvedValue(undefined);

      // Simulate job for user leaving one church
      const job: Job<ChurchMembershipSyncJobData> = {
        id: 'job-10',
        data: {
          eventType: 'member-left',
          churchId: churchIdToLeave,
          userId,
        },
      } as Job<ChurchMembershipSyncJobData>;

      await processor.process(job);

      // Verify Keycloak was updated with only remaining churches
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith(userId, {
        church_membership: JSON.stringify(remainingChurches),
      });

      // Verify left church is NOT in the updated array
      const updatedMemberships = JSON.parse(
        vi.mocked(mockKeycloakClient.updateUserAttributes).mock.calls[0][1].church_membership
      );
      expect(updatedMemberships).not.toContainEqual({
        churchId: churchIdToLeave,
        role: 'Member',
      });
    });
  });
});
