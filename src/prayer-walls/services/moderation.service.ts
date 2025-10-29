import type { IFlaggedContentRepository } from '../repositories/flagged-content.repository';
import type { IPrayerRequestRepository } from '../repositories/prayer-request.repository';
import type { IPrayerWallMembershipRepository } from '../repositories/prayer-wall-membership.repository';
import type { IPrayerWallRepository } from '../repositories/prayer-wall.repository';
import type { ChurchMembershipService } from '../../churches/membership-service';
import type { FlaggedContent } from '../types/prayer-wall.types';
import { FlaggedContentStatus } from '../types/prayer-wall.types';
import { logger } from '../../logging';
import { safeExecute } from '../../utils/handle-async';
import {
  PrayerRequestNotFoundError,
  FlaggedContentNotFoundError,
  PrayerHideFailedError,
  PrayerDeleteFailedError,
  PrayerRestoreFailedError,
  ChurchWideBansNotSupportedError,
  InsufficientChurchRoleError,
  NotChurchMemberError,
  PrayerWallNotFoundError,
} from '../errors';

/**
 * Service interface for content moderation operations
 */
export interface IModerationService {
  /**
   * Flag content - auto-hides prayer and creates flagged_content record
   */
  flagContent(prayerId: string, flaggedBy: string, reason: string): Promise<FlaggedContent>;

  /**
   * List all pending flags for a church (pastor-only)
   */
  listFlaggedContent(churchId: string, userId: string): Promise<FlaggedContent[]>;

  /**
   * Review flagged content with action (delete/restore)
   */
  reviewFlaggedContent(
    flagId: string,
    action: 'delete' | 'restore',
    reviewedBy: string,
    notes?: string
  ): Promise<FlaggedContent>;

  /**
   * Delete prayer request (soft delete)
   */
  deleteContent(prayerId: string, deletedBy: string): Promise<boolean>;

  /**
   * Restore prayer request
   */
  restoreContent(prayerId: string, restoredBy: string): Promise<boolean>;

  /**
   * Ban user from wall
   */
  banUser(wallId: string, userId: string, bannedBy: string, churchWide?: boolean): Promise<boolean>;
}

/**
 * Service for content moderation operations
 * Handles flagging, review, and ban workflows for prayer wall content
 */
export class ModerationService implements IModerationService {
  constructor(
    private readonly flaggedContentRepository: IFlaggedContentRepository,
    private readonly prayerRequestRepository: IPrayerRequestRepository,
    private readonly membershipRepository: IPrayerWallMembershipRepository,
    private readonly prayerWallRepository: IPrayerWallRepository,
    private readonly churchMembershipService: ChurchMembershipService
  ) {}

  /**
   * Helper method to verify that a user has pastor-level permissions (Owner or Manager role)
   * @param userId - The ID of the user to check
   * @param churchId - The ID of the church
   * @throws {NotChurchMemberError} If user is not a member of the church
   * @throws {InsufficientChurchRoleError} If user doesn't have Owner or Manager role
   */
  private async verifyPastorRole(userId: string, churchId: string): Promise<void> {
    const [error, membership] = await safeExecute(
      this.churchMembershipService.getMembershipByUserAndChurch(userId, churchId)
    );

    if (error) {
      logger.error({ error, userId, churchId }, 'Failed to fetch church membership for pastor verification');
      throw error;
    }

    if (!membership) {
      throw new NotChurchMemberError(userId, churchId);
    }

    const isPastor =
      membership.status === 'Active' &&
      (membership.role === 'Owner' || membership.role === 'Manager');

    if (!isPastor) {
      throw new InsufficientChurchRoleError(['Owner', 'Manager'], membership.role);
    }
  }

  /**
   * Flag content and auto-hide the prayer request immediately
   */
  async flagContent(prayerId: string, flaggedBy: string, reason: string): Promise<FlaggedContent> {
    logger.info({ prayerId, flaggedBy, reason }, 'Flagging prayer content');

    // First, verify the prayer exists
    const [prayerError, prayer] = await safeExecute(
      this.prayerRequestRepository.findById(prayerId)
    );

    if (prayerError) {
      logger.error({ error: prayerError, prayerId }, 'Failed to find prayer for flagging');
      throw prayerError;
    }

    if (!prayer) {
      logger.error({ prayerId }, 'Prayer not found for flagging');
      throw new PrayerRequestNotFoundError(prayerId);
    }

    // Create flagged content record
    const [flagError, flaggedContent] = await safeExecute(
      this.flaggedContentRepository.create(prayerId, flaggedBy, reason)
    );

    if (flagError) {
      logger.error({ error: flagError, prayerId, flaggedBy }, 'Failed to create flagged content record');
      throw flagError;
    }

    // Auto-hide the prayer by setting hidden_at
    const [hideError, hideSuccess] = await safeExecute(
      this.prayerRequestRepository.hide(prayerId)
    );

    if (hideError) {
      logger.error({ error: hideError, prayerId }, 'Failed to hide flagged prayer');
      throw hideError;
    }

    if (!hideSuccess) {
      logger.error({ prayerId }, 'Prayer could not be hidden');
      throw new PrayerHideFailedError(prayerId);
    }

    logger.info({ prayerId, flagId: flaggedContent!.id }, 'Prayer content flagged and hidden successfully');

    return flaggedContent!;
  }

  /**
   * List all pending flagged content for a church (pastor-only)
   */
  async listFlaggedContent(churchId: string, userId: string): Promise<FlaggedContent[]> {
    logger.debug({ churchId, userId }, 'Listing pending flagged content');

    // Verify user has pastor role
    await this.verifyPastorRole(userId, churchId);

    const [error, pendingFlags] = await safeExecute(
      this.flaggedContentRepository.findPending(churchId)
    );

    if (error) {
      logger.error({ error, churchId }, 'Failed to list flagged content');
      throw error;
    }

    logger.debug({ churchId, count: pendingFlags!.length }, 'Retrieved pending flagged content');

    return pendingFlags!;
  }

  /**
   * Review flagged content with delete or restore action
   */
  async reviewFlaggedContent(
    flagId: string,
    action: 'delete' | 'restore',
    reviewedBy: string,
    notes?: string
  ): Promise<FlaggedContent> {
    logger.info({ flagId, action, reviewedBy }, 'Reviewing flagged content');

    // Determine status and action based on review decision
    let status: FlaggedContentStatus;
    let resolutionAction: string;

    if (action === 'delete') {
      status = FlaggedContentStatus.ACTIONED;
      resolutionAction = 'delete';
    } else {
      status = FlaggedContentStatus.DISMISSED;
      resolutionAction = 'restore';
    }

    // Update flag status first
    const [updateError, updatedFlag] = await safeExecute(
      this.flaggedContentRepository.updateStatus(
        flagId,
        status,
        reviewedBy,
        resolutionAction,
        notes
      )
    );

    if (updateError) {
      logger.error({ error: updateError, flagId }, 'Failed to update flagged content status');
      throw updateError;
    }

    if (!updatedFlag) {
      logger.error({ flagId }, 'Flagged content not found');
      throw new FlaggedContentNotFoundError(flagId);
    }

    const prayerId = updatedFlag.prayer_request_id;

    // Fetch prayer to get prayer_wall_id for pastor verification
    const [prayerError, prayer] = await safeExecute(
      this.prayerRequestRepository.findById(prayerId)
    );

    if (prayerError) {
      logger.error({ error: prayerError, prayerId }, 'Failed to fetch prayer for pastor verification');
      throw prayerError;
    }

    if (!prayer) {
      throw new PrayerRequestNotFoundError(prayerId);
    }

    // Fetch wall to get church_id for pastor verification
    const [wallError, wall] = await safeExecute(
      this.prayerWallRepository.findById(prayer.wall_id)
    );

    if (wallError) {
      logger.error({ error: wallError, wallId: prayer.wall_id }, 'Failed to fetch wall for pastor verification');
      throw wallError;
    }

    if (!wall) {
      throw new PrayerWallNotFoundError(prayer.wall_id);
    }

    // Verify user has pastor role
    await this.verifyPastorRole(reviewedBy, wall.church_id);

    // Perform the action on the prayer
    if (action === 'delete') {
      const [deleteError, deleteSuccess] = await safeExecute(
        this.prayerRequestRepository.softDelete(prayerId, reviewedBy)
      );

      if (deleteError) {
        logger.error({ error: deleteError, prayerId, flagId }, 'Failed to soft-delete prayer');
        throw deleteError;
      }

      if (!deleteSuccess) {
        logger.error({ prayerId, flagId }, 'Prayer could not be deleted');
        throw new PrayerDeleteFailedError(prayerId, 'Soft delete operation failed');
      }

      logger.info({ prayerId, flagId, reviewedBy }, 'Prayer soft-deleted after flag review');
    } else {
      // Restore action: clear hidden_at
      const [restoreError, restoreSuccess] = await safeExecute(
        this.prayerRequestRepository.unhide(prayerId)
      );

      if (restoreError) {
        logger.error({ error: restoreError, prayerId, flagId }, 'Failed to restore prayer visibility');
        throw restoreError;
      }

      if (!restoreSuccess) {
        logger.error({ prayerId, flagId }, 'Prayer could not be restored');
        throw new PrayerRestoreFailedError(prayerId, 'Unhide operation failed');
      }

      logger.info({ prayerId, flagId, reviewedBy }, 'Prayer restored after false flag review');
    }

    return updatedFlag;
  }

  /**
   * Delete content directly (without flag review workflow)
   */
  async deleteContent(prayerId: string, deletedBy: string): Promise<boolean> {
    logger.info({ prayerId, deletedBy }, 'Deleting prayer content directly');

    const [error, success] = await safeExecute(
      this.prayerRequestRepository.softDelete(prayerId, deletedBy)
    );

    if (error) {
      logger.error({ error, prayerId, deletedBy }, 'Failed to delete prayer content');
      throw error;
    }

    logger.info({ prayerId, deletedBy, success }, 'Prayer content deleted directly');

    return success!;
  }

  /**
   * Restore content directly (without flag review workflow)
   */
  async restoreContent(prayerId: string, restoredBy: string): Promise<boolean> {
    logger.info({ prayerId, restoredBy }, 'Restoring prayer content directly');

    const [error, success] = await safeExecute(
      this.prayerRequestRepository.restore(prayerId)
    );

    if (error) {
      logger.error({ error, prayerId, restoredBy }, 'Failed to restore prayer content');
      throw error;
    }

    logger.info({ prayerId, restoredBy, success }, 'Prayer content restored directly');

    return success!;
  }

  /**
   * Ban user from wall (and optionally church-wide)
   */
  async banUser(
    wallId: string,
    userId: string,
    bannedBy: string,
    churchWide?: boolean
  ): Promise<boolean> {
    logger.info({ wallId, userId, bannedBy, churchWide }, 'Banning user from wall');

    // Church-wide bans are not yet supported
    if (churchWide) {
      logger.warn({ wallId, userId, bannedBy }, 'Church-wide ban requested but not supported');
      throw new ChurchWideBansNotSupportedError();
    }

    // Fetch wall to get church_id for pastor verification
    const [wallError, wall] = await safeExecute(
      this.prayerWallRepository.findById(wallId)
    );

    if (wallError) {
      logger.error({ error: wallError, wallId }, 'Failed to fetch wall for pastor verification');
      throw wallError;
    }

    if (!wall) {
      throw new PrayerWallNotFoundError(wallId);
    }

    // Verify user has pastor role
    await this.verifyPastorRole(bannedBy, wall.church_id);

    // Wall-specific ban
    const [error, success] = await safeExecute(
      this.membershipRepository.ban(wallId, userId, bannedBy)
    );

    if (error) {
      logger.error({ error, wallId, userId, bannedBy }, 'Failed to ban user');
      throw error;
    }

    logger.info({ wallId, userId, bannedBy, success }, 'User banned from wall');

    return success!;
  }
}
