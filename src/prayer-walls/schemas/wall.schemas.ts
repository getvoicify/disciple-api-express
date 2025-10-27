import { z } from 'zod';
import { WallStatus } from '../types/prayer-wall.types';

/**
 * Schedule configuration for recurring prayer meetings
 */
export const WallSchedule = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  day: z.string().optional(), // e.g., "Saturday"
  time: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Expected HH:MM'), // e.g., "06:00"
  timezone: z.string().refine(
    (tz) => {
      // Validate against IANA timezone database
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid IANA timezone' }
  ), // e.g., "Africa/Lagos"
  duration_minutes: z.number().int().positive().optional(),
  end_time: z.string().optional(),
});

/**
 * Schema for creating a new prayer wall
 */
export const CreateWallInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  is_private: z.boolean().optional().default(false),
  has_restricted_access: z.boolean().optional().default(false),
  schedule: WallSchedule.optional(),
  video_call_link: z.string().url().max(500).optional(),
});

/**
 * Schema for updating an existing prayer wall
 */
export const UpdateWallInput = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  schedule: WallSchedule.optional(),
  video_call_link: z.string().url().max(500).optional(),
  status: z.nativeEnum(WallStatus).optional(),
});

/**
 * Schema for wall ID parameter
 */
export const WallIdParams = z.object({
  wallId: z.string().uuid(),
});

/**
 * Schema for church ID and wall ID parameters
 */
export const ChurchWallParams = z.object({
  churchId: z.string().uuid(),
  wallId: z.string().uuid(),
});

/**
 * Schema for church ID parameter
 */
export const ChurchIdParams = z.object({
  churchId: z.string().uuid(),
});

/**
 * Schema for user ID parameter (for member actions)
 */
export const UserIdParams = z.object({
  userId: z.string().uuid(),
});

/**
 * Schema for combined wall and user ID parameters
 */
export const WallUserParams = z.object({
  wallId: z.string().uuid(),
  userId: z.string().uuid(),
});

/**
 * Schema for invite member request
 */
export const InviteMemberInput = z.object({
  userId: z.string().uuid(),
});

/**
 * Schema for pagination query parameters
 */
export const PaginationQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * Prayer wall response schema
 */
export const WallResponse = z.object({
  id: z.string().uuid(),
  church_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  created_by: z.string().uuid(),
  is_private: z.boolean(),
  has_restricted_access: z.boolean(),
  schedule: WallSchedule.nullable(),
  video_call_link: z.string().nullable(),
  status: z.nativeEnum(WallStatus),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
});

// Export TypeScript types
export type WallSchedule = z.infer<typeof WallSchedule>;
export type CreateWallInput = z.infer<typeof CreateWallInput>;
export type UpdateWallInput = z.infer<typeof UpdateWallInput>;
export type WallIdParams = z.infer<typeof WallIdParams>;
export type ChurchWallParams = z.infer<typeof ChurchWallParams>;
export type ChurchIdParams = z.infer<typeof ChurchIdParams>;
export type UserIdParams = z.infer<typeof UserIdParams>;
export type WallUserParams = z.infer<typeof WallUserParams>;
export type InviteMemberInput = z.infer<typeof InviteMemberInput>;
export type PaginationQuery = z.infer<typeof PaginationQuery>;
export type WallResponse = z.infer<typeof WallResponse>;
