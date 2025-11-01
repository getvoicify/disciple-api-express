import dotenv from 'dotenv';
import { getRawDb } from './utils/database';
import { logger } from './logging';
import { WorkerShutdownManager } from './lib/queue/worker-factory';
import { createChurchMembershipSyncWorker } from './queues/church-membership-sync/worker';
import type { KeycloakAdminConfig } from './keycloak/admin-client';

dotenv.config();

/**
 * Main Worker Orchestrator
 *
 * This is the entry point for all background job workers. It:
 * - Initializes shared dependencies (database, Redis)
 * - Creates and starts all queue-specific workers
 * - Manages graceful shutdown coordination
 *
 * To add a new queue:
 * 1. Create a worker file in src/queues/<feature>/worker.ts
 * 2. Export a factory function: createXxxWorker(deps)
 * 3. Import and initialize it here
 */

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

const db = getRawDb({ DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT });

const shutdownManager = new WorkerShutdownManager(logger);
shutdownManager.setupSignalHandlers();

if (IAM_ENDPOINT && IAM_REALM && KEYCLOAK_CLIENT_ID && KEYCLOAK_CLIENT_SECRET) {
  const keycloakConfig: KeycloakAdminConfig = {
    realm: IAM_REALM,
    keycloakUrl: IAM_ENDPOINT.replace('realms', ''),
    clientId: KEYCLOAK_CLIENT_ID,
    clientSecret: KEYCLOAK_CLIENT_SECRET,
  };

  const churchMembershipSyncWorker = createChurchMembershipSyncWorker({
    db,
    redisUrl: REDIS_URL,
    keycloakConfig,
  });

  shutdownManager.register(churchMembershipSyncWorker);
} else {
  logger.warn(
    'Keycloak configuration incomplete - church membership sync worker not started'
  );
}

logger.info(
  {
    redisUrl: REDIS_URL ? '***configured***' : 'in-memory',
    environment: NODE_ENV,
  },
  'Worker orchestrator initialized'
);
