import { z } from 'zod';

// Privacy mode enum
export const PrivacyModeEnum = z.enum(['public', 'church_only', 'private']);

// Field visibility settings schema
export const FieldVisibilitySettings = z.record(z.string(), z.boolean()).default({});

// Notification preferences schema
export const NotificationPreferences = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
}).loose().default({});

// Cached metrics schema
export const CachedMetrics = z.object({
  notesCount: z.number().int().nonnegative().optional(),
  prayersCount: z.number().int().nonnegative().optional(),
  devotionalsCount: z.number().int().nonnegative().optional(),
  daysActive: z.number().int().nonnegative().optional(),
  lastCalculated: z.iso.datetime().optional(),
}).passthrough().default({});

// Keycloak claims schema (for profile creation)
export const KeycloakClaims = z.object({
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  email: z.string().email().optional(),
}).passthrough();

// Profile schema
export const Profile = z.object({
  userId: z.uuid(),
  bio: z.string().nullable(),
  testimony: z.string().nullable(),
  profilePhotoMediaId: z.uuid().nullable(),
  privacyMode: PrivacyModeEnum,
  fieldVisibilitySettings: FieldVisibilitySettings,
  cachedMetrics: CachedMetrics,
  notificationPreferences: NotificationPreferences,
  preferredDevotionalTime: z.string().nullable(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  email: z.string().email().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Create profile input schema
export const CreateProfileInput = z.object({
  bio: z.string().max(5000).optional(),
  testimony: z.string().max(5000).optional(),
  profilePhotoMediaId: z.uuid().optional(),
  privacyMode: PrivacyModeEnum.default('church_only'),
  fieldVisibilitySettings: FieldVisibilitySettings.optional(),
  notificationPreferences: NotificationPreferences.optional(),
  preferredDevotionalTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Must be in HH:MM:SS format').optional(),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  displayName: z.string().max(511).optional(),
  avatarUrl: z.string().url().optional(),
  email: z.string().email().optional(),
});

// Update profile input schema
export const UpdateProfileInput = z.object({
  bio: z.string().max(5000).optional(),
  testimony: z.string().max(5000).optional(),
  profilePhotoMediaId: z.uuid().nullable().optional(),
  privacyMode: PrivacyModeEnum.optional(),
  fieldVisibilitySettings: FieldVisibilitySettings.optional(),
  notificationPreferences: NotificationPreferences.optional(),
  preferredDevotionalTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Must be in HH:MM:SS format').nullable().optional(),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  displayName: z.string().max(511).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  email: z.string().email().nullable().optional(),
});

// Profile statistics schema
export const ProfileStatistics = z.object({
  notesCount: z.number().int().nonnegative(),
  prayersCount: z.number().int().nonnegative(),
  devotionalsCount: z.number().int().nonnegative(),
  daysActive: z.number().int().nonnegative().optional(),
});

// Type exports
export type PrivacyMode = z.infer<typeof PrivacyModeEnum>;
export type FieldVisibilitySettings = z.infer<typeof FieldVisibilitySettings>;
export type NotificationPreferences = z.infer<typeof NotificationPreferences>;
export type CachedMetrics = z.infer<typeof CachedMetrics>;
export type KeycloakClaims = z.infer<typeof KeycloakClaims>;
export type Profile = z.infer<typeof Profile>;
export type CreateProfileInput = z.infer<typeof CreateProfileInput>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;
export type ProfileStatistics = z.infer<typeof ProfileStatistics>;
