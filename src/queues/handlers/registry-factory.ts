import { ChurchMembershipHandlerRegistry } from './handler-registry';
import { OwnerCreatedHandler } from './owner-created.handler';
import { MemberJoinedHandler } from './member-joined.handler';
import { MemberLeftHandler } from './member-left.handler';
import { OwnershipTransferredHandler } from './ownership-transferred.handler';
import type { MembershipSyncService } from './membership-sync.service';
import { logger } from '../../logging';

/**
 * Creates and configures the handler registry with all available event handlers
 *
 * This factory function provides a centralized location for handler registration.
 * To add a new handler:
 * 1. Create a new file implementing IChurchMembershipEventHandler
 * 2. Import it in this file
 * 3. Add it to the handlers array
 *
 * The explicit import approach ensures:
 * - Type safety at compile time
 * - No runtime file system dependencies
 * - Works correctly in all environments (test, dev, prod)
 * - Clear visibility of all registered handlers
 *
 * @param syncService - The membership sync service used by handlers
 * @returns Configured handler registry with all handlers registered
 */
export function createHandlerRegistry(
  syncService: MembershipSyncService
): ChurchMembershipHandlerRegistry {
  const registry = new ChurchMembershipHandlerRegistry();

  // Register all event handlers
  // To add a new handler, import it above and add it to this array
  const handlers = [
    new OwnerCreatedHandler(syncService),
    new MemberJoinedHandler(syncService),
    new MemberLeftHandler(syncService),
    new OwnershipTransferredHandler(syncService),
  ];

  handlers.forEach((handler) => {
    registry.register(handler);
  });

  logger.info(
    {
      handlerCount: handlers.length,
      eventTypes: handlers.map((h) => h.eventType),
    },
    'Handler registry initialized with all event handlers'
  );

  return registry;
}
