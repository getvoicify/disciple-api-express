import type { Server as SocketServer, Socket } from 'socket.io';
import { USER_EVENTS, TYPING_EVENTS, ROOM_EVENTS } from '../events';
import type {
  UserOnlinePayload,
  UserOfflinePayload,
  TypingStartPayload,
  TypingStopPayload,
} from '../events';
import { logger } from '../../logging';
import { PresenceService } from '../../prayer-walls/services/presence.service';
import { RedisCacheRepository } from '../../cache/redis-cache.repository';
import { JwtUserInfoExtractor } from '../services/user-info-extractor.service';

/**
 * Presence WebSocket Event Handlers
 *
 * This module provides broadcast functions for real-time presence tracking
 * and typing indicators in prayer walls.
 */

/**
 * Extended Socket interface with user data
 */
interface AuthenticatedSocket extends Socket {
  data: {
    user?: any;
    userId?: string;
    wallIds?: Set<string>;
    typingTimers?: Map<string, NodeJS.Timeout>;
  };
}

/**
 * Register presence event handlers on the Socket.io server
 *
 * @param io - The Socket.io server instance
 * @param presenceService - Optional presence service instance (defaults to creating one from env)
 */
export function registerPresenceHandlers(
  io: SocketServer,
  presenceService?: PresenceService
): void {
  logger.debug({}, 'Registering presence event handlers');

  // Initialize presence service if not provided
  let service = presenceService;
  if (!service && process.env.REDIS_URL) {
    const redisCache = new RedisCacheRepository(process.env.REDIS_URL);
    service = new PresenceService(redisCache);
  }

  // Initialize user info extractor for extracting user names from JWT
  const userInfoExtractor = new JwtUserInfoExtractor(logger);

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;
    const userName = userInfoExtractor.getFullName(socket.data.user);

    // Initialize tracking
    if (!socket.data.wallIds) {
      socket.data.wallIds = new Set<string>();
    }
    if (!socket.data.typingTimers) {
      socket.data.typingTimers = new Map<string, NodeJS.Timeout>();
    }

    // Handle join-room with presence tracking
    socket.on(ROOM_EVENTS.JOIN, async (roomId: string) => {
      // Join the Socket.io room
      socket.join(roomId);

      // Track this wall
      socket.data.wallIds?.add(roomId);

      // Set user as online in presence service
      if (service && userId) {
        const [error] = await service.setOnline(userId, roomId);
        if (!error) {
          // Broadcast user:online event to the room
          broadcastUserOnline(io, roomId, userId, userName);
        } else {
          logger.error({ error, userId, roomId }, 'Failed to set user online');
        }
      }
    });

    // Handle leave-room with presence tracking
    socket.on(ROOM_EVENTS.LEAVE, async (roomId: string) => {
      // Remove from wall tracking
      socket.data.wallIds?.delete(roomId);

      // Set user as offline in presence service
      if (service && userId) {
        const [error] = await service.setOffline(userId, roomId);
        if (!error) {
          // Broadcast user:offline event to the room
          broadcastUserOffline(io, roomId, userId);
        } else {
          logger.error({ error, userId, roomId }, 'Failed to set user offline');
        }
      }
    });

    // Handle typing:start event
    socket.on(TYPING_EVENTS.START, async (data: { wallId: string; prayerId?: string }) => {
      const { wallId, prayerId } = data;

      logger.debug({
        socketId: socket.id,
        userId,
        wallId,
        prayerId
      }, 'User started typing');

      // Set typing in presence service
      if (service && userId) {
        const [error] = await service.setTyping(userId, wallId, prayerId);
        if (!error) {
          const timerKey = prayerId ? `${wallId}:${prayerId}` : wallId;
          const existingTimer = socket.data.typingTimers?.get(timerKey);

          // Debouncing: Only broadcast if there's no existing timer
          if (!existingTimer) {
            // Broadcast typing:start event to the room
            broadcastTypingStart(io, wallId, userId, userName, prayerId);
          } else {
            // Clear existing timer and set a new one
            clearTimeout(existingTimer);
          }

          // Set up auto-clear timer (5 seconds)
          const autoClearTimer = setTimeout(() => {
            logger.debug({
              userId,
              wallId,
              prayerId
            }, 'Auto-clearing typing indicator after 5 seconds');

            // Clear from presence service
            if (service && userId) {
              service.clearTyping(userId, wallId, prayerId);
            }

            // Broadcast typing:stop event
            broadcastTypingStop(io, wallId, userId, prayerId);

            // Remove timer from tracking
            socket.data.typingTimers?.delete(timerKey);
          }, 5000);

          // Track the timer
          socket.data.typingTimers?.set(timerKey, autoClearTimer);
        } else {
          logger.error({ error, userId, wallId, prayerId }, 'Failed to set typing indicator');
        }
      }
    });

    // Handle typing:stop event
    socket.on(TYPING_EVENTS.STOP, async (data: { wallId: string; prayerId?: string }) => {
      const { wallId, prayerId } = data;

      logger.debug({
        socketId: socket.id,
        userId,
        wallId,
        prayerId
      }, 'User stopped typing');

      // Clear typing in presence service
      if (service && userId) {
        const [error] = await service.clearTyping(userId, wallId, prayerId);
        if (!error) {
          // Cancel auto-clear timer if it exists
          const timerKey = prayerId ? `${wallId}:${prayerId}` : wallId;
          const existingTimer = socket.data.typingTimers?.get(timerKey);
          if (existingTimer) {
            clearTimeout(existingTimer);
            socket.data.typingTimers?.delete(timerKey);
          }

          // Broadcast typing:stop event to the room
          broadcastTypingStop(io, wallId, userId, prayerId);
        } else {
          logger.error({ error, userId, wallId, prayerId }, 'Failed to clear typing indicator');
        }
      }
    });

    // Handle client disconnect
    socket.on('disconnect', async () => {
      // Clear all typing timers
      if (socket.data.typingTimers) {
        for (const timer of socket.data.typingTimers.values()) {
          clearTimeout(timer);
        }
        socket.data.typingTimers.clear();
      }

      // Set user offline in all joined walls
      if (service && userId && socket.data.wallIds) {
        for (const wallId of socket.data.wallIds) {
          const [error] = await service.setOffline(userId, wallId);
          if (!error) {
            // Broadcast user:offline event to each room
            broadcastUserOffline(io, wallId, userId);
          } else {
            logger.error({ error, userId, wallId }, 'Failed to set user offline on disconnect');
          }
        }
      }
    });
  });

  logger.info('Presence event handlers registered');
}

/**
 * Broadcast user:online event to a prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param wallId - The prayer wall ID
 * @param userId - The user ID going online
 * @param userName - The user's display name
 */
export function broadcastUserOnline(
  io: SocketServer,
  wallId: string,
  userId: string,
  userName: string
): void {
  const roomId = wallId;
  const payload: UserOnlinePayload = {
    userId,
    userName,
    wallId,
    timestamp: new Date().toISOString(),
  };

  logger.debug(
    { wallId, userId, userName, eventType: 'user:online' },
    'Broadcasting user:online event'
  );

  io.to(roomId).emit(USER_EVENTS.ONLINE, payload);
}

/**
 * Broadcast user:offline event to a prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param wallId - The prayer wall ID
 * @param userId - The user ID going offline
 */
export function broadcastUserOffline(
  io: SocketServer,
  wallId: string,
  userId: string
): void {
  const roomId = wallId;
  const payload: UserOfflinePayload = {
    userId,
    wallId,
    timestamp: new Date().toISOString(),
  };

  logger.debug(
    { wallId, userId, eventType: 'user:offline' },
    'Broadcasting user:offline event'
  );

  io.to(roomId).emit(USER_EVENTS.OFFLINE, payload);
}

/**
 * Broadcast typing:start event to a prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param wallId - The prayer wall ID
 * @param userId - The user ID who started typing
 * @param userName - The user's display name
 * @param prayerId - Optional prayer ID for prayer-specific typing
 */
export function broadcastTypingStart(
  io: SocketServer,
  wallId: string,
  userId: string,
  userName: string,
  prayerId?: string
): void {
  const roomId = wallId;
  const payload: TypingStartPayload = {
    wallId,
    userId,
    userName,
    ...(prayerId && { prayerId }),
  };

  logger.debug(
    { wallId, userId, userName, prayerId, eventType: 'typing:start' },
    'Broadcasting typing:start event'
  );

  io.to(roomId).emit(TYPING_EVENTS.START, payload);
}

/**
 * Broadcast typing:stop event to a prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param wallId - The prayer wall ID
 * @param userId - The user ID who stopped typing
 * @param prayerId - Optional prayer ID for prayer-specific typing
 */
export function broadcastTypingStop(
  io: SocketServer,
  wallId: string,
  userId: string,
  prayerId?: string
): void {
  const roomId = wallId;
  const payload: TypingStopPayload = {
    wallId,
    userId,
    ...(prayerId && { prayerId }),
  };

  logger.debug(
    { wallId, userId, prayerId, eventType: 'typing:stop' },
    'Broadcasting typing:stop event'
  );

  io.to(roomId).emit(TYPING_EVENTS.STOP, payload);
}
