import type { RawDb } from '../../utils/database';
import type { PrayerWallMembership } from '../types/prayer-wall.types';

/**
 * Interface for PrayerWallMembership repository operations
 * Manages user memberships in prayer walls including join/leave, invitations, and bans
 */
export interface IPrayerWallMembershipRepository {
  join(wallId: string, userId: string, invitedBy?: string): Promise<PrayerWallMembership>;
  leave(wallId: string, userId: string): Promise<boolean>;
  isMember(wallId: string, userId: string): Promise<boolean>;
  findMembers(wallId: string): Promise<PrayerWallMembership[]>;
  removeMember(wallId: string, userId: string): Promise<boolean>;
  ban(wallId: string, userId: string, bannedBy: string): Promise<boolean>;
  unban(wallId: string, userId: string): Promise<boolean>;
  isBanned(wallId: string, userId: string): Promise<boolean>;
}

/**
 * Repository for managing prayer wall memberships
 * Handles join/leave operations, invitation tracking, and ban management
 */
export class PrayerWallMembershipRepository implements IPrayerWallMembershipRepository {
  constructor(private readonly db: RawDb) {}

  /**
   * Join a prayer wall (or rejoin after leaving)
   * If user previously left, clears left_at to reactivate membership
   * If user is banned, throws error
   */
  async join(wallId: string, userId: string, invitedBy?: string): Promise<PrayerWallMembership> {
    return this.db.begin(async (tx) => {
      const now = new Date();

      // Check if membership already exists
      const existing = await tx`
        SELECT *
        FROM prayer_wall_memberships
        WHERE wall_id = ${wallId}
          AND user_id = ${userId}
      `;

      if (existing.length > 0) {
        const membership = existing[0];

        // If banned, cannot rejoin
        if (membership.is_banned) {
          throw new Error('User is banned from this prayer wall');
        }

        // If already active member, return existing
        if (!membership.left_at) {
          return this.mapRowToMembership(membership);
        }

        // Rejoin - clear left_at
        const result = await tx`
          UPDATE prayer_wall_memberships
          SET left_at = NULL,
              updated_at = ${now}
          WHERE wall_id = ${wallId}
            AND user_id = ${userId}
          RETURNING *
        `;

        return this.mapRowToMembership(result[0]);
      }

      // New membership
      const id = crypto.randomUUID();
      const invitedByValue = invitedBy !== undefined ? invitedBy : null;

      const result = await tx`
        INSERT INTO prayer_wall_memberships (
          id,
          wall_id,
          user_id,
          joined_at,
          invited_by,
          created_at,
          updated_at
        )
        VALUES (
          ${id},
          ${wallId},
          ${userId},
          ${now},
          ${invitedByValue},
          ${now},
          ${now}
        )
        RETURNING *
      `;

      return this.mapRowToMembership(result[0]);
    });
  }

  /**
   * Leave a prayer wall by setting left_at timestamp
   * Does not delete the record (maintains history)
   */
  async leave(wallId: string, userId: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const now = new Date();

      const result = await tx`
        UPDATE prayer_wall_memberships
        SET left_at = ${now},
            updated_at = ${now}
        WHERE wall_id = ${wallId}
          AND user_id = ${userId}
          AND left_at IS NULL
        RETURNING id
      `;

      return result.length > 0;
    });
  }

  /**
   * Check if user is an active member
   * Returns true only if joined, not left, and not banned
   */
  async isMember(wallId: string, userId: string): Promise<boolean> {
    const result = await this.db`
      SELECT id
      FROM prayer_wall_memberships
      WHERE wall_id = ${wallId}
        AND user_id = ${userId}
        AND left_at IS NULL
        AND is_banned = false
    `;

    return result.length > 0;
  }

  /**
   * Find all active members of a prayer wall
   * Excludes users who have left or are banned
   */
  async findMembers(wallId: string): Promise<PrayerWallMembership[]> {
    const result = await this.db`
      SELECT *
      FROM prayer_wall_memberships
      WHERE wall_id = ${wallId}
        AND left_at IS NULL
        AND is_banned = false
      ORDER BY joined_at ASC
    `;

    return result.map((row) => this.mapRowToMembership(row));
  }

  /**
   * Remove a member from a wall (admin action)
   * Sets left_at timestamp, similar to leave()
   * Note: removedBy tracking would require a database migration to add removed_by column
   */
  async removeMember(wallId: string, userId: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const now = new Date();

      const result = await tx`
        UPDATE prayer_wall_memberships
        SET left_at = ${now},
            updated_at = ${now}
        WHERE wall_id = ${wallId}
          AND user_id = ${userId}
          AND left_at IS NULL
        RETURNING id
      `;

      return result.length > 0;
    });
  }

  /**
   * Ban a user from a prayer wall
   * Sets is_banned flag, banned_at, and banned_by
   */
  async ban(wallId: string, userId: string, bannedBy: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const now = new Date();

      const result = await tx`
        UPDATE prayer_wall_memberships
        SET is_banned = true,
            banned_at = ${now},
            banned_by = ${bannedBy},
            updated_at = ${now}
        WHERE wall_id = ${wallId}
          AND user_id = ${userId}
        RETURNING id
      `;

      return result.length > 0;
    });
  }

  /**
   * Unban a user from a prayer wall
   * Clears is_banned flag (keeps banned_at/banned_by for history)
   */
  async unban(wallId: string, userId: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const now = new Date();

      const result = await tx`
        UPDATE prayer_wall_memberships
        SET is_banned = false,
            updated_at = ${now}
        WHERE wall_id = ${wallId}
          AND user_id = ${userId}
          AND is_banned = true
        RETURNING id
      `;

      return result.length > 0;
    });
  }

  /**
   * Check if user is banned from a prayer wall
   */
  async isBanned(wallId: string, userId: string): Promise<boolean> {
    const result = await this.db`
      SELECT id
      FROM prayer_wall_memberships
      WHERE wall_id = ${wallId}
        AND user_id = ${userId}
        AND is_banned = true
    `;

    return result.length > 0;
  }

  /**
   * Map database row to PrayerWallMembership domain model
   */
  private mapRowToMembership(row: any): PrayerWallMembership {
    return {
      id: row.id,
      wall_id: row.wall_id,
      user_id: row.user_id,
      joined_at: row.joined_at instanceof Date ? row.joined_at : new Date(row.joined_at),
      invited_by: row.invited_by,
      left_at: row.left_at
        ? row.left_at instanceof Date
          ? row.left_at
          : new Date(row.left_at)
        : null,
      is_banned: row.is_banned || false,
      banned_at: row.banned_at
        ? row.banned_at instanceof Date
          ? row.banned_at
          : new Date(row.banned_at)
        : null,
      banned_by: row.banned_by,
      created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    };
  }
}
