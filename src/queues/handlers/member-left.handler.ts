import type { Job } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../church-membership-sync.types';
import type { IChurchMembershipEventHandler } from './church-membership-event-handler.interface';
import type { MembershipSyncService } from './membership-sync.service';
import { logger } from '../../logging';

/**
 * Handler for member-left events
 * Syncs the departed member's church memberships to Keycloak (removing the church)
 */
export class MemberLeftHandler implements IChurchMembershipEventHandler {
  readonly eventType = 'member-left';

  constructor(private readonly syncService: MembershipSyncService) {}

  async handle(job: Job<ChurchMembershipSyncJobData>): Promise<void> {
    const data = job.data as Extract<ChurchMembershipSyncJobData, { eventType: 'member-left' }>;
    const { userId, churchId } = data;

    logger.info({ jobId: job.id, userId, churchId }, 'Processing member-left event');

    await this.syncService.syncUserMemberships(userId);

    logger.info(
      { jobId: job.id, userId, churchId },
      'Member-left event processed successfully'
    );
  }
}
