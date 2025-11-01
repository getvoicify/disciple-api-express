import { glob } from 'glob';
import path from 'path';
import type { Worker } from 'bullmq';
import type { ILogger } from '../../logging';
import { safeExecute } from '../../utils/handle-async';

/**
 * Common dependencies that all workers receive
 */
export interface WorkerCommonDeps {
  db: any;
  redisUrl?: string;
  env: Record<string, string | undefined>;
}

/**
 * Worker-specific configuration metadata
 * Each queue worker exports this to declare its requirements and factory
 */
export interface WorkerConfig<TDeps = any> {
  name: string;
  enabled: (env: Record<string, string | undefined>) => boolean;
  getDependencies: (commonDeps: WorkerCommonDeps) => TDeps;
  createWorker: (deps: TDeps) => Worker<any> | Promise<Worker<any>>;
}

/**
 * Result of attempting to load a worker
 */
interface WorkerLoadResult {
  name: string;
  status: 'loaded' | 'disabled' | 'error';
  worker?: Worker<any>;
  error?: string;
}

/**
 * Dynamically discovers and loads queue workers from the filesystem
 *
 * This class scans src/queues directory for worker.config.{ts,js} files,
 * imports their configuration, checks if they're enabled, and creates
 * worker instances automatically.
 */
export class WorkerLoader {
  constructor(
    private readonly logger: ILogger,
    private readonly queuesDir: string = path.join(__dirname, '../../queues')
  ) {}

  /**
   * Discover all worker config files in the queues directory
   */
  private async discoverWorkerConfigs(): Promise<string[]> {
    const pattern = path.join(this.queuesDir, '*/worker.config.{ts,js}');
    const [error, files] = await safeExecute(glob(pattern));

    if (error) {
      this.logger.error({ error: error.message, pattern }, 'Failed to discover worker configs');
      return [];
    }

    return files || [];
  }

  /**
   * Load a single worker configuration module
   */
  private async loadWorkerConfig(configPath: string): Promise<WorkerConfig | null> {
    const [importError, module] = await safeExecute<any>(() => import(configPath));

    if (importError) {
      this.logger.error({ error: importError.message, configPath }, 'Failed to import worker config');
      return null;
    }

    if (!module || !module.workerConfig) {
      this.logger.warn({ configPath }, 'Worker config module missing workerConfig export');
      return null;
    }

    const config = module.workerConfig as WorkerConfig;

    if (!config.name || !config.enabled || !config.getDependencies || !config.createWorker) {
      this.logger.warn(
        { configPath, hasName: !!config.name, hasEnabled: !!config.enabled },
        'Worker config missing required properties'
      );
      return null;
    }

    return config;
  }

  /**
   * Create a worker instance from configuration
   */
  private async createWorkerFromConfig(
    config: WorkerConfig,
    commonDeps: WorkerCommonDeps
  ): Promise<Worker<any> | null> {
    const [depsError, workerDeps] = await safeExecute(() => config.getDependencies(commonDeps));

    if (depsError) {
      this.logger.error(
        { error: depsError.message, workerName: config.name },
        'Failed to get worker dependencies'
      );
      return null;
    }

    const [workerError, worker] = await safeExecute(() => config.createWorker(workerDeps));

    if (workerError) {
      this.logger.error(
        { error: workerError.message, workerName: config.name },
        'Failed to create worker instance'
      );
      return null;
    }

    return worker || null;
  }

  /**
   * Load all workers from the queues directory
   *
   * @param commonDeps - Common dependencies shared by all workers
   * @returns Array of successfully loaded workers
   */
  async loadWorkers(commonDeps: WorkerCommonDeps): Promise<WorkerLoadResult[]> {
    const configPaths = await this.discoverWorkerConfigs();

    this.logger.info({ count: configPaths.length }, 'Discovered worker configs');

    const results: WorkerLoadResult[] = [];

    for (const configPath of configPaths) {
      const config = await this.loadWorkerConfig(configPath);

      if (!config) {
        results.push({
          name: path.basename(path.dirname(configPath)),
          status: 'error',
          error: 'Failed to load config',
        });
        continue;
      }

      const isEnabled = config.enabled(commonDeps.env);

      if (!isEnabled) {
        this.logger.info({ workerName: config.name }, 'Worker disabled - skipping');
        results.push({
          name: config.name,
          status: 'disabled',
        });
        continue;
      }

      const worker = await this.createWorkerFromConfig(config, commonDeps);

      if (!worker) {
        results.push({
          name: config.name,
          status: 'error',
          error: 'Failed to create worker',
        });
        continue;
      }

      this.logger.info({ workerName: config.name }, 'Worker loaded successfully');
      results.push({
        name: config.name,
        status: 'loaded',
        worker,
      });
    }

    return results;
  }
}
