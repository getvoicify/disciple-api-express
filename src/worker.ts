import dotenv from 'dotenv';
import { getRawDb } from './utils/database';
import { logger } from './logging';
import { WorkerShutdownManager } from './lib/queue/worker-factory';
import { WorkerLoader } from './lib/queue/worker-loader';

dotenv.config();

/**
 * Main Worker Orchestrator
 *
 * This is the entry point for all background job workers. It:
 * - Initializes shared dependencies (database, Redis)
 * - Automatically discovers and loads all queue workers
 * - Manages graceful shutdown coordination
 *
 * To add a new queue worker:
 * 1. Create src/queues/<feature>/worker.ts with createXxxWorker() factory
 * 2. Create src/queues/<feature>/worker.config.ts exporting workerConfig
 * 3. The WorkerLoader will automatically discover and load it
 */

const {
  REDIS_URL,
  POSTGRES_DB: DB_NAME,
  POSTGRES_USER: DB_USER,
  POSTGRES_PASSWORD: DB_PASSWORD,
  DB_HOST,
  DB_PORT,
  NODE_ENV,
} = process.env;

if (NODE_ENV === 'production' && !REDIS_URL) {
  logger.error('REDIS_URL is required in production');
  throw new Error('REDIS_URL is required in production');
}

const db = getRawDb({ DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT });

const shutdownManager = new WorkerShutdownManager(logger);
shutdownManager.setupSignalHandlers();

async function initializeWorkers() {
  const workerLoader = new WorkerLoader(logger);

  const results = await workerLoader.loadWorkers({
    db,
    redisUrl: REDIS_URL,
    env: process.env as Record<string, string | undefined>,
  });

  // Register all successfully loaded workers
  const loadedWorkers = results.filter(r => r.status === 'loaded' && r.worker);
  for (const result of loadedWorkers) {
    if (result.worker) {
      shutdownManager.register(result.worker);
    }
  }

  // Log summary
  const loadedCount = results.filter(r => r.status === 'loaded').length;
  const disabledCount = results.filter(r => r.status === 'disabled').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  logger.info(
    {
      redisUrl: REDIS_URL ? '***configured***' : 'in-memory',
      environment: NODE_ENV,
      workersLoaded: loadedCount,
      workersDisabled: disabledCount,
      workersWithErrors: errorCount,
      workers: results.map(r => ({ name: r.name, status: r.status })),
    },
    'Worker orchestrator initialized'
  );
}

initializeWorkers().catch((error) => {
  logger.error({ error: error.message }, 'Failed to initialize workers');
  process.exit(1);
});
