import type { Job } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../church-membership-sync.types';

/**
 * Interface for church membership event handlers
 * Each event type has its own handler implementation
 */
export interface IChurchMembershipEventHandler {
  /**
   * The event type this handler processes
   */
  readonly eventType: string;

  /**
   * Handle the church membership sync event
   * @param job - The BullMQ job containing event data
   */
  handle(job: Job<ChurchMembershipSyncJobData>): Promise<void>;
}
