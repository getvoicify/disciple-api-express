import { z } from 'zod';

/**
 * Event types for church membership sync
 */
export const ChurchMembershipEventType = z.enum([
  'owner-created',
  'member-joined',
  'member-left',
  'ownership-transferred',
]);

export type ChurchMembershipEventType = z.infer<typeof ChurchMembershipEventType>;

/**
 * Job data for church membership sync
 * For ownership transfers, both previousOwnerId and newOwnerId are required
 * For other events, userId is required
 */
export const ChurchMembershipSyncJobData = z.union([
  z.object({
    eventType: z.literal('ownership-transferred'),
    churchId: z.string().uuid(),
    previousOwnerId: z.string().uuid(),
    newOwnerId: z.string().uuid(),
    userId: z.string().uuid().optional(),
  }),
  z.object({
    eventType: z.enum(['owner-created', 'member-joined', 'member-left']),
    churchId: z.string().uuid(),
    userId: z.string().uuid(),
    previousOwnerId: z.string().uuid().optional(),
    newOwnerId: z.string().uuid().optional(),
  }),
]);

export type ChurchMembershipSyncJobData = z.infer<typeof ChurchMembershipSyncJobData>;

/**
 * Queue configuration with retry and backoff settings
 */
export const QueueConfig = z.object({
  attempts: z.number().default(5),
  backoff: z.object({
    type: z.literal('exponential'),
    delay: z.number().default(1000), // 1 second initial delay
  }),
});

export type QueueConfig = z.infer<typeof QueueConfig>;
