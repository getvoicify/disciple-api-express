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
    churchId: z.uuid(),
    previousOwnerId: z.uuid(),
    newOwnerId: z.uuid(),
    userId: z.uuid().optional(),
  }),
  z.object({
    eventType: z.enum(['owner-created', 'member-joined', 'member-left']),
    churchId: z.uuid(),
    userId: z.uuid(),
    previousOwnerId: z.uuid().optional(),
    newOwnerId: z.uuid().optional(),
  }),
]);

export type ChurchMembershipSyncJobData = z.infer<typeof ChurchMembershipSyncJobData>;
