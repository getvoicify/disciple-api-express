import { JobHandlerRegistry } from './handler-registry';
import type { IJobEventHandler } from './job-event-handler.interface';
import { logger } from '../../logging';

/**
 * Creates and configures a generic handler registry with the provided event handlers
 *
 * This factory function provides a centralized, reusable way to create handler registries
 * for any queue type. It accepts an array of handlers and registers them all.
 *
 * The generic approach ensures:
 * - Type safety at compile time
 * - Reusability across different queue types
 * - Works correctly in all environments (test, dev, prod)
 * - Clear visibility of all registered handlers
 *
 * @template T - The job data type that handlers will process
 * @param handlers - Array of event handlers to register
 * @returns Configured handler registry with all handlers registered
 *
 * @example
 * ```typescript
 * const handlers = [
 *   new OwnerCreatedHandler(syncService),
 *   new MemberJoinedHandler(syncService),
 * ];
 * const registry = createHandlerRegistry(handlers);
 * ```
 */
export function createHandlerRegistry<T>(
  handlers: IJobEventHandler<T>[]
): JobHandlerRegistry<T> {
  const registry = new JobHandlerRegistry<T>();

  handlers.forEach((handler) => {
    registry.register(handler);
  });

  logger.info(
    {
      handlerCount: handlers.length,
      eventTypes: handlers.map((h) => h.eventType),
    },
    'Handler registry initialized with event handlers'
  );

  return registry;
}
