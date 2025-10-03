import { z } from 'zod';

// Series status enum (same as Post status)
export const SeriesStatus = z.enum(['draft', 'published']);

// Series schema
export const Series = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  image: z.string().nullable(),
  authorId: z.uuid(),
  churchId: z.uuid(),
  status: SeriesStatus,
  publishedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Create Series Input
export const CreateSeriesInput = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  churchId: z.uuid(),
  image: z.string().url().optional()
});

// Update Series Input
export const UpdateSeriesInput = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  status: SeriesStatus.optional(),
  image: z.string().url().optional()
});

// Series Filters
export const SeriesFilters = z.object({
  authorizedIds: z.array(z.uuid()).default([]).optional(),
  churchId: z.uuid().optional(),
  authorId: z.uuid().optional(),
  status: SeriesStatus.optional()
});

// Type exports
export type SeriesStatus = z.infer<typeof SeriesStatus>;
export type Series = z.infer<typeof Series>;
export type CreateSeriesInput = z.infer<typeof CreateSeriesInput>;
export type UpdateSeriesInput = z.infer<typeof UpdateSeriesInput>;
export type SeriesFilters = z.infer<typeof SeriesFilters>;