import { Worker } from 'bullmq';
import { logger } from '../../logging';
import { KeycloakOutboxJobName } from './queue';
import type { KeycloakOutboxJobData } from './types';
import { safeExecute } from '../../utils/handle-async';
import { WorkerEventHandlers } from '../../lib/queue/worker-factory';
import type { Outbox } from '../../outbox';

/**
 * Dependencies required to create the Keycloak outbox worker
 */
export interface KeycloakOutboxWorkerDeps {
  outbox: Outbox<any>;
  redisUrl?: string;
}

/**
 * Creates and configures the Keycloak outbox processing worker
 *
 * This worker processes Keycloak synchronization events from the outbox.
 * When a job is triggered, it calls outbox.processDue() to pull and publish
 * pending events to Keycloak.
 *
 * Features:
 * - Event-driven processing (triggered when events are enqueued)
 * - Automatic retries with exponential backoff
 * - Error logging and handling
 * - Graceful shutdown support
 *
 * @param deps - Dependencies including outbox instance and Redis connection
 * @returns Configured BullMQ worker instance
 */
export function createKeycloakOutboxWorker(
  deps: KeycloakOutboxWorkerDeps
): Worker<KeycloakOutboxJobData> {
  const { outbox, redisUrl } = deps;

  const worker = new Worker<KeycloakOutboxJobData>(
    KeycloakOutboxJobName,
    async (job) => {
      const { limit } = job.data;

      logger.debug(
        { jobId: job.id, limit },
        'Processing Keycloak outbox job'
      );

      // Use safeExecute to handle errors gracefully
      const [error] = await safeExecute(outbox.processDue(limit));

      if (error) {
        logger.error(
          { error: error.message, jobId: job.id },
          'Error processing Keycloak outbox events'
        );
        throw error; // Re-throw to trigger retry mechanism
      }

      logger.debug({ jobId: job.id }, 'Keycloak outbox job completed');
    },
    {
      connection: redisUrl ? { url: redisUrl } : undefined,
      concurrency: 1, // Process one job at a time to avoid conflicts
    }
  );

  // Attach standard event handlers for logging
  const eventHandlers = new WorkerEventHandlers<KeycloakOutboxJobData>(
    logger,
    (data) => ({
      jobId: undefined,
      triggeredAt: data.triggeredAt,
      limit: data.limit,
    })
  );
  eventHandlers.attachTo(worker);

  logger.info(
    {
      queueName: KeycloakOutboxJobName,
      concurrency: 1,
      redisUrl: redisUrl ? '***configured***' : 'in-memory',
    },
    'Keycloak outbox worker started'
  );

  return worker;
}
