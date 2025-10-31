import dotenv from 'dotenv';
import {Worker} from 'bullmq';
import {getRawDb} from './utils/database';
import {logger} from './logging';
import {SyncProcessor} from './queues/sync.processor';
import {ChurchMembershipSyncJobName} from './queues/church-membership-sync.queue';
import type {ChurchMembershipSyncJobData} from './queues/church-membership-sync.types';
import {createHandlerRegistry} from './queues/handlers/registry-factory';
import {MembershipSyncService} from './queues/handlers/membership-sync.service';
import {OwnerCreatedHandler} from './queues/handlers/owner-created.handler';
import {MemberJoinedHandler} from './queues/handlers/member-joined.handler';
import {MemberLeftHandler} from './queues/handlers/member-left.handler';
import {OwnershipTransferredHandler} from './queues/handlers/ownership-transferred.handler';
import {PostgresChurchMemberRepository} from './churches/postgres-repository';
import {ChurchMembershipQueryService} from './churches/church-membership-query.service';
import {KeycloakAdminClientImpl, type KeycloakAdminConfig} from './keycloak/admin-client';

dotenv.config();

/**
 * Church Membership Sync Worker
 *
 * This worker processes church membership synchronization jobs from BullMQ.
 * It handles events like:
 * - owner-created: New church owner needs permissions
 * - member-joined: New member joined a church
 * - member-left: Member left a church
 * - ownership-transferred: Church ownership changed
 *
 * The worker syncs these changes to Keycloak user attributes for JWT claims.
 */

// Validate required environment variables
const {
  REDIS_URL,
  POSTGRES_DB: DB_NAME,
  POSTGRES_USER: DB_USER,
  POSTGRES_PASSWORD: DB_PASSWORD,
  DB_HOST,
  DB_PORT,
  IAM_ENDPOINT,
  IAM_REALM,
  KEYCLOAK_CLIENT_ID,
  KEYCLOAK_CLIENT_SECRET,
  NODE_ENV,
} = process.env;

if (NODE_ENV === 'production' && !REDIS_URL) {
  logger.error('REDIS_URL is required in production');
  throw new Error('REDIS_URL is required in production');
}

if (!IAM_ENDPOINT || !IAM_REALM || !KEYCLOAK_CLIENT_ID || !KEYCLOAK_CLIENT_SECRET) {
  logger.error('Keycloak configuration is incomplete');
  throw new Error('IAM_ENDPOINT, IAM_REALM, KEYCLOAK_CLIENT_ID, and KEYCLOAK_CLIENT_SECRET are required');
}

// Initialize database connection
const db = getRawDb({ DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT });

// Initialize Keycloak admin client
const keycloakConfig: KeycloakAdminConfig = {
  realm: IAM_REALM,
  keycloakUrl: IAM_ENDPOINT.replace('realms', ''),
  clientId: KEYCLOAK_CLIENT_ID,
  clientSecret: KEYCLOAK_CLIENT_SECRET,
};

const keycloakAdminClient = new KeycloakAdminClientImpl(keycloakConfig);

// Initialize church membership query service
const churchMemberRepository = new PostgresChurchMemberRepository(db);
const churchMembershipQueryService = new ChurchMembershipQueryService(churchMemberRepository);

// Initialize sync service
const syncService = new MembershipSyncService(
  churchMembershipQueryService,
  keycloakAdminClient
);

// Initialize handler registry with all event handlers
const handlers = [
  new OwnerCreatedHandler(syncService),
  new MemberJoinedHandler(syncService),
  new MemberLeftHandler(syncService),
  new OwnershipTransferredHandler(syncService),
];
const handlerRegistry = createHandlerRegistry(handlers);

// Initialize job processor
const churchMembershipSyncProcessor = new SyncProcessor<ChurchMembershipSyncJobData>(
  handlerRegistry,
  (data) => ({
    eventType: data.eventType,
    entityId: data.churchId,
  })
);

// Create BullMQ worker
const worker = new Worker<ChurchMembershipSyncJobData>(
  ChurchMembershipSyncJobName,
  async (job) => {
    await churchMembershipSyncProcessor.process(job);
  },
  {
    connection: REDIS_URL ? { url: REDIS_URL } : undefined,
    concurrency: 1, // Process one job at a time to avoid overwhelming Keycloak API
  }
);

// Worker event handlers
worker.on('completed', (job) => {
  logger.info(
    { jobId: job.id, eventType: job.data.eventType },
    'Job completed successfully'
  );
});

worker.on('failed', (job, error) => {
  logger.error(
    {
      jobId: job?.id,
      eventType: job?.data.eventType,
      error: error.message,
      attemptsMade: job?.attemptsMade,
    },
    'Job failed'
  );
});

worker.on('error', (error) => {
  logger.error({ error: error.message }, 'Worker error occurred');
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, 'Worker shutting down gracefully');

  try {
    await worker.close();
    logger.info('Worker closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Error during worker shutdown'
    );
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

logger.info(
  {
    queueName: ChurchMembershipSyncJobName,
    concurrency: 1,
    redisUrl: REDIS_URL ? '***configured***' : 'in-memory',
    handlerCount: handlerRegistry.getRegisteredEventTypes().length,
    eventTypes: handlerRegistry.getRegisteredEventTypes(),
  },
  'Church membership sync worker started'
);
