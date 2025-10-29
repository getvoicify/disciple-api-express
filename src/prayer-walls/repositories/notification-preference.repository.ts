import type { RawDb } from '../../utils/database';
import type {
  NotificationPreference,
  NotificationPreferences,
} from '../types/prayer-wall.types';

/**
 * Repository interface for Notification Preference data access operations
 */
export interface INotificationPreferenceRepository {
  /**
   * Create notification preferences for a user on a specific wall
   */
  create(
    userId: string,
    wallId: string,
    preferences: NotificationPreferences
  ): Promise<NotificationPreference>;

  /**
   * Update notification preferences for a user on a specific wall
   * Supports partial updates (only provided fields are updated)
   */
  update(
    userId: string,
    wallId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreference | null>;

  /**
   * Find notification preferences for a user on a specific wall
   */
  find(userId: string, wallId: string): Promise<NotificationPreference | null>;

  /**
   * Find all notification preferences for a user across all walls
   */
  findByUser(userId: string): Promise<NotificationPreference[]>;
}

/**
 * PostgreSQL implementation of Notification Preference repository
 * Handles user notification preferences per prayer wall
 */
export class NotificationPreferenceRepository implements INotificationPreferenceRepository {
  constructor(private readonly db: RawDb) {}

  /**
   * Create notification preferences for a user on a specific wall
   */
  async create(
    userId: string,
    wallId: string,
    preferences: NotificationPreferences
  ): Promise<NotificationPreference> {
    return this.db.begin(async (tx) => {
      const id = crypto.randomUUID();
      const now = new Date();

      const result = await tx`
        INSERT INTO notification_preferences (
          id,
          user_id,
          wall_id,
          new_prayers,
          responses_to_my_prayers,
          replies_to_my_responses,
          wall_invitations,
          moderation_actions,
          created_at,
          updated_at
        )
        VALUES (
          ${id},
          ${userId},
          ${wallId},
          ${preferences.new_prayers},
          ${preferences.responses_to_my_prayers},
          ${preferences.replies_to_my_responses},
          ${preferences.wall_invitations},
          ${preferences.moderation_actions},
          ${now},
          ${now}
        )
        RETURNING *
      `;

      return this.mapRowToPreference(result[0]);
    });
  }

  /**
   * Update notification preferences for a user on a specific wall
   * Supports partial updates
   */
  async update(
    userId: string,
    wallId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreference | null> {
    return this.db.begin(async (tx) => {
      // If no data to update, just return the current preferences
      if (Object.keys(preferences).length === 0) {
        return this.find(userId, wallId);
      }

      // Build update fields dynamically
      const updateFields: Record<string, any> = {};

      if (preferences.new_prayers !== undefined) {
        updateFields.new_prayers = preferences.new_prayers;
      }
      if (preferences.responses_to_my_prayers !== undefined) {
        updateFields.responses_to_my_prayers = preferences.responses_to_my_prayers;
      }
      if (preferences.replies_to_my_responses !== undefined) {
        updateFields.replies_to_my_responses = preferences.replies_to_my_responses;
      }
      if (preferences.wall_invitations !== undefined) {
        updateFields.wall_invitations = preferences.wall_invitations;
      }
      if (preferences.moderation_actions !== undefined) {
        updateFields.moderation_actions = preferences.moderation_actions;
      }

      // Always update the updated_at timestamp
      updateFields.updated_at = new Date();

      // Build SET clause dynamically
      const setClause = Object.keys(updateFields)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');

      const values = Object.values(updateFields);
      values.push(userId, wallId); // Add user_id and wall_id for WHERE clause

      const query = `
        UPDATE notification_preferences
        SET ${setClause}
        WHERE user_id = $${values.length - 1}
          AND wall_id = $${values.length}
        RETURNING *
      `;

      const result = await tx.unsafe(query, values);

      if (result.length === 0) {
        return null;
      }

      return this.mapRowToPreference(result[0]);
    });
  }

  /**
   * Find notification preferences for a user on a specific wall
   */
  async find(userId: string, wallId: string): Promise<NotificationPreference | null> {
    const result = await this.db`
      SELECT *
      FROM notification_preferences
      WHERE user_id = ${userId}
        AND wall_id = ${wallId}
    `;

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToPreference(result[0]);
  }

  /**
   * Find all notification preferences for a user across all walls
   */
  async findByUser(userId: string): Promise<NotificationPreference[]> {
    const result = await this.db`
      SELECT *
      FROM notification_preferences
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return result.map((row) => this.mapRowToPreference(row));
  }

  /**
   * Map database row to NotificationPreference domain model
   */
  private mapRowToPreference(row: any): NotificationPreference {
    return {
      id: row.id,
      user_id: row.user_id,
      wall_id: row.wall_id,
      new_prayers: row.new_prayers || false,
      responses_to_my_prayers: row.responses_to_my_prayers || false,
      replies_to_my_responses: row.replies_to_my_responses || false,
      wall_invitations: row.wall_invitations || false,
      moderation_actions: row.moderation_actions || false,
      created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    };
  }
}
