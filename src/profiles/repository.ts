import type { CreateProfileInput, UpdateProfileInput, Profile, ProfileStatistics, CachedMetrics } from './schemas';

export interface ProfileRepository {
  /**
   * Create a new user profile
   * @param userId - The UUID of the user (from Keycloak)
   * @param input - The profile data to create
   * @returns The created profile
   */
  create(userId: string, input: CreateProfileInput): Promise<Profile>;

  /**
   * Find a profile by user ID with privacy enforcement
   * @param userId - The UUID of the profile to fetch
   * @param requestingUserId - The UUID of the user making the request
   * @param requestingUserRole - Optional role of the requesting user (e.g., 'pastor')
   * @returns The profile if found and accessible, null otherwise
   */
  findById(userId: string, requestingUserId: string, requestingUserRole?: string): Promise<Profile | null>;

  /**
   * Update a profile
   * @param userId - The UUID of the profile to update
   * @param input - The profile data to update
   * @returns The updated profile if found, null otherwise
   */
  update(userId: string, input: UpdateProfileInput): Promise<Profile | null>;

  /**
   * Delete a profile (soft delete)
   * @param userId - The UUID of the profile to delete
   * @returns True if deleted, false otherwise
   */
  delete(userId: string): Promise<boolean>;

  /**
   * Get aggregated statistics for a user
   * @param userId - The UUID of the user
   * @returns The statistics object
   */
  getStatistics(userId: string): Promise<ProfileStatistics>;

  /**
   * Get cached metrics from the profile
   * @param userId - The UUID of the user
   * @returns The cached metrics or null if not found
   */
  getCachedMetrics(userId: string): Promise<CachedMetrics | null>;

  /**
   * Update cached metrics in the profile
   * @param userId - The UUID of the user
   * @param metrics - The metrics to cache
   * @returns The updated profile if found, null otherwise
   */
  updateCachedMetrics(userId: string, metrics: CachedMetrics): Promise<Profile | null>;
}
