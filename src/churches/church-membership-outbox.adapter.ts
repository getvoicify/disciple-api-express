import type { Outbox } from '../outbox';
import {
  CHURCH_MEMBERSHIP_EVENTS,
  type ChurchMembershipOutboxEvent,
  type ChurchMembershipOwnerCreatedPayload,
  type ChurchMembershipMemberJoinedPayload,
  type ChurchMembershipMemberLeftPayload,
  type ChurchMembershipOwnershipTransferredPayload,
} from './church-membership-events';
import type { Queue } from 'bullmq';
import type { ChurchMembershipSyncJobData } from '../queues/church-membership-sync/types';
import { logger } from '../logging';

/**
 * Adapter for managing church membership events through the outbox pattern
 * Handles event persistence and enqueueing to BullMQ for processing
 */
export class ChurchMembershipOutboxAdapter {
  constructor(
    private readonly outbox: Outbox<ChurchMembershipOutboxEvent>,
    private readonly syncQueue: Queue<ChurchMembershipSyncJobData>
  ) {}

  /**
   * Queue an owner-created event when a user creates a church
   */
  async enqueueOwnerCreated(
    churchId: string,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const payload: ChurchMembershipOwnerCreatedPayload = {
      churchId,
      userId,
      timestamp: Date.now(),
      metadata,
    };

    const event: ChurchMembershipOutboxEvent = {
      type: CHURCH_MEMBERSHIP_EVENTS.OWNER_CREATED,
      payload,
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
    };

    await this.outbox.enqueueCreate('church_membership', churchId, event);

    logger.info(
      { churchId, userId, correlationId: event.correlationId },
      'Church membership owner-created event enqueued'
    );

    // Also enqueue to BullMQ for immediate processing
    await this.syncQueue.add('sync', {
      eventType: 'owner-created',
      churchId,
      userId,
    });
  }

  /**
   * Queue a member-joined event when a user accepts a church invitation
   */
  async enqueueMemberJoined(
    churchId: string,
    userId: string,
    role: 'Owner' | 'Manager' | 'Member',
    metadata?: Record<string, any>
  ): Promise<void> {
    const payload: ChurchMembershipMemberJoinedPayload = {
      churchId,
      userId,
      role,
      timestamp: Date.now(),
      metadata,
    };

    const event: ChurchMembershipOutboxEvent = {
      type: CHURCH_MEMBERSHIP_EVENTS.MEMBER_JOINED,
      payload,
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
    };

    await this.outbox.enqueueCreate('church_membership', `${churchId}_${userId}`, event);

    logger.info(
      { churchId, userId, role, correlationId: event.correlationId },
      'Church membership member-joined event enqueued'
    );

    // Also enqueue to BullMQ for immediate processing
    await this.syncQueue.add('sync', {
      eventType: 'member-joined',
      churchId,
      userId,
    });
  }

  /**
   * Queue a member-left event when a user leaves a church
   */
  async enqueueMemberLeft(
    churchId: string,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const payload: ChurchMembershipMemberLeftPayload = {
      churchId,
      userId,
      timestamp: Date.now(),
      metadata,
    };

    const event: ChurchMembershipOutboxEvent = {
      type: CHURCH_MEMBERSHIP_EVENTS.MEMBER_LEFT,
      payload,
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
    };

    await this.outbox.enqueueDelete('church_membership', `${churchId}_${userId}`, event);

    logger.info(
      { churchId, userId, correlationId: event.correlationId },
      'Church membership member-left event enqueued'
    );

    // Also enqueue to BullMQ for immediate processing
    await this.syncQueue.add('sync', {
      eventType: 'member-left',
      churchId,
      userId,
    });
  }

  /**
   * Queue an ownership-transferred event when church ownership changes
   * This event triggers updates for BOTH the previous and new owner
   */
  async enqueueOwnershipTransferred(
    churchId: string,
    previousOwnerId: string,
    newOwnerId: string,
    previousOwnerNewRole?: 'Manager' | 'Member',
    metadata?: Record<string, any>
  ): Promise<void> {
    const payload: ChurchMembershipOwnershipTransferredPayload = {
      churchId,
      previousOwnerId,
      newOwnerId,
      previousOwnerNewRole,
      timestamp: Date.now(),
      metadata,
    };

    const event: ChurchMembershipOutboxEvent = {
      type: CHURCH_MEMBERSHIP_EVENTS.OWNERSHIP_TRANSFERRED,
      payload,
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
    };

    await this.outbox.enqueueUpdate('church_membership', churchId, event);

    logger.info(
      {
        churchId,
        previousOwnerId,
        newOwnerId,
        correlationId: event.correlationId,
      },
      'Church membership ownership-transferred event enqueued'
    );

    // Also enqueue to BullMQ for immediate processing
    await this.syncQueue.add('sync', {
      eventType: 'ownership-transferred',
      churchId,
      previousOwnerId,
      newOwnerId,
    });
  }

  /**
   * Validate event payload structure
   */
  validateEventPayload(payload: ChurchMembershipOutboxEvent['payload']): void {
    if ('churchId' in payload && (!payload.churchId || payload.churchId.trim() === '')) {
      throw new Error('Invalid churchId: cannot be empty');
    }

    if ('userId' in payload && (!payload.userId || payload.userId.trim() === '')) {
      throw new Error('Invalid userId: cannot be empty');
    }

    if (
      'previousOwnerId' in payload &&
      (!payload.previousOwnerId || payload.previousOwnerId.trim() === '')
    ) {
      throw new Error('Invalid previousOwnerId: cannot be empty');
    }

    if ('newOwnerId' in payload && (!payload.newOwnerId || payload.newOwnerId.trim() === '')) {
      throw new Error('Invalid newOwnerId: cannot be empty');
    }
  }

  /**
   * Generate a correlation ID for tracking events
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
