import { z } from 'zod';

/**
 * Embedded church info schema for API responses
 * Used to embed church data in posts, prayer walls, series, and notes responses
 */
export const ChurchInfoSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  logoUrl: z.url().nullable(),
  byline: z.string().nullable(),
});

// Type export
export type ChurchInfoSchema = z.infer<typeof ChurchInfoSchema>;
