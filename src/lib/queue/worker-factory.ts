import type { Worker, Job } from 'bullmq';
import type { ILogger } from '../../logging';

/**
 * Configuration for creating a worker
 */
export interface WorkerConfig<T = unknown> {
  queueName: string;
  concurrency?: number;
  redisUrl?: string;
}

/**
 * Metadata extracted from a job for logging purposes
 */
export interface JobMetadata {
  jobId?: string;
  eventType?: string;
  [key: string]: unknown;
}

/**
 * Function that extracts metadata from a job's data for logging
 */
export type JobMetadataExtractor<T> = (data: T) => JobMetadata;

/**
 * Standard worker event handlers that can be attached to any BullMQ worker
 * These provide consistent logging and error handling across all workers
 */
export class WorkerEventHandlers<T = unknown> {
  constructor(
    private readonly logger: ILogger,
    private readonly metadataExtractor?: JobMetadataExtractor<T>
  ) {}

  /**
   * Handler for successful job completion
   */
  onCompleted = (job: Job<T>): void => {
    const metadata = this.metadataExtractor
      ? this.metadataExtractor(job.data)
      : { jobId: job.id };

    this.logger.info(metadata, 'Job completed successfully');
  };

  /**
   * Handler for job failures
   */
  onFailed = (job: Job<T> | undefined, error: Error): void => {
    const metadata: JobMetadata = {
      jobId: job?.id,
      error: error.message,
      attemptsMade: job?.attemptsMade,
    };

    if (job && this.metadataExtractor) {
      Object.assign(metadata, this.metadataExtractor(job.data));
    }

    this.logger.error(metadata, 'Job failed');
  };

  /**
   * Handler for worker-level errors
   */
  onError = (error: Error): void => {
    this.logger.error({ error: error.message }, 'Worker error occurred');
  };

  /**
   * Attach all event handlers to a worker
   */
  attachTo(worker: Worker<T>): void {
    worker.on('completed', this.onCompleted);
    worker.on('failed', this.onFailed);
    worker.on('error', this.onError);
  }
}

/**
 * Manages graceful shutdown of workers
 */
export class WorkerShutdownManager {
  private workers: Array<Worker<any>> = [];

  constructor(private readonly logger: ILogger) {}

  /**
   * Register a worker for shutdown management
   */
  register(worker: Worker<any>): void {
    this.workers.push(worker);
  }

  /**
   * Perform graceful shutdown of all registered workers
   */
  async shutdown(signal: string): Promise<void> {
    this.logger.info({ signal, workerCount: this.workers.length }, 'Workers shutting down gracefully');

    const results = await Promise.allSettled(
      this.workers.map(async (worker) => {
        await worker.close();
      })
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      this.logger.error(
        { failureCount: failures.length, totalWorkers: this.workers.length },
        'Some workers failed to shut down cleanly'
      );
      throw new Error(`${failures.length} workers failed to shut down`);
    }

    this.logger.info('All workers closed successfully');
  }

  /**
   * Setup process signal handlers for graceful shutdown
   */
  setupSignalHandlers(): void {
    const handleSignal = async (signal: string) => {
      try {
        await this.shutdown(signal);
        process.exit(0);
      } catch (error) {
        this.logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Error during worker shutdown'
        );
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => handleSignal('SIGTERM'));
    process.on('SIGINT', () => handleSignal('SIGINT'));
  }
}
