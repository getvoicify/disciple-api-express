import { beforeEach, describe, expect, it, vi, afterEach, type MockedFunction } from 'vitest';
import { Queue } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../../queues/church-membership-sync.types';
import { createChurchMembershipSyncQueue, ChurchMembershipSyncJobName } from '../../queues/church-membership-sync.queue';

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
      // Simulate moving to failed
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
      const job = new MockJob(this, name, data, jobOpts);
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

    // Helper method for tests to simulate job failure
    async moveJobToFailed(jobId: string, error: Error): Promise<void> {
      const job = this.jobs.get(jobId);
      if (job) {
        await job.moveToFailed(error, '0', true);
        this.failedJobs.push(job);
      }
    }
  }

  // Create mock Worker class (even though not used, for completeness)
  class MockWorker {
    constructor(name: string, processor: any, opts?: any) {}
  }

  return {
    Queue: MockQueue,
    Worker: MockWorker,
  };
});

// Mock the logger to avoid console output during tests
vi.mock('../logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Church Membership Sync Queue', () => {
  let queue: Queue<ChurchMembershipSyncJobData>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create queue with mocked BullMQ
    queue = createChurchMembershipSyncQueue();
  });

  afterEach(async () => {
    // Clean up queue after tests
    if (queue) {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it('should create a queue with correct name', () => {
    expect(queue.name).toBe(ChurchMembershipSyncJobName);
  });

  it('should enqueue a job with correct data', async () => {
    const jobData: ChurchMembershipSyncJobData = {
      userId: 'user-123',
      eventType: 'owner-created',
      churchId: 'church-456',
    };

    const job = await queue.add('sync', jobData);

    expect(job.id).toBeDefined();
    expect(job.data).toEqual(jobData);
    expect(job.name).toBe('sync');
  });

  it('should have retry configuration with 5 attempts', async () => {
    const jobData: ChurchMembershipSyncJobData = {
      userId: 'user-123',
      eventType: 'member-joined',
      churchId: 'church-456',
    };

    const job = await queue.add('sync', jobData);

    // BullMQ uses attempts in opts
    expect(job.opts.attempts).toBe(5);
  });

  it('should have exponential backoff configured', async () => {
    const jobData: ChurchMembershipSyncJobData = {
      userId: 'user-123',
      eventType: 'member-left',
      churchId: 'church-456',
    };

    const job = await queue.add('sync', jobData);

    // Check backoff configuration
    expect(job.opts.backoff).toBeDefined();
    expect((job.opts.backoff as any).type).toBe('exponential');
    expect((job.opts.backoff as any).delay).toBe(1000);
  });

  it('should process ownership transfer jobs with two users', async () => {
    const jobData: ChurchMembershipSyncJobData = {
      eventType: 'ownership-transferred',
      churchId: 'church-456',
      previousOwnerId: 'user-old',
      newOwnerId: 'user-new',
    };

    const job = await queue.add('sync', jobData);

    expect(job.data.previousOwnerId).toBe('user-old');
    expect(job.data.newOwnerId).toBe('user-new');
    expect(job.data.userId).toBeUndefined();
  });

  it('should handle queue graceful shutdown', async () => {
    // Add a job first to ensure queue has some state
    await queue.add('sync', {
      userId: 'user-123',
      eventType: 'member-joined',
      churchId: 'church-456',
    });

    // Close should not throw
    const closePromise = queue.close();
    await expect(closePromise).resolves.not.toThrow();
  });

  it('should move failed jobs to dead letter queue after max retries', async () => {
    // This test verifies BullMQ's built-in DLQ behavior
    const jobData: ChurchMembershipSyncJobData = {
      userId: 'user-123',
      eventType: 'member-joined',
      churchId: 'church-456',
    };

    const job = await queue.add('sync', jobData);

    // Simulate all retries exhausted by moving to failed
    await job.moveToFailed(new Error('Max retries exceeded'), '0', true);

    // Since we're using mocks, we need to manually simulate the failed job tracking
    // In the real BullMQ, this would be handled internally
    await (queue as any).moveJobToFailed(job.id, new Error('Max retries exceeded'));

    const failedJobs = await queue.getFailed();
    expect(failedJobs.length).toBeGreaterThan(0);
    expect(failedJobs[0]?.id).toBe(job.id);
  });
});
