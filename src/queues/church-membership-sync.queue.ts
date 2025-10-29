import { Queue } from 'bullmq';
import type { QueueOptions } from 'bullmq';
import type { ChurchMembershipSyncJobData } from './church-membership-sync.types';
import { logger } from '../logging';

export const ChurchMembershipSyncJobName = 'church-membership-sync';

/**
 * Default retry configuration for church membership sync jobs
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
 * Creates a BullMQ queue for church membership sync jobs
 * @param config Queue configuration options (connection required in production)
 * @returns Configured Queue instance
 */
export function createChurchMembershipSyncQueue(
  config?: Partial<QueueOptions>
): Queue<ChurchMembershipSyncJobData> {
  const queueOptions: Partial<QueueOptions> = {
    ...config,
    defaultJobOptions,
  };

  const queue = new Queue<ChurchMembershipSyncJobData>(
    ChurchMembershipSyncJobName,
    queueOptions as QueueOptions
  );

  // Log queue events
  queue.on('error', (error: Error) => {
    logger.error({ error: error.message }, 'Church membership sync queue error');
  });

  queue.on('waiting', ({ id }) => {
    logger.debug({ jobId: id }, 'Job waiting in queue');
  });

  logger.info({ queueName: ChurchMembershipSyncJobName }, 'Church membership sync queue created');

  return queue;
}

/**
 * Helper to enqueue a church membership sync job
 */
export async function enqueueChurchMembershipSync(
  queue: Queue<ChurchMembershipSyncJobData>,
  data: ChurchMembershipSyncJobData
): Promise<void> {
  await queue.add('sync', data);
  logger.info(
    { eventType: data.eventType, churchId: data.churchId },
    'Church membership sync job enqueued'
  );
}
