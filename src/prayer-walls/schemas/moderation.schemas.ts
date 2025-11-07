import { z } from 'zod';

/**
 * Schema for flagging content
 */
export const flagContentSchema = z.object({
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason cannot exceed 500 characters')
    .trim(),
});

/**
 * Schema for reviewing flagged content
 */
export const reviewFlaggedContentSchema = z.object({
  action: z.enum(['delete', 'restore']),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
});

/**
 * Schema for banning a user
 */
export const banUserSchema = z.object({
  churchWide: z.boolean().optional().default(false),
});

/**
 * Schema for prayer ID parameter
 */
export const PrayerIdParam = z.object({
  prayerId: z.uuid(),
});

/**
 * Schema for wall ID parameter
 */
export const WallIdParam = z.object({
  wallId: z.uuid(),
});

/**
 * Schema for church ID parameter
 */
export const ChurchIdParam = z.object({
  churchId: z.uuid(),
});

/**
 * Schema for flag ID parameter
 */
export const FlagIdParam = z.object({
  flagId: z.uuid(),
});

/**
 * Schema for user ID parameter
 */
export const UserIdParam = z.object({
  userId: z.uuid(),
});

/**
 * Schema for pagination query parameters
 */
export const PaginationQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// Export TypeScript types
export type FlagContentInput = z.infer<typeof flagContentSchema>;
export type ReviewFlaggedContentInput = z.infer<typeof reviewFlaggedContentSchema>;
export type BanUserInput = z.infer<typeof banUserSchema>;
export type PrayerIdParam = z.infer<typeof PrayerIdParam>;
export type WallIdParam = z.infer<typeof WallIdParam>;
export type ChurchIdParam = z.infer<typeof ChurchIdParam>;
export type FlagIdParam = z.infer<typeof FlagIdParam>;
export type UserIdParam = z.infer<typeof UserIdParam>;
export type PaginationQuery = z.infer<typeof PaginationQuery>;
