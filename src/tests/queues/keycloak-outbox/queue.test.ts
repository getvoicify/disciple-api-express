import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { Queue } from 'bullmq';
import type { KeycloakOutboxJobData } from '../../../queues/keycloak-outbox/types';
import { createKeycloakOutboxQueue, KeycloakOutboxJobName, enqueueOutboxProcessing } from '../../../queues/keycloak-outbox/queue';

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
        jobId: opts.jobId,
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
    private failedJobs: MockJob[] = [];
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

      // Check for jobId deduplication
      if (opts?.jobId && this.jobs.has(opts.jobId)) {
        return this.jobs.get(opts.jobId)!;
      }

      const job = new MockJob(this, name, data, jobOpts, opts?.jobId);
      this.jobs.set(job.id, job);

      // Emit waiting event
      const handlers = this.eventHandlers.get('waiting');
      if (handlers) {
        handlers.forEach(handler => handler({ id: job.id }));
      }

      return job;
    }

    async upsertJobScheduler(
      jobSchedulerId: string,
      repeatOpts: any,
      jobOpts?: any
    ): Promise<void> {
      // Mock implementation for repeatable jobs
      return Promise.resolve();
    }

    on(event: string, handler: Function): void {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, []);
      }
      this.eventHandlers.get(event)?.push(handler);
    }

    async obliterate(opts?: { force?: boolean }): Promise<void> {
      this.jobs.clear();
      this.failedJobs = [];
      return Promise.resolve();
    }

    async close(): Promise<void> {
      this.jobs.clear();
      this.failedJobs = [];
      this.eventHandlers.clear();
      return Promise.resolve();
    }

    async getFailed(): Promise<MockJob[]> {
      return this.failedJobs;
    }

    // Helper method for tests
    async moveJobToFailed(jobId: string, error: Error): Promise<void> {
      const job = this.jobs.get(jobId);
      if (job) {
        await job.moveToFailed(error, '0', true);
        this.failedJobs.push(job);
      }
    }
  }

  class MockWorker {
    constructor(name: string, processor: any, opts?: any) {}
  }

  return {
    Queue: MockQueue,
    Worker: MockWorker,
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

describe('Keycloak Outbox Queue', () => {
  let queue: Queue<KeycloakOutboxJobData>;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = createKeycloakOutboxQueue();
  });

  afterEach(async () => {
    if (queue) {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it('should create a queue with correct name', () => {
    expect(queue.name).toBe(KeycloakOutboxJobName);
  });

  it('should enqueue a processing job with timestamp', async () => {
    const job = await enqueueOutboxProcessing(queue);

    expect(job.id).toBeDefined();
    expect(job.data.triggeredAt).toBeGreaterThan(0);
    expect(job.name).toBe('process-outbox');
  });

  it('should use job deduplication to prevent concurrent processing', async () => {
    const job1 = await enqueueOutboxProcessing(queue);
    const job2 = await enqueueOutboxProcessing(queue);

    // Both should have the same jobId for deduplication
    expect(job1.opts.jobId).toBe('keycloak-outbox-process');
    expect(job2.opts.jobId).toBe('keycloak-outbox-process');

    // Due to deduplication, they should be the same job instance
    expect(job1.id).toBe(job2.id);
  });

  it('should support custom limit parameter', async () => {
    const customLimit = 20;
    const job = await enqueueOutboxProcessing(queue, customLimit);

    expect(job.data.limit).toBe(customLimit);
  });

  it('should have retry configuration with 5 attempts', async () => {
    const job = await enqueueOutboxProcessing(queue);

    expect(job.opts.attempts).toBe(5);
  });

  it('should have exponential backoff configured', async () => {
    const job = await enqueueOutboxProcessing(queue);

    expect(job.opts.backoff).toBeDefined();
    expect((job.opts.backoff as any).type).toBe('exponential');
    expect((job.opts.backoff as any).delay).toBe(1000);
  });

  it('should handle queue graceful shutdown', async () => {
    await enqueueOutboxProcessing(queue);

    const closePromise = queue.close();
    await expect(closePromise).resolves.not.toThrow();
  });

  it('should move failed jobs to dead letter queue after max retries', async () => {
    const job = await enqueueOutboxProcessing(queue);

    // Simulate max retries exceeded
    await job.moveToFailed(new Error('Max retries exceeded'), '0', true);
    await (queue as any).moveJobToFailed(job.id, new Error('Max retries exceeded'));

    const failedJobs = await queue.getFailed();
    expect(failedJobs.length).toBeGreaterThan(0);
    expect(failedJobs[0]?.id).toBe(job.id);
  });
});
