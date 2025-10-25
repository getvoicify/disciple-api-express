// Prayer Wall types and enums for the Prayer Wall Foundation feature

/**
 * Wall status enum representing the lifecycle state of a prayer wall
 */
export enum WallStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

/**
 * Anonymity level enum for prayer requests
 * - IDENTIFIED: Full name and profile visible to everyone
 * - ANONYMOUS_TO_MEMBERS: Identity hidden from members, visible to pastors
 * - FULLY_ANONYMOUS: Identity hidden from everyone including pastors
 */
export enum AnonymityLevel {
  IDENTIFIED = 'identified',
  ANONYMOUS_TO_MEMBERS = 'anonymous_to_members',
  FULLY_ANONYMOUS = 'fully_anonymous',
}

/**
 * Flagged content status enum for moderation workflow
 */
export enum FlaggedContentStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  DISMISSED = 'dismissed',
  ACTIONED = 'actioned',
}

/**
 * Schedule configuration for recurring prayer meetings
 */
export type PrayerWallSchedule = {
  frequency: 'daily' | 'weekly' | 'monthly';
  day?: string; // e.g., "Saturday", "Monday"
  time: string; // e.g., "06:00", "18:30"
  timezone: string; // e.g., "Africa/Lagos", "America/New_York"
  duration_minutes?: number; // Optional duration in minutes
  end_time?: string; // Optional end time
};

/**
 * PrayerWall entity representing a topic-based prayer wall
 */
export type PrayerWall = {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  created_by: string;
  is_private: boolean;
  has_restricted_access: boolean;
  schedule: PrayerWallSchedule | null;
  video_call_link: string | null;
  status: WallStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

/**
 * Data required to create a new prayer wall
 */
export type CreatePrayerWallData = {
  church_id: string;
  name: string;
  description?: string;
  created_by: string;
  is_private?: boolean;
  has_restricted_access?: boolean;
  schedule?: PrayerWallSchedule;
  video_call_link?: string;
  status?: WallStatus;
};

/**
 * Data that can be updated on an existing prayer wall
 * Excludes church_id and created_by which should not be changed after creation
 */
export type UpdatePrayerWallData = Partial<
  Omit<CreatePrayerWallData, 'church_id' | 'created_by'>
>;

/**
 * Pagination parameters for list queries
 */
export type PaginationParams = {
  limit?: number;
  offset?: number;
};

/**
 * Prayer wall database row type (raw database format)
 * Used for mapping between database rows and domain models
 */
export type PrayerWallRow = {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  created_by: string;
  is_private: boolean;
  has_restricted_access: boolean;
  schedule: any; // JSONB field from database
  video_call_link: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};
