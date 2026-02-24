import { type Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import type { Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { logger } from '../logging';
import { validateTokenService } from '../utils/token.service';
import { ROOM_EVENTS, TYPING_EVENTS } from './events';
import { createAuthMiddleware } from './middleware/auth.middleware';
import { registerPrayerHandlers } from './handlers/prayer.handler';
import {
  broadcastUserOnline,
  broadcastUserOffline,
  broadcastTypingStart,
  broadcastTypingStop,
} from './handlers/presence.handler';
import { PresenceService } from '../prayer-walls/services/presence.service';
import { RedisCacheRepository } from '../cache';
import { JwtUserInfoExtractor } from './services/user-info-extractor.service';

/**
 * Configuration options for initializing the Socket.io server
 */
export interface SocketServerOptions {
  redisUrl?: string;
  cors?: object;
  iamEndpoint?: string;
  iamRealm?: string;
}

/**
 * Extended Socket interface with user data
 */
interface AuthenticatedSocket extends Socket {
  userId?: string;
  data: {
    user?: any;
    userId?: string;
    wallIds?: Set<string>; // Track which walls the user has joined
    typingTimers?: Map<string, NodeJS.Timeout>; // Track typing auto-clear timers
  };
}

/**
 * Initializes and configures the Socket.io server with JWT authentication,
 * Redis adapter for horizontal scaling, and room management for prayer walls.
 *
 * Features:
 * - JWT authentication middleware
 * - Redis pub/sub adapter for multi-server deployments
 * - Room-based communication for prayer walls
 * - Structured logging for all WebSocket events
 * - Presence tracking and typing indicators
 *
 * @param httpServer - The HTTP server instance to attach Socket.io to
 * @param options - Configuration options including Redis URL, CORS settings, and IAM config
 * @returns Configured Socket.io server instance
 */
export function initializeSocketServer(
  httpServer: HttpServer,
  options: SocketServerOptions = {}
): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: options.cors || {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Configure Redis adapter for horizontal scaling
  let presenceService: PresenceService | null = null;

  if (options.redisUrl) {
    const pubClient = new Redis(options.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
    const subClient = pubClient.duplicate();

    io.adapter(createAdapter(pubClient, subClient));

    pubClient.on('error', (error: Error) => {
      logger.error({ error: error.message }, 'Redis pub client error for Socket.io');
    });

    subClient.on('error', (error: Error) => {
      logger.error({ error: error.message }, 'Redis sub client error for Socket.io');
    });

    pubClient.on('connect', () => {
      logger.info('Redis pub client connected for Socket.io adapter');
    });

    // Initialize presence service with Redis
    const redisCache = new RedisCacheRepository(options.redisUrl);
    presenceService = new PresenceService(redisCache);

    logger.info('Redis adapter configured for Socket.io');
  } else {
    logger.info('Socket.io running in memory mode (no Redis adapter)');
  }

  // JWT Authentication middleware
  const endpoint = options.iamEndpoint || process.env.IAM_ENDPOINT;
  const realm = options.iamRealm || process.env.IAM_REALM;

  if (!endpoint || !realm) {
    logger.error('IAM_ENDPOINT and IAM_REALM must be configured for WebSocket authentication');
    throw new Error('IAM_ENDPOINT and IAM_REALM must be configured');
  }

  io.use(createAuthMiddleware(validateTokenService, endpoint, realm));

  // Register prayer event handlers
  registerPrayerHandlers(io);

  // Initialize user info extractor for extracting user names from JWT
  const userInfoExtractor = new JwtUserInfoExtractor(logger);

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;
    const userName = userInfoExtractor.getFullName(socket.data.user);

    // Initialize wall tracking for this socket
    socket.data.wallIds = new Set<string>();
    socket.data.typingTimers = new Map<string, NodeJS.Timeout>();

    logger.info({
      socketId: socket.id,
      userId,
      transport: socket.conn.transport.name
    }, 'Client connected via WebSocket');

    // Handle joining prayer wall room
    socket.on(ROOM_EVENTS.JOIN, async (roomId: string) => {
      socket.join(roomId);
      socket.emit(ROOM_EVENTS.JOINED, { roomId });

      // Track this wall for the user
      socket.data.wallIds?.add(roomId);

      logger.debug({
        socketId: socket.id,
        userId,
        roomId
      }, 'Client joined room');

      // Set user as online in presence service
      if (presenceService && userId) {
        const [error] = await presenceService.setOnline(userId, roomId);
        if (!error) {
          // Broadcast user:online event to the room
          broadcastUserOnline(io, roomId, userId, userName);
        } else {
          logger.error({ error, userId, roomId }, 'Failed to set user online');
        }
      }
    });

    // Handle leaving prayer wall room
    socket.on(ROOM_EVENTS.LEAVE, async (roomId: string) => {
      socket.leave(roomId);
      socket.emit(ROOM_EVENTS.LEFT, { roomId });

      // Remove from wall tracking
      socket.data.wallIds?.delete(roomId);

      logger.debug({
        socketId: socket.id,
        userId,
        roomId
      }, 'Client left room');

      // Set user as offline in presence service
      if (presenceService && userId) {
        const [error] = await presenceService.setOffline(userId, roomId);
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
      if (presenceService && userId) {
        const [error] = await presenceService.setTyping(userId, wallId, prayerId);
        if (!error) {
          // Cancel any existing auto-clear timer for this typing context
          const timerKey = prayerId ? `${wallId}:${prayerId}` : wallId;
          const existingTimer = socket.data.typingTimers?.get(timerKey);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          // Broadcast typing:start event to the room
          broadcastTypingStart(io, wallId, userId, userName, prayerId);

          // Set up auto-clear timer (5 seconds)
          const autoClearTimer = setTimeout(async () => {
            logger.debug({
              userId,
              wallId,
              prayerId
            }, 'Auto-clearing typing indicator after 5 seconds');

            // Clear from presence service
            if (presenceService && userId) {
              await presenceService.clearTyping(userId, wallId, prayerId);
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
      if (presenceService && userId) {
        const [error] = await presenceService.clearTyping(userId, wallId, prayerId);
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

    // Handle test message broadcast (for testing purposes)
    socket.on('test-message', (data: { room: string; message: string }) => {
      io.to(data.room).emit('message-received', { message: data.message });
      logger.debug({
        socketId: socket.id,
        userId,
        room: data.room
      }, 'Test message broadcasted to room');
    });

    // Handle client disconnect
    socket.on('disconnect', async (reason: string) => {
      logger.info({
        socketId: socket.id,
        userId,
        reason,
        transport: socket.conn.transport.name
      }, 'Client disconnected from WebSocket');

      // Clear all typing timers
      if (socket.data.typingTimers) {
        for (const timer of socket.data.typingTimers.values()) {
          clearTimeout(timer);
        }
        socket.data.typingTimers.clear();
      }

      // Set user offline in all joined walls
      if (presenceService && userId && socket.data.wallIds) {
        for (const wallId of socket.data.wallIds) {
          const [error] = await presenceService.setOffline(userId, wallId);
          if (!error) {
            // Broadcast user:offline event to each room
            broadcastUserOffline(io, wallId, userId);
          } else {
            logger.error({ error, userId, wallId }, 'Failed to set user offline on disconnect');
          }
        }
      }
    });

    // Handle connection errors
    socket.on('error', (error: Error) => {
      logger.error({
        error: error.message,
        socketId: socket.id,
        userId
      }, 'WebSocket error occurred');
    });
  });

  logger.info({
    redisEnabled: !!options.redisUrl,
    corsOrigin: options.cors || process.env.CORS_ORIGIN || '*'
  }, 'Socket.io server initialized successfully');

  return io;
}

/**
 * Helper function to broadcast events to a specific prayer wall room
 *
 * @param io - The Socket.io server instance
 * @param wallId - The prayer wall ID
 * @param event - The event name to emit
 * @param payload - The event payload data
 */
export function broadcastToWall(
  io: SocketServer,
  wallId: string,
  event: string,
  payload: any
): void {
  const roomName = wallId;
  io.to(roomName).emit(event, payload);
  logger.debug({ wallId, event, roomName }, 'Event broadcasted to prayer wall room');
}

/**
 * Helper function to broadcast events to multiple prayer wall rooms
 *
 * @param io - The Socket.io server instance
 * @param wallIds - Array of prayer wall IDs
 * @param event - The event name to emit
 * @param payload - The event payload data
 */
export function broadcastToWalls(
  io: SocketServer,
  wallIds: string[],
  event: string,
  payload: any
): void {
  wallIds.forEach((wallId) => {
    broadcastToWall(io, wallId, event, payload);
  });
}
