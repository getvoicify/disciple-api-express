import type { Job } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../church-membership-sync.types';
import type { IChurchMembershipEventHandler } from './church-membership-event-handler.interface';
import type { MembershipSyncService } from './membership-sync.service';
import { logger } from '../../logging';

/**
 * Handler for ownership-transferred events
 * Syncs both the previous and new owner's church memberships to Keycloak
 */
export class OwnershipTransferredHandler implements IChurchMembershipEventHandler {
  readonly eventType = 'ownership-transferred';

  constructor(private readonly syncService: MembershipSyncService) {}

  async handle(job: Job<ChurchMembershipSyncJobData>): Promise<void> {
    const data = job.data as Extract<
      ChurchMembershipSyncJobData,
      { eventType: 'ownership-transferred' }
    >;
    const { previousOwnerId, newOwnerId, churchId } = data;

    logger.info(
      { jobId: job.id, previousOwnerId, newOwnerId, churchId },
      'Processing ownership-transferred event'
    );

    await Promise.all([
      this.syncService.syncUserMemberships(previousOwnerId),
      this.syncService.syncUserMemberships(newOwnerId),
    ]);

    logger.info(
      { jobId: job.id, previousOwnerId, newOwnerId, churchId },
      'Ownership-transferred event processed successfully for both users'
    );
  }
}
