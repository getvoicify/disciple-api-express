import type { Server as SocketServer } from 'socket.io';
import { CONTENT_EVENTS, MEMBER_EVENTS } from '../events';
import type {
  ContentFlaggedPayload,
  ContentHiddenPayload,
  ContentRestoredPayload,
  UserBannedPayload,
} from '../events';
import { logger } from '../../logging';

/**
 * Moderation WebSocket Event Handlers
 *
 * This module registers handlers for broadcasting moderation-related events
 * to connected clients in real-time.
 */

/**
 * Broadcast when content is flagged (to pastors only in that church)
 * Note: In the current implementation, this broadcasts to all wall members.
 * In production, this should filter to pastor role only.
 *
 * @param io - The Socket.io server instance
 * @param wallId - The ID of the prayer wall
 * @param prayerId - The ID of the prayer request that was flagged
 * @param flagId - The ID of the flagged content record
 * @param reason - The reason for flagging
 * @param flaggedBy - The ID of the user who flagged the content
 */
export function broadcastContentFlagged(
  io: SocketServer,
  wallId: string,
  prayerId: string,
  flagId: string,
  reason: string,
  flaggedBy: string
): void {
  const payload: ContentFlaggedPayload = {
    contentId: prayerId,
    contentType: 'prayer',
    wallId,
    flaggedBy,
    reason,
    timestamp: new Date().toISOString(),
  };

  logger.debug(
    { wallId, prayerId, flagId, flaggedBy, eventType: 'content:flagged' },
    'Broadcasting content:flagged event'
  );

  // Broadcast to the wall room (pastors will be listening)
  io.to(wallId).emit(CONTENT_EVENTS.FLAGGED, payload);
}

/**
 * Broadcast when content is hidden (to all members of wall)
 * This notifies all members that content has been hidden from view
 *
 * @param io - The Socket.io server instance
 * @param wallId - The ID of the prayer wall
 * @param prayerId - The ID of the prayer request that was hidden
 */
export function broadcastContentHidden(
  io: SocketServer,
  wallId: string,
  prayerId: string
): void {
  const payload: ContentHiddenPayload = {
    contentId: prayerId,
    contentType: 'prayer',
    wallId,
    hiddenBy: 'system', // Hidden automatically when flagged
    reason: 'Content flagged for review',
    timestamp: new Date().toISOString(),
  };

  logger.debug(
    { wallId, prayerId, eventType: 'content:hidden' },
    'Broadcasting content:hidden event'
  );

  // Broadcast to all members of the wall
  io.to(wallId).emit(CONTENT_EVENTS.HIDDEN, payload);
}

/**
 * Broadcast when content is restored (to all members of wall)
 * This notifies all members that previously hidden content is now visible
 *
 * @param io - The Socket.io server instance
 * @param wallId - The ID of the prayer wall
 * @param prayerId - The ID of the prayer request that was restored
 * @param restoredBy - The ID of the user who restored the content
 */
export function broadcastContentRestored(
  io: SocketServer,
  wallId: string,
  prayerId: string,
  restoredBy: string
): void {
  const payload: ContentRestoredPayload = {
    contentId: prayerId,
    contentType: 'prayer',
    wallId,
    restoredBy,
    timestamp: new Date().toISOString(),
  };

  logger.debug(
    { wallId, prayerId, restoredBy, eventType: 'content:restored' },
    'Broadcasting content:restored event'
  );

  // Broadcast to all members of the wall
  io.to(wallId).emit(CONTENT_EVENTS.RESTORED, payload);
}

/**
 * Broadcast when user is banned (to all members of wall)
 * This notifies all members that a user has been banned from the wall
 *
 * @param io - The Socket.io server instance
 * @param wallId - The ID of the prayer wall
 * @param userId - The ID of the user who was banned
 * @param bannedBy - The ID of the pastor/moderator who banned the user
 */
export function broadcastUserBanned(
  io: SocketServer,
  wallId: string,
  userId: string,
  bannedBy: string
): void {
  const payload: UserBannedPayload = {
    userId,
    wallId,
    bannedBy,
    reason: 'Disruptive behavior', // This could be made configurable
    timestamp: new Date().toISOString(),
  };

  logger.debug(
    { wallId, userId, bannedBy, eventType: 'user:banned' },
    'Broadcasting user:banned event'
  );

  // Broadcast to all members of the wall
  io.to(wallId).emit(MEMBER_EVENTS.BANNED, payload);
}
