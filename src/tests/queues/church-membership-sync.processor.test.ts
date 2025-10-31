import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncProcessor } from '../../queues/sync.processor';
import { JobHandlerRegistry } from '../../queues/handlers/handler-registry';
import { MembershipSyncService } from '../../queues/handlers/membership-sync.service';
import { OwnerCreatedHandler } from '../../queues/handlers/owner-created.handler';
import { MemberJoinedHandler } from '../../queues/handlers/member-joined.handler';
import { MemberLeftHandler } from '../../queues/handlers/member-left.handler';
import { OwnershipTransferredHandler } from '../../queues/handlers/ownership-transferred.handler';
import type { IChurchMembershipQueryService } from '../../churches/church-membership-query.service';
import type { KeycloakAdminClient } from '../../keycloak/types';
import type { Job } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../../queues/church-membership-sync.types';

// Mock services
const createMockMembershipService = () => ({
  getUserChurchMemberships: vi.fn(),
});

const createMockKeycloakClient = () => ({
  getUserAttributes: vi.fn(),
  updateUserAttributes: vi.fn(),
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  getResourcesByIds: vi.fn(),
  getUserPermissions: vi.fn(),
});

describe('ChurchMembershipSyncProcessor', () => {
  let mockMembershipService: ReturnType<typeof createMockMembershipService>;
  let mockKeycloakClient: ReturnType<typeof createMockKeycloakClient>;
  let syncService: MembershipSyncService;
  let handlerRegistry: JobHandlerRegistry<ChurchMembershipSyncJobData>;
  let processor: SyncProcessor<ChurchMembershipSyncJobData>;

  beforeEach(() => {
    mockMembershipService = createMockMembershipService();
    mockKeycloakClient = createMockKeycloakClient();

    syncService = new MembershipSyncService(
      mockMembershipService as unknown as IChurchMembershipQueryService,
      mockKeycloakClient as unknown as KeycloakAdminClient
    );

    const handlers = [
      new OwnerCreatedHandler(syncService),
      new MemberJoinedHandler(syncService),
      new MemberLeftHandler(syncService),
      new OwnershipTransferredHandler(syncService),
    ];
    handlerRegistry = new JobHandlerRegistry<ChurchMembershipSyncJobData>();
    handlers.forEach(handler => handlerRegistry.register(handler));

    processor = new SyncProcessor<ChurchMembershipSyncJobData>(
      handlerRegistry,
      (data) => ({
        eventType: data.eventType,
        entityId: data.churchId,
      })
    );
  });

  describe('processOwnerCreatedEvent', () => {
    it('should sync user church membership when owner is created', async () => {
      const jobData: ChurchMembershipSyncJobData = {
        eventType: 'owner-created',
        churchId: 'church-123',
        userId: 'user-123',
      };

      const job = {
        id: 'job-1',
        data: jobData,
      } as Job<ChurchMembershipSyncJobData>;

      mockMembershipService.getUserChurchMemberships.mockResolvedValue([
        { churchId: 'church-123', role: 'Owner' },
      ]);

      mockKeycloakClient.getUserAttributes.mockResolvedValue({});

      await processor.process(job);

      expect(mockMembershipService.getUserChurchMemberships).toHaveBeenCalledWith('user-123');
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith('user-123', {
        church_membership: JSON.stringify([{ churchId: 'church-123', role: 'Owner' }]),
      });
    });

    it('should handle users with existing church memberships', async () => {
      const jobData: ChurchMembershipSyncJobData = {
        eventType: 'owner-created',
        churchId: 'church-123',
        userId: 'user-123',
      };

      const job = {
        id: 'job-1',
        data: jobData,
      } as Job<ChurchMembershipSyncJobData>;

      mockMembershipService.getUserChurchMemberships.mockResolvedValue([
        { churchId: 'church-456', role: 'Member' },
        { churchId: 'church-123', role: 'Owner' },
      ]);

      mockKeycloakClient.getUserAttributes.mockResolvedValue({
        church_membership: JSON.stringify([{ churchId: 'church-456', role: 'Member' }]),
      });

      await processor.process(job);

      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith('user-123', {
        church_membership: JSON.stringify([
          { churchId: 'church-456', role: 'Member' },
          { churchId: 'church-123', role: 'Owner' },
        ]),
      });
    });
  });

  describe('processMemberJoinedEvent', () => {
    it('should sync user church membership when member joins', async () => {
      const jobData: ChurchMembershipSyncJobData = {
        eventType: 'member-joined',
        churchId: 'church-123',
        userId: 'user-456',
      };

      const job = {
        id: 'job-2',
        data: jobData,
      } as Job<ChurchMembershipSyncJobData>;

      mockMembershipService.getUserChurchMemberships.mockResolvedValue([
        { churchId: 'church-123', role: 'Member' },
      ]);

      mockKeycloakClient.getUserAttributes.mockResolvedValue({});

      await processor.process(job);

      expect(mockMembershipService.getUserChurchMemberships).toHaveBeenCalledWith('user-456');
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith('user-456', {
        church_membership: JSON.stringify([{ churchId: 'church-123', role: 'Member' }]),
      });
    });
  });

  describe('processMemberLeftEvent', () => {
    it('should remove church membership when member leaves', async () => {
      const jobData: ChurchMembershipSyncJobData = {
        eventType: 'member-left',
        churchId: 'church-123',
        userId: 'user-789',
      };

      const job = {
        id: 'job-3',
        data: jobData,
      } as Job<ChurchMembershipSyncJobData>;

      mockMembershipService.getUserChurchMemberships.mockResolvedValue([]);

      mockKeycloakClient.getUserAttributes.mockResolvedValue({
        church_membership: JSON.stringify([{ churchId: 'church-123', role: 'Member' }]),
      });

      await processor.process(job);

      expect(mockMembershipService.getUserChurchMemberships).toHaveBeenCalledWith('user-789');
      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith('user-789', {
        church_membership: JSON.stringify([]),
      });
    });

    it('should handle user with multiple churches leaving one', async () => {
      const jobData: ChurchMembershipSyncJobData = {
        eventType: 'member-left',
        churchId: 'church-123',
        userId: 'user-789',
      };

      const job = {
        id: 'job-3',
        data: jobData,
      } as Job<ChurchMembershipSyncJobData>;

      mockMembershipService.getUserChurchMemberships.mockResolvedValue([
        { churchId: 'church-456', role: 'Owner' },
      ]);

      mockKeycloakClient.getUserAttributes.mockResolvedValue({
        church_membership: JSON.stringify([
          { churchId: 'church-123', role: 'Member' },
          { churchId: 'church-456', role: 'Owner' },
        ]),
      });

      await processor.process(job);

      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith('user-789', {
        church_membership: JSON.stringify([{ churchId: 'church-456', role: 'Owner' }]),
      });
    });
  });

  describe('processOwnershipTransferredEvent', () => {
    it('should update both users during ownership transfer', async () => {
      const jobData: ChurchMembershipSyncJobData = {
        eventType: 'ownership-transferred',
        churchId: 'church-123',
        previousOwnerId: 'user-old',
        newOwnerId: 'user-new',
      };

      const job = {
        id: 'job-4',
        data: jobData,
      } as Job<ChurchMembershipSyncJobData>;

      mockMembershipService.getUserChurchMemberships
        .mockResolvedValueOnce([{ churchId: 'church-123', role: 'Member' }])
        .mockResolvedValueOnce([{ churchId: 'church-123', role: 'Owner' }]);

      mockKeycloakClient.getUserAttributes
        .mockResolvedValueOnce({
          church_membership: JSON.stringify([{ churchId: 'church-123', role: 'Owner' }]),
        })
        .mockResolvedValueOnce({
          church_membership: JSON.stringify([{ churchId: 'church-123', role: 'Member' }]),
        });

      await processor.process(job);

      expect(mockMembershipService.getUserChurchMemberships).toHaveBeenCalledWith('user-old');
      expect(mockMembershipService.getUserChurchMemberships).toHaveBeenCalledWith('user-new');

      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith('user-old', {
        church_membership: JSON.stringify([{ churchId: 'church-123', role: 'Member' }]),
      });

      expect(mockKeycloakClient.updateUserAttributes).toHaveBeenCalledWith('user-new', {
        church_membership: JSON.stringify([{ churchId: 'church-123', role: 'Owner' }]),
      });
    });
  });

  describe('error handling', () => {
    it('should throw error on Keycloak API failure to trigger retry', async () => {
      const jobData: ChurchMembershipSyncJobData = {
        eventType: 'owner-created',
        churchId: 'church-123',
        userId: 'user-123',
      };

      const job = {
        id: 'job-5',
        data: jobData,
      } as Job<ChurchMembershipSyncJobData>;

      mockMembershipService.getUserChurchMemberships.mockResolvedValue([
        { churchId: 'church-123', role: 'Owner' },
      ]);

      mockKeycloakClient.getUserAttributes.mockResolvedValue({});
      mockKeycloakClient.updateUserAttributes.mockRejectedValue(
        new Error('Keycloak API unavailable')
      );

      await expect(processor.process(job)).rejects.toThrow('Keycloak API unavailable');
    });

    it('should throw on UserNotFoundError (graceful error in handler)', async () => {
      const jobData: ChurchMembershipSyncJobData = {
        eventType: 'owner-created',
        churchId: 'church-123',
        userId: 'user-123',
      };

      const job = {
        id: 'job-6',
        data: jobData,
      } as Job<ChurchMembershipSyncJobData>;

      const userNotFoundError = new Error('User not found');
      userNotFoundError.name = 'UserNotFoundError';

      mockMembershipService.getUserChurchMemberships.mockResolvedValue([
        { churchId: 'church-123', role: 'Owner' },
      ]);

      mockKeycloakClient.getUserAttributes.mockRejectedValue(userNotFoundError);

      await expect(processor.process(job)).rejects.toThrow('User not found');

      expect(mockKeycloakClient.updateUserAttributes).not.toHaveBeenCalled();
    });

    it('should throw error when membership query fails', async () => {
      const jobData: ChurchMembershipSyncJobData = {
        eventType: 'owner-created',
        churchId: 'church-123',
        userId: 'user-123',
      };

      const job = {
        id: 'job-7',
        data: jobData,
      } as Job<ChurchMembershipSyncJobData>;

      mockMembershipService.getUserChurchMemberships.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(processor.process(job)).rejects.toThrow('Database connection failed');
    });

    it('should throw error for unsupported event type', async () => {
      const jobData = {
        eventType: 'unsupported-event',
        churchId: 'church-123',
        userId: 'user-123',
      } as unknown as ChurchMembershipSyncJobData;

      const job = {
        id: 'job-8',
        data: jobData,
      } as Job<ChurchMembershipSyncJobData>;

      await expect(processor.process(job)).rejects.toThrow(
        'No handler registered for event type: unsupported-event'
      );
    });
  });

  describe('handler registry', () => {
    it('should have all event handlers registered', () => {
      expect(handlerRegistry.hasHandler('owner-created')).toBe(true);
      expect(handlerRegistry.hasHandler('member-joined')).toBe(true);
      expect(handlerRegistry.hasHandler('member-left')).toBe(true);
      expect(handlerRegistry.hasHandler('ownership-transferred')).toBe(true);
    });

    it('should return correct event types', () => {
      const eventTypes = handlerRegistry.getRegisteredEventTypes();
      expect(eventTypes).toContain('owner-created');
      expect(eventTypes).toContain('member-joined');
      expect(eventTypes).toContain('member-left');
      expect(eventTypes).toContain('ownership-transferred');
    });
  });
});
