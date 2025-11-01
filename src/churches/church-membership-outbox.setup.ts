import type { RawDb } from '../utils/database';
import { PostgresOutboxStore } from '../outbox/postgres-store';
import { createOutbox } from '../outbox';
import { ChurchMembershipOutboxAdapter } from './church-membership-outbox.adapter';
import type { ChurchMembershipOutboxEvent } from './church-membership-events';
import { ChurchMembershipOutboxPublisher } from './church-membership-outbox.publisher';
import type { Queue } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../queues/church-membership-sync/types';
import * as crypto from 'node:crypto';

/**
 * Sets up the church membership outbox adapter with all required dependencies
 * @param db Database connection
 * @param syncQueue BullMQ queue for church membership sync jobs
 * @returns Configured church membership outbox adapter
 */
export function setupChurchMembershipOutboxAdapter(
  db: RawDb,
  syncQueue: Queue<ChurchMembershipSyncJobData>
) {
  const publisher = new ChurchMembershipOutboxPublisher(syncQueue);
  const store = new PostgresOutboxStore<ChurchMembershipOutboxEvent>(db);

  const outbox = createOutbox<ChurchMembershipOutboxEvent>({
    store,
    publisher,
    idFactory: () => crypto.randomUUID(),
    retry: {
      maxAttempts: 5,
      backoffStrategy: 'exponential',
      initialDelayMs: 1000,
      maxDelayMs: 60000,
    },
  });

  return new ChurchMembershipOutboxAdapter(outbox, syncQueue);
}
