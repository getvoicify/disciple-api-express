import type { IPrayerRequestRepository } from '../repositories/prayer-request.repository';
import type { IPrayerWallMembershipRepository } from '../repositories/prayer-wall-membership.repository';
import type {
  PrayerRequest,
  CreatePrayerRequestData,
  UpdatePrayerRequestData,
  CursorPaginationParams,
} from '../types/prayer-wall.types';
import { AnonymityLevel } from '../types/prayer-wall.types';
import { logger } from '../../logging';
import {
  PrayerRequestNotFoundError,
  WallMembershipRequiredError,
  UnauthorizedOperationError,
  EditWindowExpiredError,
  PrayerUpdateFailedError,
  ThreadDepthExceededError,
  InvalidContentError,
  CannotReplyToDeletedPrayerError,
} from '../errors';
import type { UserInfoService } from '../../user-info/service';
import { extractUniqueUserIds, embedUserInfo } from '../../user-info/embedding.util';

/**
 * Service interface for managing prayer requests
 */
export interface IPrayerRequestService {
  createPrayer(
    wallId: string,
    data: Omit<CreatePrayerRequestData, 'wall_id' | 'author_id'>,
    authorId: string
  ): Promise<PrayerRequest>;
  updatePrayer(prayerId: string, content: string, authorId: string): Promise<PrayerRequest>;
  getPrayer(prayerId: string, userId: string): Promise<PrayerRequest | null>;
  listPrayers(
    wallId: string,
    userId: string,
    pagination?: CursorPaginationParams
  ): Promise<PrayerRequest[]>;
  listRootPrayers(
    wallId: string,
    userId: string,
    pagination?: CursorPaginationParams
  ): Promise<PrayerRequest[]>;
  getDirectChildren(parentId: string, userId: string): Promise<PrayerRequest[]>;
  getFullThread(rootId: string, userId: string): Promise<PrayerRequest[]>;
  softDelete(prayerId: string, deletedBy: string): Promise<boolean>;
  restore(prayerId: string, restoredBy: string): Promise<boolean>;
  addResponse(
    parentId: string,
    content: string,
    authorId: string,
    anonymityLevel?: AnonymityLevel
  ): Promise<PrayerRequest>;
  validateThreadDepth(parentId: string | null): Promise<number>;
}

/**
 * Service for managing prayer requests with business logic enforcement
 * Handles thread depth validation, anonymity enforcement, and edit windows
 */
export class PrayerRequestService implements IPrayerRequestService {
  private readonly EDIT_WINDOW_MINUTES = 5;
  private readonly MIN_CONTENT_LENGTH = 10;
  private readonly MAX_CONTENT_LENGTH = 5000;

  constructor(
    private readonly prayerRequestRepository: IPrayerRequestRepository,
    private readonly membershipRepository: IPrayerWallMembershipRepository,
    private readonly userInfoService?: UserInfoService
  ) {}

  /**
   * Validate prayer content
   * @private
   */
  private validateContent(content: string): void {
    const trimmed = content.trim();

    if (!trimmed) {
      throw new InvalidContentError('Prayer content cannot be empty');
    }

    if (trimmed.length < this.MIN_CONTENT_LENGTH) {
      throw new InvalidContentError(
        `Prayer content must be at least ${this.MIN_CONTENT_LENGTH} characters`
      );
    }

    if (trimmed.length > this.MAX_CONTENT_LENGTH) {
      throw new InvalidContentError(
        `Prayer content cannot exceed ${this.MAX_CONTENT_LENGTH} characters`
      );
    }
  }

  /**
   * Create a new prayer request
   * Validates membership and thread depth
   */
  async createPrayer(
    wallId: string,
    data: Omit<CreatePrayerRequestData, 'wall_id' | 'author_id'>,
    authorId: string
  ): Promise<PrayerRequest> {
    // Validate content
    this.validateContent(data.content);

    // Check if user is a member of the wall
    const isMember = await this.membershipRepository.isMember(wallId, authorId);
    if (!isMember) {
      throw new WallMembershipRequiredError('create prayer requests', wallId);
    }

    // If this is a response (has parent_id), validate thread depth
    if (data.parent_id) {
      const parentDepth = await this.prayerRequestRepository.validateThreadDepth(data.parent_id);
      if (parentDepth >= 3) {
        throw new ThreadDepthExceededError(data.parent_id, parentDepth);
      }
    }

    logger.info(
      { wallId, authorId, anonymityLevel: data.anonymity_level, hasParent: !!data.parent_id },
      'Creating prayer request'
    );

    const prayerData: CreatePrayerRequestData = {
      wall_id: wallId,
      author_id: authorId,
      content: data.content,
      anonymity_level: data.anonymity_level,
      parent_id: data.parent_id,
      has_attachment: data.has_attachment,
    };

    const prayer = await this.prayerRequestRepository.create(prayerData);

    logger.info({ prayerId: prayer.id, authorId }, 'Prayer request created successfully');

    return prayer;
  }

  /**
   * Update a prayer request
   * Enforces 5-minute edit window
   */
  async updatePrayer(
    prayerId: string,
    content: string,
    authorId: string
  ): Promise<PrayerRequest> {
    // Validate content
    this.validateContent(content);

    const prayer = await this.prayerRequestRepository.findById(prayerId);

    if (!prayer) {
      throw new PrayerRequestNotFoundError(prayerId);
    }

    // Check if user is the author
    if (prayer.author_id !== authorId) {
      throw new UnauthorizedOperationError('edit this prayer request');
    }

    // Check 5-minute edit window
    const now = new Date();
    const createdAt = prayer.created_at;
    const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    if (minutesSinceCreation > this.EDIT_WINDOW_MINUTES) {
      throw new EditWindowExpiredError(prayerId, this.EDIT_WINDOW_MINUTES);
    }

    logger.info({ prayerId, authorId }, 'Updating prayer request');

    const updateData: UpdatePrayerRequestData = { content };
    const updatedPrayer = await this.prayerRequestRepository.update(prayerId, updateData);

    if (!updatedPrayer) {
      throw new PrayerUpdateFailedError(prayerId);
    }

    logger.info({ prayerId, authorId }, 'Prayer request updated successfully');

    return updatedPrayer;
  }

  /**
   * Get a single prayer request by ID
   * Validates user has access to the wall
   */
  async getPrayer(prayerId: string, userId: string): Promise<PrayerRequest | null> {
    logger.debug({ prayerId, userId }, 'Fetching prayer request');

    const prayer = await this.prayerRequestRepository.findById(prayerId);

    if (!prayer) {
      return null;
    }

    // Verify user has access to the wall
    const isMember = await this.membershipRepository.isMember(prayer.wall_id, userId);
    if (!isMember) {
      throw new WallMembershipRequiredError('view prayer requests', prayer.wall_id);
    }

    return prayer;
  }

  /**
   * List prayer requests for a wall
   * User must be a member to view prayers
   */
  async listPrayers(
    wallId: string,
    userId: string,
    pagination?: CursorPaginationParams
  ): Promise<PrayerRequest[]> {
    // Check if user is a member of the wall
    const isMember = await this.membershipRepository.isMember(wallId, userId);
    if (!isMember) {
      throw new WallMembershipRequiredError('view prayer requests', wallId);
    }

    logger.debug({ wallId, userId, pagination }, 'Listing prayer requests');

    const prayers = await this.prayerRequestRepository.findByWallId(wallId, pagination);

    if (!this.userInfoService || prayers.length === 0) {
      return prayers;
    }

    // Extract author IDs, skip anonymous prayers
    const authorIds = extractUniqueUserIds(prayers, (prayer) =>
      prayer.anonymity_level === AnonymityLevel.FULLY_ANONYMOUS ? [] : [prayer.author_id]
    );

    if (authorIds.length === 0) {
      return prayers;
    }

    const userInfoMap = await this.userInfoService.getBatchUserInfo(authorIds);

    return embedUserInfo(
      prayers,
      userInfoMap,
      (prayer, userMap) => ({
        ...prayer,
        author: prayer.anonymity_level === AnonymityLevel.FULLY_ANONYMOUS ? undefined : userMap.get(prayer.author_id),
      })
    );
  }

  /**
   * Soft-delete a prayer request
   * Validates user is the author
   */
  async softDelete(prayerId: string, deletedBy: string): Promise<boolean> {
    const prayer = await this.prayerRequestRepository.findById(prayerId);

    if (!prayer) {
      throw new PrayerRequestNotFoundError(prayerId);
    }

    // Check authorization (author only)
    if (prayer.author_id !== deletedBy) {
      throw new UnauthorizedOperationError('delete this prayer request');
    }

    logger.info({ prayerId, deletedBy }, 'Soft-deleting prayer request');

    const success = await this.prayerRequestRepository.softDelete(prayerId, deletedBy);

    if (success) {
      logger.info({ prayerId, deletedBy }, 'Prayer request soft-deleted successfully');
    }

    return success;
  }

  /**
   * Restore a soft-deleted prayer request
   * Validates user is the author
   */
  async restore(prayerId: string, restoredBy: string): Promise<boolean> {
    const prayer = await this.prayerRequestRepository.findById(prayerId);

    if (!prayer) {
      throw new PrayerRequestNotFoundError(prayerId);
    }

    // Check authorization (author only)
    if (prayer.author_id !== restoredBy) {
      throw new UnauthorizedOperationError('restore this prayer request');
    }

    logger.info({ prayerId, restoredBy }, 'Restoring prayer request');

    const success = await this.prayerRequestRepository.restore(prayerId);

    if (success) {
      logger.info({ prayerId, restoredBy }, 'Prayer request restored successfully');
    }

    return success;
  }

  /**
   * Add a response to a prayer (creates a threaded reply)
   */
  async addResponse(
    parentId: string,
    content: string,
    authorId: string,
    anonymityLevel?: AnonymityLevel
  ): Promise<PrayerRequest> {
    // First, get the parent prayer to determine the wall
    const parentPrayer = await this.prayerRequestRepository.findById(parentId);

    if (!parentPrayer) {
      throw new PrayerRequestNotFoundError(parentId);
    }

    // Check if parent prayer is deleted
    if (parentPrayer.deleted_at) {
      throw new CannotReplyToDeletedPrayerError(parentId);
    }

    // Create the response with appropriate anonymity level
    return this.createPrayer(
      parentPrayer.wall_id,
      {
        content,
        parent_id: parentId,
        anonymity_level: anonymityLevel ?? parentPrayer.anonymity_level,
      },
      authorId
    );
  }

  /**
   * Validate thread depth for a parent prayer
   */
  async validateThreadDepth(parentId: string | null): Promise<number> {
    return this.prayerRequestRepository.validateThreadDepth(parentId);
  }

  /**
   * List only root prayers (top-level, no parent) for a wall
   * Optimized query that excludes threaded responses for better performance
   * User must be a member to view prayers
   */
  async listRootPrayers(
    wallId: string,
    userId: string,
    pagination?: CursorPaginationParams
  ): Promise<PrayerRequest[]> {
    // Check if user is a member of the wall
    const isMember = await this.membershipRepository.isMember(wallId, userId);
    if (!isMember) {
      throw new WallMembershipRequiredError('view prayer requests', wallId);
    }

    logger.debug({ wallId, userId, pagination }, 'Listing root prayers');

    const prayers = await this.prayerRequestRepository.findRootPrayers(wallId, pagination);

    return prayers;
  }

  /**
   * Get only direct/immediate children of a parent prayer (one level)
   * Optimized for lazy-loading responses without deeper descendants
   * User must have access to the parent prayer's wall
   */
  async getDirectChildren(parentId: string, userId: string): Promise<PrayerRequest[]> {
    // First get the parent to determine the wall
    const parentPrayer = await this.prayerRequestRepository.findById(parentId);

    if (!parentPrayer) {
      throw new PrayerRequestNotFoundError(parentId);
    }

    // Verify user has access to the wall
    const isMember = await this.membershipRepository.isMember(parentPrayer.wall_id, userId);
    if (!isMember) {
      throw new WallMembershipRequiredError('view prayer requests', parentPrayer.wall_id);
    }

    logger.debug({ parentId, userId }, 'Fetching direct children');

    const children = await this.prayerRequestRepository.findDirectChildren(parentId);

    return children;
  }

  /**
   * Get complete thread tree starting from a root prayer
   * Includes root + all nested descendants using recursive query
   * User must have access to the root prayer's wall
   */
  async getFullThread(rootId: string, userId: string): Promise<PrayerRequest[]> {
    // First get the root to determine the wall
    const rootPrayer = await this.prayerRequestRepository.findById(rootId);

    if (!rootPrayer) {
      throw new PrayerRequestNotFoundError(rootId);
    }

    // Verify user has access to the wall
    const isMember = await this.membershipRepository.isMember(rootPrayer.wall_id, userId);
    if (!isMember) {
      throw new WallMembershipRequiredError('view prayer requests', rootPrayer.wall_id);
    }

    logger.debug({ rootId, userId }, 'Fetching full thread tree');

    const thread = await this.prayerRequestRepository.findFullThread(rootId);

    return thread;
  }
}
