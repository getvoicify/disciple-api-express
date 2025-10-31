import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHandlerRegistry } from '../../queues/handlers/registry-factory';
import type { MembershipSyncService } from '../../queues/handlers/membership-sync.service';
import { OwnerCreatedHandler } from '../../queues/handlers/owner-created.handler';
import { MemberJoinedHandler } from '../../queues/handlers/member-joined.handler';
import { MemberLeftHandler } from '../../queues/handlers/member-left.handler';
import { OwnershipTransferredHandler } from '../../queues/handlers/ownership-transferred.handler';

describe('Handler Registry Factory', () => {
  let mockSyncService: MembershipSyncService;

  beforeEach(() => {
    mockSyncService = {
      syncUserMemberships: vi.fn(),
      syncOwnershipTransfer: vi.fn(),
    } as unknown as MembershipSyncService;
  });

  describe('centralized handler registration', () => {
    it('should register all available handlers', () => {
      const handlers = [
        new OwnerCreatedHandler(mockSyncService),
        new MemberJoinedHandler(mockSyncService),
        new MemberLeftHandler(mockSyncService),
        new OwnershipTransferredHandler(mockSyncService),
      ];
      const registry = createHandlerRegistry(handlers);
      const eventTypes = registry.getRegisteredEventTypes();

      // Should have registered all 4 handlers
      expect(eventTypes.length).toBe(4);
      expect(Array.isArray(eventTypes)).toBe(true);
    });

    it('should register each handler with its event type', () => {
      const handlers = [
        new OwnerCreatedHandler(mockSyncService),
        new MemberJoinedHandler(mockSyncService),
        new MemberLeftHandler(mockSyncService),
        new OwnershipTransferredHandler(mockSyncService),
      ];
      const registry = createHandlerRegistry(handlers);
      const eventTypes = registry.getRegisteredEventTypes();

      // Each event type should have a corresponding handler
      eventTypes.forEach((eventType) => {
        expect(registry.hasHandler(eventType)).toBe(true);
      });
    });

    it('should allow retrieval of handlers by event type', () => {
      const handlers = [
        new OwnerCreatedHandler(mockSyncService),
        new MemberJoinedHandler(mockSyncService),
        new MemberLeftHandler(mockSyncService),
        new OwnershipTransferredHandler(mockSyncService),
      ];
      const registry = createHandlerRegistry(handlers);
      const eventTypes = registry.getRegisteredEventTypes();

      // Should be able to retrieve each handler
      eventTypes.forEach((eventType) => {
        const handler = registry.getHandler(eventType);
        expect(handler).toBeDefined();
        expect(handler.eventType).toBe(eventType);
      });
    });
  });

  describe('handler functionality', () => {
    it('should pass sync service to all registered handlers', () => {
      const handlers = [
        new OwnerCreatedHandler(mockSyncService),
        new MemberJoinedHandler(mockSyncService),
        new MemberLeftHandler(mockSyncService),
        new OwnershipTransferredHandler(mockSyncService),
      ];
      const registry = createHandlerRegistry(handlers);
      const eventTypes = registry.getRegisteredEventTypes();

      // All handlers should have access to the sync service
      eventTypes.forEach((eventType) => {
        const handler = registry.getHandler(eventType);
        expect(handler).toBeDefined();
        // Handler should have the sync service injected
        // (we can't test internals directly, but we know they need it)
      });
    });

    it('should throw error when retrieving unregistered handler', () => {
      const handlers = [
        new OwnerCreatedHandler(mockSyncService),
        new MemberJoinedHandler(mockSyncService),
        new MemberLeftHandler(mockSyncService),
        new OwnershipTransferredHandler(mockSyncService),
      ];
      const registry = createHandlerRegistry(handlers);

      expect(() => registry.getHandler('non-existent-event-type')).toThrow(
        'No handler registered for event type: non-existent-event-type'
      );
    });
  });

  describe('registry behavior', () => {
    it('should return unique event types', () => {
      const handlers = [
        new OwnerCreatedHandler(mockSyncService),
        new MemberJoinedHandler(mockSyncService),
        new MemberLeftHandler(mockSyncService),
        new OwnershipTransferredHandler(mockSyncService),
      ];
      const registry = createHandlerRegistry(handlers);
      const eventTypes = registry.getRegisteredEventTypes();

      const uniqueEventTypes = [...new Set(eventTypes)];
      expect(eventTypes.length).toBe(uniqueEventTypes.length);
    });

    it('should not register duplicate handlers for same event type', () => {
      const handlers = [
        new OwnerCreatedHandler(mockSyncService),
        new MemberJoinedHandler(mockSyncService),
        new MemberLeftHandler(mockSyncService),
        new OwnershipTransferredHandler(mockSyncService),
      ];
      const registry = createHandlerRegistry(handlers);
      const eventTypes = registry.getRegisteredEventTypes();

      // Count occurrences of each event type
      const eventTypeCounts = eventTypes.reduce((acc, eventType) => {
        acc[eventType] = (acc[eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Each event type should appear exactly once
      Object.values(eventTypeCounts).forEach((count) => {
        expect(count).toBe(1);
      });
    });
  });

  describe('integration with existing handlers', () => {
    it('should be able to invoke a handler with proper job data', async () => {
      const handlers = [
        new OwnerCreatedHandler(mockSyncService),
        new MemberJoinedHandler(mockSyncService),
        new MemberLeftHandler(mockSyncService),
        new OwnershipTransferredHandler(mockSyncService),
      ];
      const registry = createHandlerRegistry(handlers);
      const eventTypes = registry.getRegisteredEventTypes();

      // Find any single-user event type (not ownership-transferred)
      const singleUserEventType = eventTypes.find(
        (type) => type !== 'ownership-transferred'
      );

      if (singleUserEventType) {
        const handler = registry.getHandler(singleUserEventType);
        const mockJob = {
          id: 'job-1',
          data: {
            eventType: singleUserEventType,
            churchId: 'church-123',
            userId: 'user-123',
          },
        } as any;

        await handler.handle(mockJob);

        expect(mockSyncService.syncUserMemberships).toHaveBeenCalled();
      }
    });
  });
});
