import type { ProfileRepository } from './repository';
import type { CreateProfileInput, UpdateProfileInput, Profile, ProfileStatistics } from './schemas';
import { CreateProfileInput as CreateProfileSchema, UpdateProfileInput as UpdateProfileSchema } from './schemas';
import { ProfileNotFoundError, ProfileUnauthorizedError } from './errors';
import type { KeycloakAdminClient } from '../keycloak/types';
import type { CacheRepository } from '../cache';
import type { RawDb } from '../utils/database';
import { safeExecute } from '../utils/handle-async';
import { logger } from '../logging';

/**
 * Dashboard data structure
 */
export interface DashboardData {
  recentNotes: Array<{
    id: string;
    title: string | null;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  activePrayerRequests: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  devotionalProgress: Array<{
    seriesId: string;
    seriesName: string;
    postId: string;
    postTitle: string;
    publishedAt: Date;
  }>;
  statistics: ProfileStatistics;
}

/**
 * Profile service interface
 */
export interface ProfileService {
  /**
   * Create a new profile with Keycloak data sync
   * @param userId - The user ID from Keycloak
   * @param input - Profile creation data
   * @returns The created profile
   */
  createProfile(userId: string, input: CreateProfileInput): Promise<Profile>;

  /**
   * Update an existing profile and invalidate cache
   * @param userId - The user ID
   * @param requestingUserId - The user ID of the requester (must match userId)
   * @param input - Profile update data
   * @returns The updated profile
   * @throws ProfileUnauthorizedError if requestingUserId !== userId
   */
  updateProfile(userId: string, requestingUserId: string, input: UpdateProfileInput): Promise<Profile>;

  /**
   * Get a profile with privacy enforcement and caching
   * @param userId - The user ID of the profile to fetch
   * @param requestingUserId - The user ID of the requester
   * @returns The profile if accessible
   * @throws ProfileNotFoundError if profile not found or access denied
   */
  getProfile(userId: string, requestingUserId: string): Promise<Profile>;

  /**
   * Get user statistics with caching
   * @param userId - The user ID
   * @returns Profile statistics
   */
  getStatistics(userId: string): Promise<ProfileStatistics>;

  /**
   * Get user dashboard data aggregated from multiple sources
   * @param userId - The user ID
   * @param requestingUserId - The user ID of the requester (must match userId)
   * @returns Dashboard data
   * @throws ProfileUnauthorizedError if requestingUserId !== userId
   */
  getDashboard(userId: string, requestingUserId: string): Promise<DashboardData>;
}

/**
 * Profile service implementation
 */
export class ProfileServiceImpl implements ProfileService {
  private readonly CACHE_TTL = 300; // 5 minutes in seconds
  private readonly METRICS_CACHE_TTL = 300000; // 5 minutes in milliseconds

  constructor(
    private readonly repository: ProfileRepository,
    private readonly keycloakClient: KeycloakAdminClient,
    private readonly cacheRepository: CacheRepository,
    private readonly db: RawDb
  ) {}

  async createProfile(userId: string, input: CreateProfileInput): Promise<Profile> {
    // Validate input
    const validated = CreateProfileSchema.parse(input);

    // Try to sync with Keycloak (non-blocking)
    const [keycloakError] = await safeExecute(this.keycloakClient.getUserAttributes(userId));
    if (keycloakError) {
      logger.warn({ error: keycloakError, userId }, 'Failed to fetch Keycloak attributes during profile creation');
    }

    // Create profile in database
    const [error, profile] = await safeExecute(this.repository.create(userId, validated));
    if (error) {
      logger.error({ error, userId, input: validated }, 'Failed to create profile');
      throw error;
    }

    logger.info({ userId }, 'Profile created successfully');
    return profile;
  }

  async updateProfile(userId: string, requestingUserId: string, input: UpdateProfileInput): Promise<Profile> {
    // Authorization check: users can only update their own profile
    if (userId !== requestingUserId) {
      logger.warn({ userId, requestingUserId }, 'Unauthorized profile update attempt');
      throw new ProfileUnauthorizedError('Unauthorized to update this profile');
    }

    // Validate input
    const validated = UpdateProfileSchema.parse(input);

    // Update profile in database
    const [error, profile] = await safeExecute(this.repository.update(userId, validated));
    if (error) {
      logger.error({ error, userId, input: validated }, 'Failed to update profile');
      throw error;
    }

    if (!profile) {
      throw new ProfileNotFoundError(`Profile not found for user ${userId}`);
    }

    // Invalidate all related caches
    await this.invalidateProfileCache(userId);

    logger.info({ userId }, 'Profile updated successfully');
    return profile;
  }

  async getProfile(userId: string, requestingUserId: string): Promise<Profile> {
    // Try to get from cache first
    const cacheKey = `profile:${userId}`;
    const [cacheError, cachedProfile] = await safeExecute(this.cacheRepository.read<Profile>(cacheKey));

    if (!cacheError && cachedProfile) {
      logger.debug({ userId, cacheKey }, 'Profile cache hit');
      // Cached profile is raw; apply field visibility when serving
      return this.applyFieldVisibility(cachedProfile, userId, requestingUserId);
    }

    // Fetch from repository with privacy enforcement
    const [error, profile] = await safeExecute(
      this.repository.findById(userId, requestingUserId)
    );

    if (error) {
      logger.error({ error, userId, requestingUserId }, 'Failed to fetch profile');
      throw error;
    }

    if (!profile) {
      logger.debug({ userId, requestingUserId }, 'Profile not found or access denied');
      throw new ProfileNotFoundError(userId);
    }

    // Cache the raw profile (without visibility filtering)
    const [writeError] = await safeExecute(
      this.cacheRepository.write(cacheKey, profile, this.CACHE_TTL)
    );
    if (writeError) {
      logger.warn({ error: writeError, userId }, 'Failed to cache profile');
    }

    // Apply field visibility when returning
    return this.applyFieldVisibility(profile, userId, requestingUserId);
  }

  /**
   * Apply field-level visibility settings to a profile
   * @param profile - The profile to apply visibility to
   * @param profileUserId - The user ID of the profile owner
   * @param requestingUserId - The user ID of the requester
   * @returns Profile with visibility settings applied
   * @private
   */
  private applyFieldVisibility(profile: Profile, profileUserId: string, requestingUserId: string): Profile {
    // Owner sees all fields regardless of visibility settings
    if (profileUserId === requestingUserId) {
      return profile;
    }

    // If no visibility settings, return profile as-is
    if (!profile.fieldVisibilitySettings || Object.keys(profile.fieldVisibilitySettings).length === 0) {
      return profile;
    }

    // Create a copy of the profile to avoid mutating the original
    const visibleProfile = { ...profile };

    // Apply visibility settings to each field
    for (const [fieldName, isVisible] of Object.entries(profile.fieldVisibilitySettings)) {
      // If field is explicitly set to false, hide it by setting to null
      if (isVisible === false) {
        // Type-safe field access
        if (fieldName in visibleProfile) {
          (visibleProfile as any)[fieldName] = null;
        }
      }
      // If field is true or undefined, keep the original value (no action needed)
    }

    return visibleProfile;
  }

  async getStatistics(userId: string): Promise<ProfileStatistics> {
    // Try to get cached metrics
    const [cacheError, cachedMetrics] = await safeExecute(this.repository.getCachedMetrics(userId));

    if (!cacheError && cachedMetrics && cachedMetrics.lastCalculated) {
      const lastCalculated = new Date(cachedMetrics.lastCalculated);
      const cacheAge = Date.now() - lastCalculated.getTime();

      // If cache is fresh (less than 5 minutes old), return cached data
      if (cacheAge < this.METRICS_CACHE_TTL) {
        logger.debug({ userId, cacheAge }, 'Using cached metrics');
        return {
          notesCount: cachedMetrics.notesCount || 0,
          prayersCount: cachedMetrics.prayersCount || 0,
          devotionalsCount: cachedMetrics.devotionalsCount || 0,
          daysActive: cachedMetrics.daysActive,
        };
      }
    }

    // Calculate fresh statistics
    logger.debug({ userId }, 'Calculating fresh statistics');
    const [error, statistics] = await safeExecute(this.repository.getStatistics(userId));

    if (error) {
      logger.error({ error, userId }, 'Failed to calculate statistics');
      throw error;
    }

    // Update cached metrics
    const metricsToCache = {
      ...statistics,
      lastCalculated: new Date().toISOString(),
    };

    const [updateError] = await safeExecute(
      this.repository.updateCachedMetrics(userId, metricsToCache)
    );

    if (updateError) {
      logger.warn({ error: updateError, userId }, 'Failed to update cached metrics');
    }

    return statistics;
  }

  async getDashboard(userId: string, requestingUserId: string): Promise<DashboardData> {
    // Authorization check: users can only view their own dashboard
    if (userId !== requestingUserId) {
      logger.warn({ userId, requestingUserId }, 'Unauthorized dashboard access attempt');
      throw new ProfileUnauthorizedError('Unauthorized to view this dashboard');
    }

    // Try to get from cache first
    const cacheKey = `profile:dashboard:${userId}`;
    const [cacheError, cachedDashboard] = await safeExecute(
      this.cacheRepository.read<DashboardData>(cacheKey)
    );

    if (!cacheError && cachedDashboard) {
      logger.debug({ userId, cacheKey }, 'Dashboard cache hit');
      return cachedDashboard;
    }

    // Aggregate dashboard data from multiple sources
    logger.debug({ userId }, 'Aggregating dashboard data');
    const [error, dashboard] = await safeExecute(this.aggregateDashboardData(userId));

    if (error) {
      logger.error({ error, userId }, 'Failed to aggregate dashboard data');
      throw error;
    }

    // Cache the dashboard
    const [writeError] = await safeExecute(
      this.cacheRepository.write(cacheKey, dashboard, this.CACHE_TTL)
    );

    if (writeError) {
      logger.warn({ error: writeError, userId }, 'Failed to cache dashboard');
    }

    return dashboard;
  }

  /**
   * Aggregate dashboard data from multiple sources
   * @private
   */
  private async aggregateDashboardData(userId: string): Promise<DashboardData> {
    return this.db.begin(async (tx) => {
      // Fetch recent notes (last 10)
      const notesResult = await tx`
        SELECT id, title, content, created_at, updated_at
        FROM notes
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const recentNotes = notesResult.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
        updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
      }));

      // Fetch active prayer requests
      const prayersResult = await tx`
        SELECT id, title, description, status, created_at, updated_at
        FROM prayer_requests
        WHERE author_id = ${userId}
          AND status IN ('active', 'ongoing')
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const activePrayerRequests = prayersResult.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
        updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
      }));

      // Fetch devotional progress (recent posts from series)
      const devotionalsResult = await tx`
        SELECT
          p.id as post_id,
          p.title as post_title,
          p.published_at,
          s.id as series_id,
          s.title as series_name
        FROM posts p
        INNER JOIN series s ON p.series_id = s.id
        WHERE p.author_id = ${userId}
          AND p.status = 'published'
        ORDER BY p.published_at DESC
        LIMIT 10
      `;

      const devotionalProgress = devotionalsResult.map((row: any) => ({
        seriesId: row.series_id,
        seriesName: row.series_name,
        postId: row.post_id,
        postTitle: row.post_title,
        publishedAt: row.published_at instanceof Date ? row.published_at : new Date(row.published_at),
      }));

      // Get statistics
      const statistics = await this.getStatistics(userId);

      return {
        recentNotes,
        activePrayerRequests,
        devotionalProgress,
        statistics,
      };
    });
  }

  /**
   * Invalidate all caches related to a profile
   * @private
   */
  private async invalidateProfileCache(userId: string): Promise<void> {
    const cacheKeys = [
      `profile:${userId}`,
      `profile:statistics:${userId}`,
      `profile:dashboard:${userId}`,
    ];

    for (const key of cacheKeys) {
      const [error] = await safeExecute(this.cacheRepository.delete(key));
      if (error) {
        logger.warn({ error, key }, 'Failed to invalidate cache key');
      }
    }
  }
}
