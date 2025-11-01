import type {Job} from 'bullmq';

/**
 * Interface for job event handlers
 *
 * This is a generic interface that can handle any job event type.
 * Each event type can have its own handler implementation that processes
 * specific job data and performs the necessary business logic.
 *
 * @template T - The job data type that this handler processes
 */
export interface IJobEventHandler<T> {
  /**
   * The event type this handler processes
   */
  readonly eventType: string;

  /**
   * Handle the job event
   * @param job - The BullMQ job containing event data
   */
  handle(job: Job<T>): Promise<void>;
}
