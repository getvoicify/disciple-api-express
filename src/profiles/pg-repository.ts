import type { RawDb } from '../utils/database';
import type { ProfileRepository } from './repository';
import type { CreateProfileInput, UpdateProfileInput, Profile, ProfileStatistics, CachedMetrics } from './schemas';
import { logger } from '../logging';
import { safeExecute } from '../utils/handle-async';

export class PostgresProfileRepository implements ProfileRepository {
  constructor(private readonly db: RawDb) {}

  async create(userId: string, input: CreateProfileInput): Promise<Profile> {
    return this.db.begin(async (tx) => {
      const now = new Date();

      const result = await tx`
        INSERT INTO user_profiles (
          user_id,
          bio,
          testimony,
          profile_photo_media_id,
          privacy_mode,
          field_visibility_settings,
          notification_preferences,
          preferred_devotional_time,
          first_name,
          last_name,
          display_name,
          avatar_url,
          email,
          created_at,
          updated_at
        )
        VALUES (
          ${userId},
          ${input.bio || null},
          ${input.testimony || null},
          ${input.profilePhotoMediaId || null},
          ${input.privacyMode || 'church_only'},
          ${JSON.stringify(input.fieldVisibilitySettings || {})},
          ${JSON.stringify(input.notificationPreferences || {})},
          ${input.preferredDevotionalTime || null},
          ${input.firstName || null},
          ${input.lastName || null},
          ${input.displayName || null},
          ${input.avatarUrl || null},
          ${input.email || null},
          ${now},
          ${now}
        )
        RETURNING *
      `;

      if (result.length === 0) {
        logger.error({ userId }, 'Failed to create profile');
        throw new Error('Failed to create profile');
      }

      return this.mapRowToProfile(result[0]);
    });
  }

  async findById(
    userId: string,
    requestingUserId: string,
    requestingUserRole?: string
  ): Promise<Profile | null> {
    const result = await this.db`
      SELECT * FROM user_profiles WHERE user_id = ${userId}
    `;

    if (result.length === 0) {
      return null;
    }

    const profile = result[0];

    // Check church membership for 'church_only' privacy mode
    let hasSharedChurch = false;
    if (profile.privacy_mode === 'church_only' &&
        userId !== requestingUserId &&
        requestingUserRole !== 'pastor' &&
        requestingUserRole !== 'admin') {
      const [error, sharedChurches] = await safeExecute(
        this.db<Array<{ church_id: string }>>`
          SELECT cm1.church_id
          FROM church_memberships cm1
          INNER JOIN church_memberships cm2 ON cm1.church_id = cm2.church_id
          WHERE cm1.user_id = ${userId}
            AND cm2.user_id = ${requestingUserId}
            AND cm1.left_at IS NULL
            AND cm2.left_at IS NULL
        `
      );

      if (error) {
        logger.error(
          { error, userId, requestingUserId },
          'Error checking church membership'
        );
        return null;
      }

      hasSharedChurch = sharedChurches && sharedChurches.length > 0;
    }

    // Privacy enforcement
    const canAccess = this.canAccessProfile(
      profile,
      userId,
      requestingUserId,
      requestingUserRole,
      hasSharedChurch
    );

    if (!canAccess) {
      logger.warn(
        { userId, requestingUserId, privacyMode: profile.privacy_mode },
        'Access denied to profile due to privacy settings'
      );
      return null;
    }

    return this.mapRowToProfile(profile);
  }

  async findByIds(userIds: string[]): Promise<Profile[]> {
    if (userIds.length === 0) {
      return [];
    }

    const result = await this.db`
      SELECT * FROM user_profiles WHERE user_id = ANY(${userIds})
    `;

    return result.map(row => this.mapRowToProfile(row));
  }

  async update(userId: string, input: UpdateProfileInput): Promise<Profile | null> {
    return this.db.begin(async (tx) => {
      if (Object.keys(input).length === 0) {
        return this.findById(userId, userId);
      }

      const updateFields: Record<string, any> = {};

      if (input.bio !== undefined) {
        updateFields.bio = input.bio;
      }
      if (input.testimony !== undefined) {
        updateFields.testimony = input.testimony;
      }
      if (input.profilePhotoMediaId !== undefined) {
        updateFields.profile_photo_media_id = input.profilePhotoMediaId;
      }
      if (input.privacyMode !== undefined) {
        updateFields.privacy_mode = input.privacyMode;
      }
      if (input.fieldVisibilitySettings !== undefined) {
        updateFields.field_visibility_settings = JSON.stringify(input.fieldVisibilitySettings);
      }
      if (input.notificationPreferences !== undefined) {
        updateFields.notification_preferences = JSON.stringify(input.notificationPreferences);
      }
      if (input.preferredDevotionalTime !== undefined) {
        updateFields.preferred_devotional_time = input.preferredDevotionalTime;
      }
      if (input.firstName !== undefined) {
        updateFields.first_name = input.firstName;
      }
      if (input.lastName !== undefined) {
        updateFields.last_name = input.lastName;
      }
      if (input.displayName !== undefined) {
        updateFields.display_name = input.displayName;
      }
      if (input.avatarUrl !== undefined) {
        updateFields.avatar_url = input.avatarUrl;
      }
      if (input.email !== undefined) {
        updateFields.email = input.email;
      }

      updateFields.updated_at = new Date();

      const setClause = Object.keys(updateFields)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');
      const values = Object.values(updateFields);
      values.push(userId);

      const result = await tx.unsafe(
        `UPDATE user_profiles SET ${setClause} WHERE user_id = $${values.length} RETURNING *`,
        values
      );

      if (result.length === 0) {
        return null;
      }

      return this.mapRowToProfile(result[0]);
    });
  }

  async delete(userId: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const result = await tx`
        DELETE FROM user_profiles WHERE user_id = ${userId} RETURNING user_id
      `;

      return result.length > 0;
    });
  }

  async getStatistics(userId: string): Promise<ProfileStatistics> {
    // Query notes count
    const notesResult = await this.db`
      SELECT COUNT(*)::int as count FROM notes WHERE user_id = ${userId}
    `;
    const notesCount = notesResult.length > 0 ? parseInt(notesResult[0].count, 10) : 0;

    // Query prayers count (from prayer_requests)
    const prayersResult = await this.db`
      SELECT COUNT(*)::int as count FROM prayer_requests WHERE author_id = ${userId}
    `;
    const prayersCount = prayersResult.length > 0 ? parseInt(prayersResult[0].count, 10) : 0;

    // Query devotionals count (assuming we track this via posts or similar)
    // This is a placeholder - adjust based on actual devotional tracking
    const devotionalsResult = await this.db`
      SELECT COUNT(*)::int as count FROM posts WHERE author_id = ${userId}
    `;
    const devotionalsCount = devotionalsResult.length > 0 ? parseInt(devotionalsResult[0].count, 10) : 0;

    return {
      notesCount,
      prayersCount,
      devotionalsCount,
    };
  }

  async getCachedMetrics(userId: string): Promise<CachedMetrics | null> {
    const result = await this.db`
      SELECT cached_metrics FROM user_profiles WHERE user_id = ${userId}
    `;

    if (result.length === 0) {
      return null;
    }

    const metrics = result[0].cached_metrics;

    // Safely parse if string
    if (typeof metrics === 'string') {
      const [parseError, parsed] = await safeExecute(() => JSON.parse(metrics));
      if (parseError) {
        logger.error({ error: parseError, userId }, 'Failed to parse cached metrics');
        return null;
      }
      return parsed;
    }

    return metrics;
  }

  async updateCachedMetrics(userId: string, metrics: CachedMetrics): Promise<Profile | null> {
    return this.db.begin(async (tx) => {
      const result = await tx`
        UPDATE user_profiles
        SET cached_metrics = ${JSON.stringify(metrics)},
            updated_at = ${new Date()}
        WHERE user_id = ${userId}
        RETURNING *
      `;

      if (result.length === 0) {
        return null;
      }

      return this.mapRowToProfile(result[0]);
    });
  }

  /**
   * Check if the requesting user can access a profile based on privacy settings
   */
  private canAccessProfile(
    profile: any,
    profileUserId: string,
    requestingUserId: string,
    requestingUserRole?: string,
    hasSharedChurch: boolean = false
  ): boolean {
    // User can always access their own profile
    if (profileUserId === requestingUserId) {
      return true;
    }

    // Pastors can view all profiles (regardless of privacy mode)
    if (requestingUserRole === 'pastor' || requestingUserRole === 'admin') {
      return true;
    }

    // Check privacy mode
    const privacyMode = profile.privacy_mode;

    if (privacyMode === 'public') {
      return true;
    }

    if (privacyMode === 'church_only') {
      // Allow access only if users share a church
      return hasSharedChurch;
    }

    if (privacyMode === 'private') {
      return false;
    }

    return false;
  }

  /**
   * Map database row to Profile object
   * Uses safeExecute to handle JSON parsing errors gracefully
   */
  private mapRowToProfile(row: any): Profile {
    // Safely parse field_visibility_settings
    let fieldVisibilitySettings = {};
    if (row.field_visibility_settings) {
      if (typeof row.field_visibility_settings === 'string') {
        try {
          fieldVisibilitySettings = JSON.parse(row.field_visibility_settings);
        } catch (error) {
          logger.warn({ error, userId: row.user_id }, 'Failed to parse field_visibility_settings');
        }
      } else {
        fieldVisibilitySettings = row.field_visibility_settings;
      }
    }

    // Safely parse cached_metrics
    let cachedMetrics = {};
    if (row.cached_metrics) {
      if (typeof row.cached_metrics === 'string') {
        try {
          cachedMetrics = JSON.parse(row.cached_metrics);
        } catch (error) {
          logger.warn({ error, userId: row.user_id }, 'Failed to parse cached_metrics');
        }
      } else {
        cachedMetrics = row.cached_metrics;
      }
    }

    // Safely parse notification_preferences
    let notificationPreferences = {};
    if (row.notification_preferences) {
      if (typeof row.notification_preferences === 'string') {
        try {
          notificationPreferences = JSON.parse(row.notification_preferences);
        } catch (error) {
          logger.warn({ error, userId: row.user_id }, 'Failed to parse notification_preferences');
        }
      } else {
        notificationPreferences = row.notification_preferences;
      }
    }

    return {
      userId: row.user_id,
      bio: row.bio || null,
      testimony: row.testimony || null,
      profilePhotoMediaId: row.profile_photo_media_id || null,
      privacyMode: row.privacy_mode,
      fieldVisibilitySettings,
      cachedMetrics,
      notificationPreferences,
      preferredDevotionalTime: row.preferred_devotional_time || null,
      firstName: row.first_name || null,
      lastName: row.last_name || null,
      displayName: row.display_name || null,
      avatarUrl: row.avatar_url || null,
      email: row.email || null,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    };
  }
}
