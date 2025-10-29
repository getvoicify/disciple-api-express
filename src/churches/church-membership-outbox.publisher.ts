import type { OutboxEvent, OutboxPublisher } from '../outbox';
import type { ChurchMembershipOutboxEvent } from './church-membership-events';
import { CHURCH_MEMBERSHIP_EVENTS } from './church-membership-events';
import type { Queue } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../queues/church-membership-sync.types';
import { logger } from '../logging';

/**
 * Publisher that processes church membership events from the outbox
 * and enqueues them as BullMQ jobs for processing
 */
export class ChurchMembershipOutboxPublisher
  implements OutboxPublisher<ChurchMembershipOutboxEvent>
{
  constructor(private readonly syncQueue: Queue<ChurchMembershipSyncJobData>) {}

  async publish(event: OutboxEvent<ChurchMembershipOutboxEvent>): Promise<void> {
    if (!event.payload) {
      throw new Error('Church membership outbox event missing payload');
    }

    const { type, payload } = event.payload;

    logger.debug(
      { eventId: event.id, eventType: type },
      'Publishing church membership event from outbox'
    );

    try {
      switch (type) {
        case CHURCH_MEMBERSHIP_EVENTS.OWNER_CREATED:
          await this.handleOwnerCreated(payload as any);
          break;

        case CHURCH_MEMBERSHIP_EVENTS.MEMBER_JOINED:
          await this.handleMemberJoined(payload as any);
          break;

        case CHURCH_MEMBERSHIP_EVENTS.MEMBER_LEFT:
          await this.handleMemberLeft(payload as any);
          break;

        case CHURCH_MEMBERSHIP_EVENTS.OWNERSHIP_TRANSFERRED:
          await this.handleOwnershipTransferred(payload as any);
          break;

        default:
          throw new Error(`Unsupported church membership event type: ${type}`);
      }

      logger.info(
        { eventId: event.id, eventType: type },
        'Church membership event published successfully'
      );
    } catch (error) {
      logger.error(
        { eventId: event.id, eventType: type, error },
        'Failed to publish church membership event'
      );
      throw error;
    }
  }

  private async handleOwnerCreated(payload: {
    churchId: string;
    userId: string;
  }): Promise<void> {
    const jobData: ChurchMembershipSyncJobData = {
      eventType: 'owner-created',
      churchId: payload.churchId,
      userId: payload.userId,
    };

    await this.syncQueue.add('sync', jobData);

    logger.debug(
      { churchId: payload.churchId, userId: payload.userId },
      'Owner-created sync job enqueued'
    );
  }

  private async handleMemberJoined(payload: {
    churchId: string;
    userId: string;
  }): Promise<void> {
    const jobData: ChurchMembershipSyncJobData = {
      eventType: 'member-joined',
      churchId: payload.churchId,
      userId: payload.userId,
    };

    await this.syncQueue.add('sync', jobData);

    logger.debug(
      { churchId: payload.churchId, userId: payload.userId },
      'Member-joined sync job enqueued'
    );
  }

  private async handleMemberLeft(payload: { churchId: string; userId: string }): Promise<void> {
    const jobData: ChurchMembershipSyncJobData = {
      eventType: 'member-left',
      churchId: payload.churchId,
      userId: payload.userId,
    };

    await this.syncQueue.add('sync', jobData);

    logger.debug(
      { churchId: payload.churchId, userId: payload.userId },
      'Member-left sync job enqueued'
    );
  }

  private async handleOwnershipTransferred(payload: {
    churchId: string;
    previousOwnerId: string;
    newOwnerId: string;
  }): Promise<void> {
    const jobData: ChurchMembershipSyncJobData = {
      eventType: 'ownership-transferred',
      churchId: payload.churchId,
      previousOwnerId: payload.previousOwnerId,
      newOwnerId: payload.newOwnerId,
    };

    await this.syncQueue.add('sync', jobData);

    logger.debug(
      { churchId: payload.churchId, previousOwnerId: payload.previousOwnerId, newOwnerId: payload.newOwnerId },
      'Ownership-transferred sync job enqueued'
    );
  }
}
