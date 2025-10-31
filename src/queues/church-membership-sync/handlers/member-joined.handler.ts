import type { Job } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../types';
import type { IJobEventHandler } from '../../../lib/queue/job-event-handler.interface';
import type { MembershipSyncService } from './membership-sync.service';
import { logger } from '../../../logging';

/**
 * Handler for member-joined events
 * Syncs the new member's church memberships to Keycloak
 */
export class MemberJoinedHandler implements IJobEventHandler<ChurchMembershipSyncJobData> {
  readonly eventType = 'member-joined';

  constructor(private readonly syncService: MembershipSyncService) {}

  async handle(job: Job<ChurchMembershipSyncJobData>): Promise<void> {
    const data = job.data as Extract<ChurchMembershipSyncJobData, { eventType: 'member-joined' }>;
    const { userId, churchId } = data;

    logger.info({ jobId: job.id, userId, churchId }, 'Processing member-joined event');

    await this.syncService.syncUserMemberships(userId);

    logger.info(
      { jobId: job.id, userId, churchId },
      'Member-joined event processed successfully'
    );
  }
}
