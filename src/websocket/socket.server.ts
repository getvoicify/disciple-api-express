import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { logger } from '../logging';
import { validateTokenService } from '../utils/token.service';
import { ROOM_EVENTS } from './events';
import { createAuthMiddleware } from './middleware/auth.middleware';

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
  };
}

/**
 * Initializes and configures the Socket.io server with JWT authentication,
 * Redis adapter for horizontal scaling, and room management for prayer walls.
 *
 * Features:
 * - Keycloak JWT authentication middleware
 * - Redis pub/sub adapter for multi-server deployments
 * - Room-based communication for prayer walls
 * - Structured logging for all WebSocket events
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

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;
    logger.info({
      socketId: socket.id,
      userId,
      transport: socket.conn.transport.name
    }, 'Client connected via WebSocket');

    // Handle joining prayer wall room
    socket.on(ROOM_EVENTS.JOIN, (roomId: string) => {
      socket.join(roomId);
      socket.emit(ROOM_EVENTS.JOINED, { roomId });
      logger.debug({
        socketId: socket.id,
        userId,
        roomId
      }, 'Client joined room');
    });

    // Handle leaving prayer wall room
    socket.on(ROOM_EVENTS.LEAVE, (roomId: string) => {
      socket.leave(roomId);
      socket.emit(ROOM_EVENTS.LEFT, { roomId });
      logger.debug({
        socketId: socket.id,
        userId,
        roomId
      }, 'Client left room');
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
    socket.on('disconnect', (reason: string) => {
      logger.info({
        socketId: socket.id,
        userId,
        reason,
        transport: socket.conn.transport.name
      }, 'Client disconnected from WebSocket');
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
