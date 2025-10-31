import type { Job } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../church-membership-sync.types';
import type { IJobEventHandler } from './job-event-handler.interface';
import type { MembershipSyncService } from './membership-sync.service';
import { logger } from '../../logging';

/**
 * Handler for owner-created events
 * Syncs the new church owner's memberships to Keycloak
 */
export class OwnerCreatedHandler implements IJobEventHandler<ChurchMembershipSyncJobData> {
  readonly eventType = 'owner-created';

  constructor(private readonly syncService: MembershipSyncService) {}

  async handle(job: Job<ChurchMembershipSyncJobData>): Promise<void> {
    const data = job.data as Extract<ChurchMembershipSyncJobData, { eventType: 'owner-created' }>;
    const { userId, churchId } = data;

    logger.info({ jobId: job.id, userId, churchId }, 'Processing owner-created event');

    await this.syncService.syncUserMemberships(userId);

    logger.info(
      { jobId: job.id, userId, churchId },
      'Owner-created event processed successfully'
    );
  }
}
