import type { Server as SocketServer } from 'socket.io';
import type { PrayerRequest } from '../../prayer-walls/types/prayer-wall.types';
import { AnonymityLevel } from '../../prayer-walls/types/prayer-wall.types';
import { PRAYER_EVENTS, MEMBER_EVENTS } from '../events';
import type {
  PrayerCreatedPayload,
  PrayerUpdatedPayload,
  PrayerDeletedPayload,
  PrayerResponsePayload,
  PrayerReadPayload,
  MemberJoinedPayload,
  MemberLeftPayload,
  MemberInvitedPayload,
} from '../events';
import { logger } from '../../logging';

/**
 * Prayer WebSocket Event Handlers
 *
 * This module registers handlers for broadcasting prayer-related events
 * to connected clients in real-time.
 */

/**
 * Helper function to get author information based on anonymity level
 *
 * @param prayer - The prayer request with anonymity settings
 * @param authorName - The actual author name (may be anonymized based on level)
 * @returns Author information with proper anonymity enforcement
 */
function getAuthorInfo(
  prayer: PrayerRequest,
  authorName: string
): {
  authorId?: string;
  authorName?: string;
  isAnonymous: boolean;
} {
  if (prayer.anonymity_level === AnonymityLevel.IDENTIFIED) {
    return {
      authorId: prayer.author_id,
      authorName: authorName,
      isAnonymous: false,
    };
  }

  if (prayer.anonymity_level === AnonymityLevel.ANONYMOUS_TO_MEMBERS) {
    return {
      authorName: 'Anonymous Member',
      isAnonymous: true,
    };
  }

  // FULLY_ANONYMOUS
  return {
    authorName: 'Anonymous',
    isAnonymous: true,
  };
}

/**
 * Helper function to format date to ISO string
 *
 * @param date - Date object or string
 * @returns ISO string representation
 */
function toISOString(date: Date | string): string {
  return date instanceof Date ? date.toISOString() : date;
}

/**
 * Registers prayer event handlers on the Socket.io server
 *
 * @param _io
 */
export function registerPrayerHandlers(_io: SocketServer): void {
  // Event handlers are called directly from services/endpoints
  // This function exists for future socket-level event registration if needed
  logger.debug({}, 'Prayer event handlers registered');
}

/**
 * Broadcasts a prayer:created event to the prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param prayer - The created prayer request
 * @param authorName - The name of the prayer author (may be anonymized)
 */
export function broadcastPrayerCreated(
  io: SocketServer,
  prayer: PrayerRequest,
  authorName: string
): void {
  const roomId = prayer.wall_id;
  const authorInfo = getAuthorInfo(prayer, authorName);

  const payload: PrayerCreatedPayload = {
    prayerId: prayer.id,
    wallId: prayer.wall_id,
    content: prayer.content,
    ...authorInfo,
    createdAt: toISOString(prayer.created_at),
  };

  logger.debug(
    { wallId: prayer.wall_id, prayerId: prayer.id, eventType: 'created' },
    'Broadcasting prayer:created event'
  );

  io.to(roomId).emit(PRAYER_EVENTS.CREATED, payload);
}

/**
 * Broadcasts a prayer:updated event to the prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param prayer - The updated prayer request
 */
export function broadcastPrayerUpdated(
  io: SocketServer,
  prayer: PrayerRequest
): void {
  const roomId = prayer.wall_id;

  const payload: PrayerUpdatedPayload = {
    prayerId: prayer.id,
    wallId: prayer.wall_id,
    content: prayer.content,
    updatedAt: toISOString(prayer.updated_at),
  };

  logger.debug(
    { wallId: prayer.wall_id, prayerId: prayer.id, eventType: 'updated' },
    'Broadcasting prayer:updated event'
  );

  io.to(roomId).emit(PRAYER_EVENTS.UPDATED, payload);
}

/**
 * Broadcasts a prayer:deleted event to the prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param prayer - The deleted prayer request
 */
export function broadcastPrayerDeleted(
  io: SocketServer,
  prayer: PrayerRequest
): void {
  const roomId = prayer.wall_id;

  const payload: PrayerDeletedPayload = {
    prayerId: prayer.id,
    wallId: prayer.wall_id,
    deletedAt: toISOString(prayer.deleted_at!),
  };

  logger.debug(
    { wallId: prayer.wall_id, prayerId: prayer.id, eventType: 'deleted' },
    'Broadcasting prayer:deleted event'
  );

  io.to(roomId).emit(PRAYER_EVENTS.DELETED, payload);
}

/**
 * Broadcasts a prayer:response event to the prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param response - The prayer response (a prayer request with parent_id)
 * @param authorName - The name of the response author (may be anonymized)
 */
export function broadcastPrayerResponse(
  io: SocketServer,
  response: PrayerRequest,
  authorName: string
): void {
  const roomId = response.wall_id;
  const authorInfo = getAuthorInfo(response, authorName);

  const payload: PrayerResponsePayload = {
    responseId: response.id,
    prayerId: response.parent_id!,
    wallId: response.wall_id,
    content: response.content,
    ...authorInfo,
    createdAt: toISOString(response.created_at),
  };

  logger.debug(
    {
      wallId: response.wall_id,
      responseId: response.id,
      prayerId: response.parent_id,
      eventType: 'response',
    },
    'Broadcasting prayer:response event'
  );

  io.to(roomId).emit(PRAYER_EVENTS.RESPONSE, payload);
}

/**
 * Broadcasts a prayer:read event to the prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param prayerId - The ID of the prayer that was read
 * @param wallId - The ID of the prayer wall
 * @param userId - The ID of the user who read the prayer
 * @param readCount - The total number of users who have read the prayer
 */
export function broadcastPrayerRead(
  io: SocketServer,
  prayerId: string,
  wallId: string,
  userId: string,
  readCount: number
): void {
  const payload: PrayerReadPayload = {
    prayerId,
    wallId,
    userId,
    readAt: new Date().toISOString(),
    readCount, // Include read count so clients know how many users have read
  };

  logger.debug(
    { wallId, prayerId, userId, readCount, eventType: 'read' },
    'Broadcasting prayer:read event'
  );

  io.to(wallId).emit(PRAYER_EVENTS.READ, payload);
}

/**
 * Broadcasts a member:joined event to the prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param wallId - The ID of the prayer wall
 * @param userId - The ID of the user who joined
 * @param userName - The name of the user who joined
 * @param role - The role of the user in the wall
 */
export function broadcastMemberJoined(
  io: SocketServer,
  wallId: string,
  userId: string,
  userName: string,
  role: string
): void {
  const payload: MemberJoinedPayload = {
    userId,
    userName,
    wallId,
    role,
    timestamp: new Date().toISOString(),
  };

  logger.debug(
    { wallId, userId, role, eventType: 'member:joined' },
    'Broadcasting member:joined event'
  );

  io.to(wallId).emit(MEMBER_EVENTS.JOINED, payload);
}

/**
 * Broadcasts a member:left event to the prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param wallId - The ID of the prayer wall
 * @param userId - The ID of the user who left
 */
export function broadcastMemberLeft(
  io: SocketServer,
  wallId: string,
  userId: string
): void {
  const payload: MemberLeftPayload = {
    userId,
    wallId,
    timestamp: new Date().toISOString(),
  };

  logger.debug(
    { wallId, userId, eventType: 'member:left' },
    'Broadcasting member:left event'
  );

  io.to(wallId).emit(MEMBER_EVENTS.LEFT, payload);
}

/**
 * Broadcasts a member:invited event to all members in the prayer wall room
 * This allows existing members to see who is being invited for transparency
 *
 * @param io - The Socket.io server instance
 * @param wallId - The ID of the prayer wall
 * @param inviteeId - The ID of the user being invited
 * @param inviterId - The ID of the user who sent the invitation
 */
export function broadcastMemberInvited(
  io: SocketServer,
  wallId: string,
  inviteeId: string,
  inviterId: string
): void {
  const payload: MemberInvitedPayload = {
    userId: inviteeId,
    invitedBy: inviterId,
    wallId,
    timestamp: new Date().toISOString(),
  };

  logger.debug(
    { wallId, inviteeId, inviterId, eventType: 'member:invited' },
    'Broadcasting member:invited event'
  );

  io.to(wallId).emit(MEMBER_EVENTS.INVITED, payload);
}
