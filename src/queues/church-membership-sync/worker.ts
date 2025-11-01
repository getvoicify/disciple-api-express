import { Worker } from 'bullmq';
import type postgres from 'postgres';
import { logger } from '../../logging';
import { SyncProcessor } from '../../lib/queue/processor';
import { ChurchMembershipSyncJobName } from './queue';
import type { ChurchMembershipSyncJobData } from './types';
import { createHandlerRegistry } from '../../lib/queue/registry-factory';
import { MembershipSyncService } from './handlers/membership-sync.service';
import { OwnerCreatedHandler } from './handlers/owner-created.handler';
import { MemberJoinedHandler } from './handlers/member-joined.handler';
import { MemberLeftHandler } from './handlers/member-left.handler';
import { OwnershipTransferredHandler } from './handlers/ownership-transferred.handler';
import { PostgresChurchMemberRepository } from '../../churches/postgres-repository';
import { ChurchMembershipQueryService } from '../../churches/church-membership-query.service';
import { KeycloakAdminClientImpl, type KeycloakAdminConfig } from '../../keycloak/admin-client';
import { WorkerEventHandlers } from '../../lib/queue/worker-factory';

/**
 * Dependencies required to create the church membership sync worker
 */
export interface ChurchMembershipSyncWorkerDeps {
  db: postgres.Sql;
  redisUrl?: string;
  keycloakConfig: KeycloakAdminConfig;
}

/**
 * Validates that all required Keycloak environment variables are present
 */
function validateKeycloakConfig(config: Partial<KeycloakAdminConfig>): asserts config is KeycloakAdminConfig {
  if (!config.keycloakUrl || !config.realm || !config.clientId || !config.clientSecret) {
    logger.error('Keycloak configuration is incomplete');
    throw new Error('keycloakUrl, realm, clientId, and clientSecret are required for church membership sync');
  }
}

/**
 * Creates and configures the church membership sync worker
 *
 * This worker processes church membership synchronization jobs from BullMQ.
 * It handles events like:
 * - owner-created: New church owner needs permissions
 * - member-joined: New member joined a church
 * - member-left: Member left a church
 * - ownership-transferred: Church ownership changed
 *
 * The worker syncs these changes to Keycloak user attributes for JWT claims.
 *
 * @param deps - Dependencies including database connection and Keycloak config
 * @returns Configured BullMQ worker instance
 */
export function createChurchMembershipSyncWorker(
  deps: ChurchMembershipSyncWorkerDeps
): Worker<ChurchMembershipSyncJobData> {
  const { db, redisUrl, keycloakConfig } = deps;

  validateKeycloakConfig(keycloakConfig);

  const keycloakAdminClient = new KeycloakAdminClientImpl(keycloakConfig);

  const churchMemberRepository = new PostgresChurchMemberRepository(db);
  const churchMembershipQueryService = new ChurchMembershipQueryService(churchMemberRepository);

  const syncService = new MembershipSyncService(churchMembershipQueryService, keycloakAdminClient);

  const handlers = [
    new OwnerCreatedHandler(syncService),
    new MemberJoinedHandler(syncService),
    new MemberLeftHandler(syncService),
    new OwnershipTransferredHandler(syncService),
  ];
  const handlerRegistry = createHandlerRegistry(handlers);

  const churchMembershipSyncProcessor = new SyncProcessor<ChurchMembershipSyncJobData>(handlerRegistry, (data) => ({
    eventType: data.eventType,
    entityId: data.churchId,
  }));

  const worker = new Worker<ChurchMembershipSyncJobData>(
    ChurchMembershipSyncJobName,
    async (job) => {
      await churchMembershipSyncProcessor.process(job);
    },
    {
      connection: redisUrl ? { url: redisUrl } : undefined,
      concurrency: 1,
    }
  );

  const eventHandlers = new WorkerEventHandlers<ChurchMembershipSyncJobData>(
    logger,
    (data) => ({
      jobId: undefined,
      eventType: data.eventType,
    })
  );
  eventHandlers.attachTo(worker);

  logger.info(
    {
      queueName: ChurchMembershipSyncJobName,
      concurrency: 1,
      redisUrl: redisUrl ? '***configured***' : 'in-memory',
      handlerCount: handlerRegistry.getRegisteredEventTypes().length,
      eventTypes: handlerRegistry.getRegisteredEventTypes(),
    },
    'Church membership sync worker started'
  );

  return worker;
}
