import { Queue } from 'bullmq';
import type { QueueOptions } from 'bullmq';
import type { KeycloakOutboxJobData } from './types';
import { logger } from '../../logging';

export const KeycloakOutboxJobName = 'keycloak-outbox';

/**
 * Fixed job ID for deduplication - ensures only one processing job runs at a time
 * This prevents concurrent processing of the outbox which could cause race conditions
 */
const OUTBOX_PROCESS_JOB_ID = 'keycloak-outbox-process';

/**
 * Default retry configuration for Keycloak outbox processing jobs
 * - 5 attempts total
 * - 1 second initial delay
 * - Exponential backoff
 */
const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 1000, // 1 second initial delay
  },
};

/**
 * Creates a BullMQ queue for Keycloak outbox processing jobs
 * @param config Queue configuration options (connection required in production)
 * @returns Configured Queue instance
 */
export function createKeycloakOutboxQueue(
  config?: Partial<QueueOptions>
): Queue<KeycloakOutboxJobData> {
  const queueOptions: Partial<QueueOptions> = {
    ...config,
    defaultJobOptions,
  };

  const queue = new Queue<KeycloakOutboxJobData>(
    KeycloakOutboxJobName,
    queueOptions as QueueOptions
  );

  // Log queue events
  queue.on('error', (error: Error) => {
    logger.error({ error: error.message }, 'Keycloak outbox queue error');
  });

  queue.on('waiting', ({ id }) => {
    logger.debug({ jobId: id }, 'Job waiting in queue');
  });

  logger.info({ queueName: KeycloakOutboxJobName }, 'Keycloak outbox queue created');

  return queue;
}

/**
 * Helper to enqueue a Keycloak outbox processing job
 * Uses a fixed jobId to implement job deduplication - only one processing job can be pending at a time
 * This prevents concurrent processing and ensures orderly event handling
 *
 * @param queue The queue instance
 * @param limit Optional limit on number of events to process (defaults to outbox's limit)
 * @returns Promise resolving to the created/existing job
 */
export async function enqueueOutboxProcessing(
  queue: Queue<KeycloakOutboxJobData>,
  limit?: number
): Promise<any> {
  const data: KeycloakOutboxJobData = {
    triggeredAt: Date.now(),
    limit,
  };

  const job = await queue.add('process-outbox', data, {
    jobId: OUTBOX_PROCESS_JOB_ID,
  });

  logger.debug(
    { jobId: job.id, limit },
    'Keycloak outbox processing job enqueued'
  );

  return job;
}
