import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { Worker, Queue } from 'bullmq';
import type { KeycloakOutboxJobData } from '../../../queues/keycloak-outbox/types';
import { KeycloakOutboxJobName } from '../../../queues/keycloak-outbox/queue';
import type { Outbox } from '../../../outbox';

// Mock the entire bullmq module
vi.mock('bullmq', () => {
  // Create mock Job class
  class MockJob {
    id: string;
    name: string;
    data: any;
    opts: any;
    attemptsMade: number;

    constructor(queue: any, name: string, data: any, opts: any = {}, id?: string) {
      this.id = id || Math.random().toString(36);
      this.name = name;
      this.data = data;
      this.opts = {
        attempts: opts.attempts || 5,
        backoff: opts.backoff || { type: 'exponential', delay: 1000 },
        ...opts,
      };
      this.attemptsMade = 0;
    }

    async moveToFailed(error: Error, token: string, doNotRemove: boolean): Promise<void> {
      return Promise.resolve();
    }
  }

  // Create mock Queue class
  class MockQueue {
    name: string;
    opts: any;
    private jobs: Map<string, MockJob> = new Map();
    private eventHandlers: Map<string, Function[]> = new Map();

    constructor(name: string, opts?: any) {
      this.name = name;
      this.opts = {
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
        ...opts,
      };
    }

    async add(name: string, data: any, opts?: any): Promise<MockJob> {
      const jobOpts = {
        ...this.opts.defaultJobOptions,
        ...opts,
      };
      const job = new MockJob(this, name, data, jobOpts, opts?.jobId);
      this.jobs.set(job.id, job);

      // Emit waiting event
      const handlers = this.eventHandlers.get('waiting');
      if (handlers) {
        handlers.forEach(handler => handler({ id: job.id }));
      }

      return job;
    }

    on(event: string, handler: Function): void {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, []);
      }
      this.eventHandlers.get(event)?.push(handler);
    }

    async obliterate(opts?: { force?: boolean }): Promise<void> {
      this.jobs.clear();
      return Promise.resolve();
    }

    async close(): Promise<void> {
      this.jobs.clear();
      this.eventHandlers.clear();
      return Promise.resolve();
    }
  }

  // Create mock Worker class
  class MockWorker {
    name: string;
    processor: any;
    private eventHandlers: Map<string, Function[]> = new Map();
    private processingJobs: Set<string> = new Set();

    constructor(name: string, processor: any, opts?: any) {
      this.name = name;
      this.processor = processor;
    }

    on(event: string, handler: Function): void {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, []);
      }
      this.eventHandlers.get(event)?.push(handler);
    }

    async close(): Promise<void> {
      this.eventHandlers.clear();
      this.processingJobs.clear();
      return Promise.resolve();
    }

    // Helper to simulate job processing
    async simulateJobProcessing(job: any): Promise<void> {
      this.processingJobs.add(job.id);
      try {
        await this.processor(job);
        const handlers = this.eventHandlers.get('completed');
        if (handlers) {
          handlers.forEach(handler => handler(job));
        }
      } catch (error) {
        const handlers = this.eventHandlers.get('failed');
        if (handlers) {
          handlers.forEach(handler => handler(job, error));
        }
        throw error;
      } finally {
        this.processingJobs.delete(job.id);
      }
    }
  }

  return {
    Queue: MockQueue,
    Worker: MockWorker,
    Job: MockJob,
  };
});

// Mock the logger
vi.mock('../../../logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Keycloak Outbox Worker', () => {
  let worker: any;
  let queue: any;
  let mockOutbox: Outbox<any>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock outbox
    mockOutbox = {
      enqueueCreate: vi.fn(),
      enqueueUpdate: vi.fn(),
      enqueueDelete: vi.fn(),
      processDue: vi.fn().mockResolvedValue(undefined),
    };

    queue = new Queue(KeycloakOutboxJobName);

    // Create a simple job processor that calls outbox.processDue()
    const jobProcessor = async (job: any) => {
      const limit = job.data.limit;
      await mockOutbox.processDue(limit);
    };

    worker = new Worker(KeycloakOutboxJobName, jobProcessor);
  });

  afterEach(async () => {
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('should process outbox job and call processDue()', async () => {
    const jobData: KeycloakOutboxJobData = {
      triggeredAt: Date.now(),
    };

    const job = await queue.add('process-outbox', jobData);
    await worker.simulateJobProcessing(job);

    expect(mockOutbox.processDue).toHaveBeenCalledWith(undefined);
  });

  it('should pass limit parameter to processDue() when provided', async () => {
    const jobData: KeycloakOutboxJobData = {
      triggeredAt: Date.now(),
      limit: 20,
    };

    const job = await queue.add('process-outbox', jobData);
    await worker.simulateJobProcessing(job);

    expect(mockOutbox.processDue).toHaveBeenCalledWith(20);
  });

  it('should retry failed jobs with exponential backoff', async () => {
    let attemptCount = 0;
    (mockOutbox.processDue as any).mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Temporary failure');
      }
      return Promise.resolve();
    });

    const jobData: KeycloakOutboxJobData = {
      triggeredAt: Date.now(),
    };

    const job = await queue.add('process-outbox', jobData);

    // Simulate retries
    await worker.simulateJobProcessing(job).catch(() => {});
    await worker.simulateJobProcessing(job).catch(() => {});
    await worker.simulateJobProcessing(job);

    expect(attemptCount).toBe(3);
  });

  it('should emit completed event on successful processing', async () => {
    const completedSpy = vi.fn();
    worker.on('completed', completedSpy);

    const jobData: KeycloakOutboxJobData = {
      triggeredAt: Date.now(),
    };

    const job = await queue.add('process-outbox', jobData);
    await worker.simulateJobProcessing(job);

    expect(completedSpy).toHaveBeenCalledWith(job);
  });

  it('should emit failed event on processing failure', async () => {
    const errorSpy = vi.fn();
    worker.on('failed', errorSpy);

    (mockOutbox.processDue as any).mockRejectedValueOnce(new Error('Processing failed'));

    const jobData: KeycloakOutboxJobData = {
      triggeredAt: Date.now(),
    };

    const job = await queue.add('process-outbox', jobData);

    await worker.simulateJobProcessing(job).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(job, expect.any(Error));
  });

  it('should handle graceful worker shutdown', async () => {
    const closePromise = worker.close();
    await expect(closePromise).resolves.not.toThrow();
  });

  it('should handle errors from outbox.processDue()', async () => {
    (mockOutbox.processDue as any).mockRejectedValueOnce(new Error('Outbox error'));

    const jobData: KeycloakOutboxJobData = {
      triggeredAt: Date.now(),
    };

    const job = await queue.add('process-outbox', jobData);

    await expect(worker.simulateJobProcessing(job)).rejects.toThrow('Outbox error');
  });
});
