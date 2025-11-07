// Prayer Wall types and enums for the Prayer Wall Foundation feature
import type { UserInfo } from '../../user-info/types';
import type { ChurchInfo } from '../../church-info/types';

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
  church?: ChurchInfo;
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

/**
 * PrayerRequest entity representing a prayer submission on a prayer wall
 */
export type PrayerRequest = {
  id: string;
  wall_id: string;
  author_id: string;
  author?: UserInfo;
  parent_id: string | null;
  thread_depth: number;
  content: string;
  anonymity_level: AnonymityLevel;
  has_attachment: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  deleted_by: string | null;
};

/**
 * Data required to create a new prayer request
 */
export type CreatePrayerRequestData = {
  wall_id: string;
  author_id: string;
  parent_id?: string | null;
  content: string;
  anonymity_level?: AnonymityLevel;
  has_attachment?: boolean;
};

/**
 * Data that can be updated on an existing prayer request
 */
export type UpdatePrayerRequestData = {
  content?: string;
  has_attachment?: boolean;
};

/**
 * Cursor-based pagination parameters for efficient feed queries
 */
export type CursorPaginationParams = {
  limit?: number;
  cursor?: string; // Last seen ID for cursor-based pagination
};

/**
 * PrayerWallMembership entity representing a user's membership in a prayer wall
 * Tracks join/leave history, invitations, and ban status
 */
export type PrayerWallMembership = {
  id: string;
  wall_id: string;
  user_id: string;
  user?: UserInfo;
  joined_at: Date;
  invited_by: string | null;
  left_at: Date | null;
  is_banned: boolean;
  banned_at: Date | null;
  banned_by: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * PrayerCategory entity representing a category for organizing prayer requests
 * Can be either system-wide (available to all churches) or church-specific custom category
 */
export type PrayerCategory = {
  id: string;
  name: string;
  church_id: string | null;
  is_system_category: boolean;
  created_at: Date;
  updated_at: Date;
};

/**
 * FlaggedContent entity representing a flagged prayer request for moderation
 * Tracks the moderation workflow from pending to reviewed/dismissed/actioned
 */
export type FlaggedContent = {
  id: string;
  prayer_request_id: string;
  flagged_by: string;
  reason: string;
  status: FlaggedContentStatus;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  resolution_action: string | null;
  resolution_notes: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * PrayerReadReceipt entity representing a user's read receipt for a prayer request
 * Tracks which users have read which prayer requests for engagement metrics and notifications
 * Unique constraint: one receipt per user per prayer request
 */
export type PrayerReadReceipt = {
  id: string;
  prayer_request_id: string;
  user_id: string;
  read_at: Date;
  created_at: Date;
};

/**
 * NotificationPreferences type representing the granular notification settings
 * Each preference controls a specific type of notification delivery
 */
export type NotificationPreferences = {
  new_prayers: boolean;
  responses_to_my_prayers: boolean;
  replies_to_my_responses: boolean;
  wall_invitations: boolean;
  moderation_actions: boolean;
};

/**
 * NotificationPreference entity representing a user's notification preferences for a specific wall
 * Each user can have different notification preferences for each wall they are a member of
 * Unique constraint: one preference record per (user_id, wall_id)
 */
export type NotificationPreference = {
  id: string;
  user_id: string;
  wall_id: string;
  new_prayers: boolean;
  responses_to_my_prayers: boolean;
  replies_to_my_responses: boolean;
  wall_invitations: boolean;
  moderation_actions: boolean;
  created_at: Date;
  updated_at: Date;
};
