import { z } from 'zod';

/**
 * Embedded user info schema for API responses
 * Used to embed user data in devotionals, prayers, notes, and series responses
 */
export const UserInfoSchema = z.object({
  userId: z.uuid(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  email: z.email().nullable(),
});

// Type export
export type UserInfoSchema = z.infer<typeof UserInfoSchema>;
