import { z } from 'zod';

/**
 * Church membership event types for Keycloak sync
 */
export const CHURCH_MEMBERSHIP_EVENTS = {
  OWNER_CREATED: 'church:membership:owner-created',
  MEMBER_JOINED: 'church:membership:member-joined',
  MEMBER_LEFT: 'church:membership:member-left',
  OWNERSHIP_TRANSFERRED: 'church:membership:ownership-transferred',
} as const;

export type ChurchMembershipEventType =
  (typeof CHURCH_MEMBERSHIP_EVENTS)[keyof typeof CHURCH_MEMBERSHIP_EVENTS];

/**
 * Event payload when a user creates a church and becomes the owner
 */
export const ChurchMembershipOwnerCreatedPayloadSchema = z.object({
  churchId: z.string().uuid(),
  userId: z.string().uuid(),
  timestamp: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type ChurchMembershipOwnerCreatedPayload = z.infer<
  typeof ChurchMembershipOwnerCreatedPayloadSchema
>;

/**
 * Event payload when a user joins a church (accepts invitation)
 */
export const ChurchMembershipMemberJoinedPayloadSchema = z.object({
  churchId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['Owner', 'Manager', 'Member']),
  timestamp: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type ChurchMembershipMemberJoinedPayload = z.infer<
  typeof ChurchMembershipMemberJoinedPayloadSchema
>;

/**
 * Event payload when a user leaves a church
 */
export const ChurchMembershipMemberLeftPayloadSchema = z.object({
  churchId: z.string().uuid(),
  userId: z.string().uuid(),
  timestamp: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type ChurchMembershipMemberLeftPayload = z.infer<
  typeof ChurchMembershipMemberLeftPayloadSchema
>;

/**
 * Event payload when church ownership is transferred
 * Both previous and new owner must be updated in Keycloak
 */
export const ChurchMembershipOwnershipTransferredPayloadSchema = z.object({
  churchId: z.string().uuid(),
  previousOwnerId: z.string().uuid(),
  newOwnerId: z.string().uuid(),
  previousOwnerNewRole: z.enum(['Manager', 'Member']).optional(),
  timestamp: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type ChurchMembershipOwnershipTransferredPayload = z.infer<
  typeof ChurchMembershipOwnershipTransferredPayloadSchema
>;

/**
 * Union of all church membership event payloads
 */
export type ChurchMembershipEventPayload =
  | ChurchMembershipOwnerCreatedPayload
  | ChurchMembershipMemberJoinedPayload
  | ChurchMembershipMemberLeftPayload
  | ChurchMembershipOwnershipTransferredPayload;

/**
 * Church membership outbox event structure
 */
export interface ChurchMembershipOutboxEvent {
  type: ChurchMembershipEventType;
  payload: ChurchMembershipEventPayload;
  timestamp?: number;
  correlationId?: string;
}
