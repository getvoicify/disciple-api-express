import type { IJobEventHandler } from './job-event-handler.interface';
import { logger } from '../../logging';

/**
 * Registry for job event handlers
 * Allows dynamic registration and lookup of handlers by event type
 */
export class JobHandlerRegistry<T> {
  private handlers = new Map<string, IJobEventHandler<T>>();

  /**
   * Register an event handler
   * @param handler - The handler to register
   */
  register(handler: IJobEventHandler<T>): void {
    if (this.handlers.has(handler.eventType)) {
      logger.warn(
        { eventType: handler.eventType },
        'Overwriting existing handler for event type'
      );
    }

    this.handlers.set(handler.eventType, handler);
    logger.debug({ eventType: handler.eventType }, 'Registered event handler');
  }

  /**
   * Get a handler for a specific event type
   * @param eventType - The event type to get a handler for
   * @returns The registered handler
   * @throws Error if no handler is registered for the event type
   */
  getHandler(eventType: string): IJobEventHandler<T> {
    const handler = this.handlers.get(eventType);

    if (!handler) {
      throw new Error(`No handler registered for event type: ${eventType}`);
    }

    return handler;
  }

  /**
   * Check if a handler is registered for an event type
   * @param eventType - The event type to check
   */
  hasHandler(eventType: string): boolean {
    return this.handlers.has(eventType);
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
