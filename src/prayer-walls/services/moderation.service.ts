import type { IFlaggedContentRepository } from '../repositories/flagged-content.repository';
import type { IPrayerRequestRepository } from '../repositories/prayer-request.repository';
import type { IPrayerWallMembershipRepository } from '../repositories/prayer-wall-membership.repository';
import type { FlaggedContent } from '../types/prayer-wall.types';
import { FlaggedContentStatus } from '../types/prayer-wall.types';
import { logger } from '../../logging';
import { safeExecute } from '../../utils/handle-async';
import { PrayerRequestNotFoundError } from '../errors';

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
  listFlaggedContent(churchId: string): Promise<FlaggedContent[]>;

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
    private readonly membershipRepository: IPrayerWallMembershipRepository
  ) {}

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
      throw new PrayerRequestNotFoundError(prayerId);
    }

    logger.info({ prayerId, flagId: flaggedContent!.id }, 'Prayer content flagged and hidden successfully');

    return flaggedContent!;
  }

  /**
   * List all pending flagged content for a church
   */
  async listFlaggedContent(churchId: string): Promise<FlaggedContent[]> {
    logger.debug({ churchId }, 'Listing pending flagged content');

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
      throw new PrayerRequestNotFoundError(flagId);
    }

    const prayerId = updatedFlag.prayer_request_id;

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
        throw new PrayerRequestNotFoundError(prayerId);
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
        throw new PrayerRequestNotFoundError(prayerId);
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

    // For now, we only support wall-specific bans
    // Church-wide bans would require additional logic to ban from all walls
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
