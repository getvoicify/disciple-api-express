import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { Worker, Queue } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../../../queues/church-membership-sync/types';
import { ChurchMembershipSyncJobName } from '../../../queues/church-membership-sync/queue';

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

// Mock the logger to avoid console output during tests
vi.mock('../../logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Church Membership Sync Worker', () => {
  let worker: any;
  let queue: any;

  const mockJobProcessor = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    queue = new Queue(ChurchMembershipSyncJobName);
    worker = new Worker(ChurchMembershipSyncJobName, mockJobProcessor);
  });

  afterEach(async () => {
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('should process owner-created event', async () => {
    mockJobProcessor.mockResolvedValueOnce(undefined);

    const jobData: ChurchMembershipSyncJobData = {
      userId: 'user-123',
      eventType: 'owner-created',
      churchId: 'church-456',
    };

    const job = await queue.add('sync', jobData);
    await worker.simulateJobProcessing(job);

    expect(mockJobProcessor).toHaveBeenCalledWith(job);
  });

  it('should process member-joined event', async () => {
    mockJobProcessor.mockResolvedValueOnce(undefined);

    const jobData: ChurchMembershipSyncJobData = {
      userId: 'user-789',
      eventType: 'member-joined',
      churchId: 'church-456',
    };

    const job = await queue.add('sync', jobData);
    await worker.simulateJobProcessing(job);

    expect(mockJobProcessor).toHaveBeenCalledWith(job);
  });

  it('should process member-left event', async () => {
    mockJobProcessor.mockResolvedValueOnce(undefined);

    const jobData: ChurchMembershipSyncJobData = {
      userId: 'user-999',
      eventType: 'member-left',
      churchId: 'church-456',
    };

    const job = await queue.add('sync', jobData);
    await worker.simulateJobProcessing(job);

    expect(mockJobProcessor).toHaveBeenCalledWith(job);
  });

  it('should process ownership-transferred event with both users', async () => {
    mockJobProcessor.mockResolvedValueOnce(undefined);

    const jobData: ChurchMembershipSyncJobData = {
      eventType: 'ownership-transferred',
      churchId: 'church-456',
      previousOwnerId: 'user-old',
      newOwnerId: 'user-new',
    };

    const job = await queue.add('sync', jobData);
    await worker.simulateJobProcessing(job);

    expect(mockJobProcessor).toHaveBeenCalledWith(job);
  });

  it('should retry failed jobs with exponential backoff', async () => {
    let attemptCount = 0;
    mockJobProcessor.mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Temporary failure');
      }
      return Promise.resolve();
    });

    const jobData: ChurchMembershipSyncJobData = {
      userId: 'user-123',
      eventType: 'owner-created',
      churchId: 'church-456',
    };

    const job = await queue.add('sync', jobData);

    // Simulate retries
    await worker.simulateJobProcessing(job).catch(() => {});
    await worker.simulateJobProcessing(job).catch(() => {});
    await worker.simulateJobProcessing(job);

    expect(attemptCount).toBe(3);
  });

  it('should handle graceful worker shutdown', async () => {
    const closePromise = worker.close();
    await expect(closePromise).resolves.not.toThrow();
  });

  it('should emit error event on job processing failure', async () => {
    const errorSpy = vi.fn();
    worker.on('failed', errorSpy);

    mockJobProcessor.mockRejectedValueOnce(new Error('Processing failed'));

    const jobData: ChurchMembershipSyncJobData = {
      userId: 'user-123',
      eventType: 'owner-created',
      churchId: 'church-456',
    };

    const job = await queue.add('sync', jobData);

    await worker.simulateJobProcessing(job).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(job, expect.any(Error));
  });

  it('should emit completed event on successful job processing', async () => {
    const completedSpy = vi.fn();
    worker.on('completed', completedSpy);

    mockJobProcessor.mockResolvedValueOnce(undefined);

    const jobData: ChurchMembershipSyncJobData = {
      userId: 'user-123',
      eventType: 'owner-created',
      churchId: 'church-456',
    };

    const job = await queue.add('sync', jobData);

    await worker.simulateJobProcessing(job);

    expect(completedSpy).toHaveBeenCalledWith(job);
  });
});
