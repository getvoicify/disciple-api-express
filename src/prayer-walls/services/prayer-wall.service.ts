import type { IPrayerWallRepository } from '../repositories/prayer-wall.repository';
import type { IPrayerWallMembershipRepository } from '../repositories/prayer-wall-membership.repository';
import type { CacheRepository } from '../../cache';
import type { ChurchMembershipService } from '../../churches/membership-service';
import type {
  PrayerWall,
  CreatePrayerWallData,
  UpdatePrayerWallData,
  PrayerWallMembership,
  PaginationParams,
} from '../types/prayer-wall.types';
import { logger } from '../../logging';
import type { UserInfoService } from '../../user-info/service';
import type { ChurchInfoService } from '../../church-info/service';
import { extractUniqueUserIds, embedUserInfo } from '../../user-info/embedding.util';
import { extractUniqueChurchIds, embedChurchInfo } from '../../church-info/embedding.util';
import {
  PrayerWallNotFoundError,
  NotChurchMemberError,
  InactiveMembershipError,
  InsufficientChurchRoleError,
  BannedFromWallError,
  PrivateWallInvitationRequiredError,
  WallCreatorOnlyError,
  WallUpdateFailedError,
  WallMembershipRequiredError,
  ChurchIdMismatchError,
} from '../errors';

/**
 * Service interface for managing prayer walls
 */
export interface IPrayerWallService {
  createWall(data: CreatePrayerWallData, creatorId: string, churchId: string): Promise<PrayerWall>;
  updateWall(wallId: string, data: UpdatePrayerWallData, userId: string): Promise<PrayerWall>;
  getWall(wallId: string, userId: string): Promise<PrayerWall | null>;
  listWalls(churchId: string, userId: string, pagination: PaginationParams): Promise<PrayerWall[]>;
  joinWall(wallId: string, userId: string, invitedBy?: string): Promise<PrayerWallMembership>;
  leaveWall(wallId: string, userId: string): Promise<boolean>;
  inviteMember(wallId: string, userId: string, invitedBy: string, churchId: string): Promise<PrayerWallMembership>;
  removeMember(wallId: string, userId: string, removedBy: string, churchId: string): Promise<boolean>;
  banUser(wallId: string, userId: string, bannedBy: string, churchId: string): Promise<boolean>;
  listMembers(wallId: string, userId: string): Promise<PrayerWallMembership[]>;
  archiveWall(wallId: string, userId: string): Promise<boolean>;
}

/**
 * Service for managing prayer walls with business logic enforcement
 * Handles permission checks, caching, and wall membership
 */
export class PrayerWallService implements IPrayerWallService {
  private readonly WALL_CACHE_TTL = 60; // 1 minute
  private readonly MEMBERSHIP_CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly wallRepository: IPrayerWallRepository,
    private readonly membershipRepository: IPrayerWallMembershipRepository,
    private readonly cacheRepository: CacheRepository,
    private readonly churchMembershipService: ChurchMembershipService,
    private readonly userInfoService?: UserInfoService,
    private readonly churchInfoService?: ChurchInfoService
  ) {}

  /**
   * Create a new prayer wall
   * Only church owners and managers can create walls
   * Only owners can create private walls
   */
  async createWall(
    data: CreatePrayerWallData,
    creatorId: string,
    churchId: string
  ): Promise<PrayerWall> {
    // Validate that data.church_id matches the churchId parameter to prevent authorization bypass
    if (data.church_id !== churchId) {
      throw new ChurchIdMismatchError(churchId, data.church_id);
    }

    // Get user's church membership to check permissions
    const membership = await this.churchMembershipService.getMembershipByUserAndChurch(
      creatorId,
      churchId
    );

    if (!membership) {
      throw new NotChurchMemberError(creatorId, churchId);
    }

    if (membership.status !== 'Active') {
      throw new InactiveMembershipError(membership.status);
    }

    // Check if user has permission to create walls (Owner or Manager)
    if (membership.role !== 'Owner' && membership.role !== 'Manager') {
      throw new InsufficientChurchRoleError(['Owner', 'Manager'], membership.role);
    }

    // Only owners can create private walls
    if (data.is_private && membership.role !== 'Owner') {
      throw new InsufficientChurchRoleError(['Owner'], membership.role);
    }

    logger.info(
      { churchId: data.church_id, creatorId, wallName: data.name },
      'Creating prayer wall'
    );

    const wall = await this.wallRepository.create({
      ...data,
      created_by: creatorId,
    });

    logger.info({ wallId: wall.id, creatorId }, 'Prayer wall created successfully');

    return wall;
  }

  /**
   * Update a prayer wall
   * Only the wall creator can edit wall details
   */
  async updateWall(
    wallId: string,
    data: UpdatePrayerWallData,
    userId: string
  ): Promise<PrayerWall> {
    // Find the wall to check ownership
    const wall = await this.wallRepository.findById(wallId);

    if (!wall) {
      throw new PrayerWallNotFoundError(wallId);
    }

    // Check if user is the creator
    if (wall.created_by !== userId) {
      throw new WallCreatorOnlyError('edit wall details', wallId);
    }

    logger.info({ wallId, userId, updates: Object.keys(data) }, 'Updating prayer wall');

    const updatedWall = await this.wallRepository.update(wallId, data);

    if (!updatedWall) {
      throw new WallUpdateFailedError(wallId);
    }

    // Invalidate wall cache
    await this.cacheRepository.delete(`wall:${wallId}`);

    logger.info({ wallId, userId }, 'Prayer wall updated successfully');

    return updatedWall;
  }

  /**
   * Archive a prayer wall (soft delete)
   * Only the wall creator can archive their wall
   */
  async archiveWall(wallId: string, userId: string): Promise<boolean> {
    // Find the wall to check ownership
    const wall = await this.wallRepository.findById(wallId);

    if (!wall) {
      throw new PrayerWallNotFoundError(wallId);
    }

    // Check if user is the creator
    if (wall.created_by !== userId) {
      throw new WallCreatorOnlyError('archive this wall', wallId);
    }

    logger.info({ wallId, userId }, 'Archiving prayer wall');

    const success = await this.wallRepository.softDelete(wallId);

    if (success) {
      // Invalidate wall cache
      await this.cacheRepository.delete(`wall:${wallId}`);
      logger.info({ wallId, userId }, 'Prayer wall archived successfully');
    }

    return success;
  }

  /**
   * Get a prayer wall by ID
   * Uses caching with 1-minute TTL
   */
  async getWall(wallId: string, userId: string): Promise<PrayerWall | null> {
    // Try to get from cache first
    const cacheKey = `wall:${wallId}`;
    const cached = await this.cacheRepository.read<PrayerWall>(cacheKey);

    if (cached) {
      logger.debug({ wallId, userId }, 'Cache hit for prayer wall');

      // Check access to private walls
      if (cached.is_private) {
        const isMember = await this.isMemberCached(cached.id, userId);
        if (!isMember) {
          throw new WallMembershipRequiredError('view this wall', wallId);
        }
      }

      return cached;
    }

    // Fetch from database
    const wall = await this.wallRepository.findById(wallId);

    if (wall) {
      // Check access to private walls
      if (wall.is_private) {
        const isMember = await this.isMemberCached(wall.id, userId);
        if (!isMember) {
          throw new WallMembershipRequiredError('view this wall', wallId);
        }
      }

      // Cache for 1 minute
      await this.cacheRepository.write(cacheKey, wall, this.WALL_CACHE_TTL);
      logger.debug({ wallId, userId }, 'Cached prayer wall');
    }

    return wall;
  }

  /**
   * List prayer walls for a church
   * Filters private walls based on user membership
   */
  async listWalls(
    churchId: string,
    userId: string,
    pagination: PaginationParams
  ): Promise<PrayerWall[]> {
    logger.debug({ churchId, userId, pagination }, 'Listing prayer walls');

    // Get all walls for the church
    const walls = await this.wallRepository.findByChurchId(churchId, pagination);

    // Filter out private walls that user is not a member of
    const accessibleWalls = await Promise.all(
      walls.map(async (wall: PrayerWall) => {
        // Public walls are always visible
        if (!wall.is_private) {
          return wall;
        }

        // For private walls, check membership
        const isMember = await this.isMemberCached(wall.id, userId);
        return isMember ? wall : null;
      })
    );

    // Remove null entries (private walls user is not member of)
    let filteredWalls = accessibleWalls.filter((wall): wall is PrayerWall => wall !== null);

    // Embed church info if service is available
    if (this.churchInfoService && filteredWalls.length > 0) {
      const churchIds = extractUniqueChurchIds(filteredWalls, (wall) => [wall.church_id]);
      const churchInfoMap = await this.churchInfoService.getBatchChurchInfo(churchIds);

      filteredWalls = embedChurchInfo(
        filteredWalls,
        churchInfoMap,
        (wall, churchMap) => ({
          ...wall,
          church: churchMap.get(wall.church_id),
        })
      );
    }

    return filteredWalls;
  }

  /**
   * Join a prayer wall
   * Validates membership eligibility (not banned, not private without invitation)
   */
  async joinWall(
    wallId: string,
    userId: string,
    invitedBy?: string
  ): Promise<PrayerWallMembership> {
    const wall = await this.wallRepository.findById(wallId);

    if (!wall) {
      throw new PrayerWallNotFoundError(wallId);
    }

    // Check if user is banned
    const isBanned = await this.membershipRepository.isBanned(wallId, userId);
    if (isBanned) {
      throw new BannedFromWallError(userId, wallId);
    }

    // Private walls require invitation
    if (wall.is_private && !invitedBy) {
      throw new PrivateWallInvitationRequiredError(wallId);
    }

    logger.info({ wallId, userId, invitedBy }, 'User joining prayer wall');

    const membership = await this.membershipRepository.join(wallId, userId, invitedBy);

    // Invalidate membership cache
    await this.cacheRepository.delete(`membership:${wallId}:${userId}`);

    logger.info({ wallId, userId }, 'User joined prayer wall successfully');

    return membership;
  }

  /**
   * Leave a prayer wall
   */
  async leaveWall(wallId: string, userId: string): Promise<boolean> {
    logger.info({ wallId, userId }, 'User leaving prayer wall');

    const success = await this.membershipRepository.leave(wallId, userId);

    if (success) {
      // Invalidate membership cache
      await this.cacheRepository.delete(`membership:${wallId}:${userId}`);
      logger.info({ wallId, userId }, 'User left prayer wall successfully');
    }

    return success;
  }

  /**
   * Invite a member to a prayer wall
   * Only church owners/managers and wall creators can invite
   */
  async inviteMember(
    wallId: string,
    userId: string,
    invitedBy: string,
    churchId: string
  ): Promise<PrayerWallMembership> {
    const wall = await this.wallRepository.findById(wallId);

    if (!wall) {
      throw new PrayerWallNotFoundError(wallId);
    }

    // Get inviter's church membership to check permissions
    const membership = await this.churchMembershipService.getMembershipByUserAndChurch(
      invitedBy,
      churchId
    );

    if (!membership) {
      throw new NotChurchMemberError(invitedBy, churchId);
    }

    if (membership.status !== 'Active') {
      throw new InactiveMembershipError(membership.status);
    }

    // Check if inviter has permission (Owner/Manager or wall creator)
    const canInvite =
      membership.role === 'Owner' ||
      membership.role === 'Manager' ||
      wall.created_by === invitedBy;

    if (!canInvite) {
      throw new InsufficientChurchRoleError(['Owner', 'Manager'], membership.role);
    }

    logger.info({ wallId, userId, invitedBy }, 'Inviting member to prayer wall');

    // Join with invitation
    return this.joinWall(wallId, userId, invitedBy);
  }

  /**
   * Remove a member from a prayer wall
   * Only church owners and managers can remove members
   */
  async removeMember(
    wallId: string,
    userId: string,
    removedBy: string,
    churchId: string
  ): Promise<boolean> {
    // Get remover's church membership to check permissions
    const membership = await this.churchMembershipService.getMembershipByUserAndChurch(
      removedBy,
      churchId
    );

    if (!membership) {
      throw new NotChurchMemberError(removedBy, churchId);
    }

    if (membership.status !== 'Active') {
      throw new InactiveMembershipError(membership.status);
    }

    // Only Owners and Managers can remove members
    if (membership.role !== 'Owner' && membership.role !== 'Manager') {
      throw new InsufficientChurchRoleError(['Owner', 'Manager'], membership.role);
    }

    logger.info({ wallId, userId, removedBy }, 'Removing member from prayer wall');

    const success = await this.membershipRepository.removeMember(wallId, userId);

    if (success) {
      // Invalidate membership cache
      await this.cacheRepository.delete(`membership:${wallId}:${userId}`);
      logger.info({ wallId, userId, removedBy }, 'Member removed successfully');
    }

    return success;
  }

  /**
   * Ban a user from a prayer wall
   * Only church owners and managers can ban users
   */
  async banUser(
    wallId: string,
    userId: string,
    bannedBy: string,
    churchId: string
  ): Promise<boolean> {
    // Get banner's church membership to check permissions
    const membership = await this.churchMembershipService.getMembershipByUserAndChurch(
      bannedBy,
      churchId
    );

    if (!membership) {
      throw new NotChurchMemberError(bannedBy, churchId);
    }

    if (membership.status !== 'Active') {
      throw new InactiveMembershipError(membership.status);
    }

    // Only Owners and Managers can ban users
    if (membership.role !== 'Owner' && membership.role !== 'Manager') {
      throw new InsufficientChurchRoleError(['Owner', 'Manager'], membership.role);
    }

    logger.info({ wallId, userId, bannedBy }, 'Banning user from prayer wall');

    const success = await this.membershipRepository.ban(wallId, userId, bannedBy);

    if (success) {
      // Invalidate membership cache
      await this.cacheRepository.delete(`membership:${wallId}:${userId}`);
      logger.info({ wallId, userId, bannedBy }, 'User banned successfully');
    }

    return success;
  }

  /**
   * List all members of a prayer wall
   * Only wall members can view the member list
   */
  async listMembers(wallId: string, userId: string): Promise<PrayerWallMembership[]> {
    // Verify wall exists
    const wall = await this.wallRepository.findById(wallId);

    if (!wall) {
      throw new PrayerWallNotFoundError(wallId);
    }

    // Check if requesting user is a member (only members can see member list)
    const isMember = await this.membershipRepository.isMember(wallId, userId);

    if (!isMember) {
      throw new WallMembershipRequiredError('view the member list', wallId);
    }

    logger.debug({ wallId, userId }, 'Listing prayer wall members');

    // Get all active members
    const members = await this.membershipRepository.findMembers(wallId);

    logger.debug({ wallId, memberCount: members.length }, 'Retrieved prayer wall members');

    // Embed user info if service is available
    if (!this.userInfoService || members.length === 0) {
      return members;
    }

    const userIds = extractUniqueUserIds(members, (member) => [member.user_id]);
    const userInfoMap = await this.userInfoService.getBatchUserInfo(userIds);

    return embedUserInfo(
      members,
      userInfoMap,
      (member, userMap) => ({
        ...member,
        user: userMap.get(member.user_id),
      })
    );
  }

  /**
   * Check if user is a member of a wall (with caching)
   * Uses 5-minute TTL cache for membership checks
   */
  private async isMemberCached(wallId: string, userId: string): Promise<boolean> {
    const cacheKey = `membership:${wallId}:${userId}`;
    const cached = await this.cacheRepository.read<boolean>(cacheKey);

    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const isMember = await this.membershipRepository.isMember(wallId, userId);

    // Cache for 5 minutes
    await this.cacheRepository.write(cacheKey, isMember, this.MEMBERSHIP_CACHE_TTL);

    return isMember;
  }
}
