import { z } from 'zod';
import { AnonymityLevel } from '../types/prayer-wall.types';

/**
 * Schema for creating a new prayer request
 */
export const CreatePrayerInput = z.object({
  content: z
    .string()
    .min(10, 'Prayer content must be at least 10 characters')
    .max(5000, 'Prayer content cannot exceed 5000 characters')
    .trim(),
  anonymity_level: z.nativeEnum(AnonymityLevel).optional().default(AnonymityLevel.IDENTIFIED),
  parent_id: z.string().uuid().optional().nullable(),
  category_ids: z.array(z.string().uuid()).optional().default([]),
  has_attachment: z.boolean().optional().default(false),
});

/**
 * Schema for updating an existing prayer request
 */
export const UpdatePrayerInput = z.object({
  content: z
    .string()
    .min(10, 'Prayer content must be at least 10 characters')
    .max(5000, 'Prayer content cannot exceed 5000 characters')
    .trim(),
});

/**
 * Schema for creating a response to a prayer (threaded reply)
 */
export const PrayerResponseInput = z.object({
  content: z
    .string()
    .min(10, 'Response content must be at least 10 characters')
    .max(5000, 'Response content cannot exceed 5000 characters')
    .trim(),
  anonymity_level: z.nativeEnum(AnonymityLevel).optional().default(AnonymityLevel.IDENTIFIED),
});

/**
 * Schema for prayer ID parameter
 */
export const PrayerIdParams = z.object({
  wallId: z.string().uuid(),
  prayerId: z.string().uuid(),
});

/**
 * Schema for wall ID parameter (used in list prayers)
 */
export const WallIdParams = z.object({
  wallId: z.string().uuid(),
});

/**
 * Schema for cursor-based pagination query parameters
 */
export const CursorPaginationQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  cursor: z.string().optional(),
});

/**
 * Schema for attachment ID parameter
 */
export const AttachmentIdParams = z.object({
  wallId: z.string().uuid(),
  attachmentId: z.string().uuid(),
});

/**
 * Prayer request response schema
 */
export const PrayerResponse = z.object({
  id: z.string().uuid(),
  wall_id: z.string().uuid(),
  author_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  thread_depth: z.number().int().min(0).max(3),
  content: z.string(),
  anonymity_level: z.nativeEnum(AnonymityLevel),
  has_attachment: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
  deleted_by: z.string().uuid().nullable(),
});

// Export TypeScript types
export type CreatePrayerInput = z.infer<typeof CreatePrayerInput>;
export type UpdatePrayerInput = z.infer<typeof UpdatePrayerInput>;
export type PrayerResponseInput = z.infer<typeof PrayerResponseInput>;
export type PrayerIdParams = z.infer<typeof PrayerIdParams>;
export type WallIdParams = z.infer<typeof WallIdParams>;
export type CursorPaginationQuery = z.infer<typeof CursorPaginationQuery>;
export type AttachmentIdParams = z.infer<typeof AttachmentIdParams>;
export type PrayerResponse = z.infer<typeof PrayerResponse>;
