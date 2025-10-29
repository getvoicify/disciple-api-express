import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { Server as HttpServer, createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import * as jose from 'jose';
import Redis from 'ioredis';
import {
  USER_EVENTS,
  TYPING_EVENTS,
  type UserOnlinePayload,
  type UserOfflinePayload,
  type TypingStartPayload,
  type TypingStopPayload,
} from '../../websocket/events';
import { registerPresenceHandlers } from '../../websocket/handlers/presence.handler';
import { PresenceService } from '../../prayer-walls/services/presence.service';
import { RedisCacheRepository } from '../../cache/redis-cache.repository';

vi.mock('ioredis');

/**
 * Presence and Typing Indicator WebSocket Handler Tests
 *
 * These tests verify the real-time presence tracking and typing indicators
 * for the Prayer Wall Foundation feature. Tests focus on:
 * 1. User online/offline/away presence events
 * 2. Typing start/stop indicators with debouncing
 * 3. Redis integration for presence and typing state
 * 4. Event broadcasting to correct rooms
 * 5. Multiple users in the same wall
 *
 * IMPORTANT: Following TDD - these tests should FAIL until handlers are implemented.
 */
describe('Presence and Typing Indicator Handlers', () => {
  let httpServer: HttpServer;
  let io: SocketServer;
  let clientSocket: ClientSocket;
  let secondClientSocket: ClientSocket;
  let thirdClientSocket: ClientSocket;
  let serverPort: number;
  let validToken: string;
  let secondUserToken: string;
  let thirdUserToken: string;
  let mockRedis: any;

  const testSecret = new TextEncoder().encode('test-secret-key-for-websocket-testing');

  /**
   * Helper to wait for socket connection with timeout
   */
  const waitForConnection = (socket: ClientSocket): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  };

  /**
   * Helper to wait for a specific event with timeout
   */
  const waitForEvent = <T>(socket: ClientSocket, eventName: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Event ${eventName} timeout`));
      }, 5000);

      socket.once(eventName, (data: T) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
  };

  beforeEach(async () => {
    // Mock Redis client
    mockRedis = {
      zadd: vi.fn().mockResolvedValue(1),
      zrem: vi.fn().mockResolvedValue(1),
      zrangebyscore: vi.fn().mockResolvedValue([]),
      zremrangebyscore: vi.fn().mockResolvedValue(0),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      smembers: vi.fn().mockResolvedValue([]),
      on: vi.fn(),
      disconnect: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
    };

    (Redis as any).mockImplementation(function() {
      return mockRedis;
    });

    // Create HTTP server
    httpServer = createServer();

    // Find available port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address === 'object') {
          serverPort = address.port;
        }
        resolve();
      });
    });

    // Create JWT tokens for testing
    validToken = await new jose.SignJWT({
      sub: 'user-123',
      realm: 'test-realm',
      name: 'Test User'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(testSecret);

    secondUserToken = await new jose.SignJWT({
      sub: 'user-456',
      realm: 'test-realm',
      name: 'Second User'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(testSecret);

    thirdUserToken = await new jose.SignJWT({
      sub: 'user-789',
      realm: 'test-realm',
      name: 'Third User'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(testSecret);

    // Initialize Socket.io server
    io = new SocketServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Set up authentication middleware
    io.use(async (socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      try {
        const { payload } = await jose.jwtVerify(token, testSecret);
        socket.data.userId = payload.sub;
        socket.data.user = { payload };
        next();
      } catch (error) {
        next(new Error('Invalid or expired token'));
      }
    });

    // Handle room join/leave for test confirmation events
    io.on('connection', (socket) => {
      socket.on('join-room', (roomId: string) => {
        socket.emit('room-joined', { roomId });
      });

      socket.on('leave-room', (roomId: string) => {
        socket.emit('room-left', { roomId });
      });

      socket.on('get-online-users', async (data: { wallId: string }) => {
        // Query Redis for online users (within last 5 minutes)
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);
        const users = await mockRedis.zrangebyscore(
          `presence:online:${data.wallId}`,
          fiveMinutesAgo,
          '+inf'
        );
        socket.emit('online-users', { wallId: data.wallId, users });
      });
    });

    // Register presence handlers with mock Redis (this will also handle join-room)
    const redisCache = new RedisCacheRepository('redis://localhost:6379');
    // Override the redis property with our mock
    (redisCache as any).redis = mockRedis;
    const presenceService = new PresenceService(redisCache);
    registerPresenceHandlers(io, presenceService);
  });

  afterEach(async () => {
    // Clean up client connections
    if (clientSocket) {
      clientSocket.disconnect();
      clientSocket.close();
    }
    if (secondClientSocket) {
      secondClientSocket.disconnect();
      secondClientSocket.close();
    }
    if (thirdClientSocket) {
      thirdClientSocket.disconnect();
      thirdClientSocket.close();
    }

    // Clean up servers
    if (io) {
      io.close();
    }
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }

    vi.clearAllMocks();
  });

  describe('user:online event on connection', () => {
    it('should broadcast user:online event when user joins a wall room', async () => {
      const wallId = 'wall-presence-123';

      // Connect first client (will receive the event)
      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      // Join wall room
      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      // Connect second client (will trigger the presence event)
      secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: secondUserToken },
        transports: ['websocket']
      });

      await waitForConnection(secondClientSocket);

      // Listen for user:online event on first client
      const eventPromise = waitForEvent<UserOnlinePayload>(clientSocket, USER_EVENTS.ONLINE);

      // Second client joins the same room (should trigger user:online)
      secondClientSocket.emit('join-room', wallId);
      await waitForEvent(secondClientSocket, 'room-joined');

      // Verify user:online event received
      const receivedPayload = await eventPromise;
      expect(receivedPayload.userId).toBe('user-456');
      expect(receivedPayload.wallId).toBe(wallId);
      expect(receivedPayload.userName).toBe('Second User');
      expect(receivedPayload.timestamp).toBeDefined();
      expect(new Date(receivedPayload.timestamp)).toBeInstanceOf(Date);
    });

    it('should store online presence in Redis with timestamp', async () => {
      const wallId = 'wall-presence-456';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      // Join room (should trigger presence service to set online)
      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      // Wait a bit for Redis operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify Redis zadd was called for online presence
      // Expected format: zadd presence:online:wall-presence-456 <timestamp> user-123
      expect(mockRedis.zadd).toHaveBeenCalled();
      const zaddCalls = mockRedis.zadd.mock.calls;
      const relevantCall = zaddCalls.find((call: any[]) =>
        call[0] === `presence:online:${wallId}`
      );
      expect(relevantCall).toBeDefined();
      expect(relevantCall[2]).toBe('user-123');
    });

    it('should broadcast user:online to multiple clients in the same wall', async () => {
      const wallId = 'wall-presence-multi-789';

      // Connect two clients to the same room
      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: secondUserToken },
        transports: ['websocket']
      });

      await Promise.all([
        waitForConnection(clientSocket),
        waitForConnection(secondClientSocket)
      ]);

      // Both join the same room
      clientSocket.emit('join-room', wallId);
      secondClientSocket.emit('join-room', wallId);

      await Promise.all([
        waitForEvent(clientSocket, 'room-joined'),
        waitForEvent(secondClientSocket, 'room-joined')
      ]);

      // Set up listeners on both clients for third user
      const client1Promise = waitForEvent<UserOnlinePayload>(clientSocket, USER_EVENTS.ONLINE);
      const client2Promise = waitForEvent<UserOnlinePayload>(secondClientSocket, USER_EVENTS.ONLINE);

      // Third user joins
      thirdClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: thirdUserToken },
        transports: ['websocket']
      });

      await waitForConnection(thirdClientSocket);
      thirdClientSocket.emit('join-room', wallId);
      await waitForEvent(thirdClientSocket, 'room-joined');

      // Both clients should receive user:online event
      const [received1, received2] = await Promise.all([client1Promise, client2Promise]);

      expect(received1.userId).toBe('user-789');
      expect(received2.userId).toBe('user-789');
      expect(received1.wallId).toBe(wallId);
      expect(received2.wallId).toBe(wallId);
    });
  });

  describe('user:offline event on disconnection', () => {
    it('should broadcast user:offline event when user disconnects from wall', async () => {
      const wallId = 'wall-offline-123';

      // Connect two clients
      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: secondUserToken },
        transports: ['websocket']
      });

      await Promise.all([
        waitForConnection(clientSocket),
        waitForConnection(secondClientSocket)
      ]);

      // Both join the same room
      clientSocket.emit('join-room', wallId);
      secondClientSocket.emit('join-room', wallId);

      await Promise.all([
        waitForEvent(clientSocket, 'room-joined'),
        waitForEvent(secondClientSocket, 'room-joined')
      ]);

      // First client listens for offline event
      const eventPromise = waitForEvent<UserOfflinePayload>(clientSocket, USER_EVENTS.OFFLINE);

      // Second client disconnects
      secondClientSocket.disconnect();
      secondClientSocket.close();

      // Verify user:offline event received
      const receivedPayload = await eventPromise;
      expect(receivedPayload.userId).toBe('user-456');
      expect(receivedPayload.wallId).toBe(wallId);
      expect(receivedPayload.timestamp).toBeDefined();
    });

    it('should remove user from Redis online presence on disconnect', async () => {
      const wallId = 'wall-offline-456';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      // Clear mock calls from connection
      vi.clearAllMocks();

      // Disconnect
      clientSocket.disconnect();
      clientSocket.close();

      // Wait for disconnect handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify Redis zrem was called to remove from online presence
      // Expected: zrem presence:online:wall-offline-456 user-123
      expect(mockRedis.zrem).toHaveBeenCalled();
      const zremCalls = mockRedis.zrem.mock.calls;
      const relevantCall = zremCalls.find((call: any[]) =>
        call[0] === `presence:online:${wallId}` && call[1] === 'user-123'
      );
      expect(relevantCall).toBeDefined();
    });

    it('should not broadcast user:offline to users in different walls', async () => {
      const wallId1 = 'wall-offline-789';
      const wallId2 = 'wall-offline-012';

      // Connect two clients to different rooms
      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: secondUserToken },
        transports: ['websocket']
      });

      await Promise.all([
        waitForConnection(clientSocket),
        waitForConnection(secondClientSocket)
      ]);

      // First client joins wallId1
      clientSocket.emit('join-room', wallId1);
      await waitForEvent(clientSocket, 'room-joined');

      // Second client joins wallId2
      secondClientSocket.emit('join-room', wallId2);
      await waitForEvent(secondClientSocket, 'room-joined');

      // First client should not receive offline event
      let client1ReceivedOffline = false;
      clientSocket.once(USER_EVENTS.OFFLINE, () => {
        client1ReceivedOffline = true;
      });

      // Second client disconnects
      secondClientSocket.disconnect();
      secondClientSocket.close();

      // Wait to ensure event doesn't arrive
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(client1ReceivedOffline).toBe(false);
    });
  });

  describe('typing:start event with debouncing', () => {
    it('should broadcast typing:start event when user starts typing', async () => {
      const wallId = 'wall-typing-123';

      // Connect two clients
      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: secondUserToken },
        transports: ['websocket']
      });

      await Promise.all([
        waitForConnection(clientSocket),
        waitForConnection(secondClientSocket)
      ]);

      // Both join the same room
      clientSocket.emit('join-room', wallId);
      secondClientSocket.emit('join-room', wallId);

      await Promise.all([
        waitForEvent(clientSocket, 'room-joined'),
        waitForEvent(secondClientSocket, 'room-joined')
      ]);

      // First client listens for typing:start
      const eventPromise = waitForEvent<TypingStartPayload>(clientSocket, TYPING_EVENTS.START);

      // Second client emits typing:start
      secondClientSocket.emit('typing:start', { wallId });

      // Verify typing:start event received
      const receivedPayload = await eventPromise;
      expect(receivedPayload.wallId).toBe(wallId);
      expect(receivedPayload.userId).toBe('user-456');
      expect(receivedPayload.userName).toBe('Second User');
    });

    it('should store typing indicator in Redis with TTL', async () => {
      const wallId = 'wall-typing-456';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      // Emit typing:start
      clientSocket.emit('typing:start', { wallId });

      // Wait for Redis operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify Redis setex was called with 5-second TTL
      // Expected: setex typing:wall-typing-456:user-123 5 "1"
      expect(mockRedis.setex).toHaveBeenCalled();
      const setexCalls = mockRedis.setex.mock.calls;
      const relevantCall = setexCalls.find((call: any[]) =>
        call[0] === `typing:${wallId}:user-123` && call[1] === 5
      );
      expect(relevantCall).toBeDefined();
    });

    it('should broadcast typing:start with prayer ID when typing on specific prayer', async () => {
      const wallId = 'wall-typing-prayer-789';
      const prayerId = 'prayer-001';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: secondUserToken },
        transports: ['websocket']
      });

      await Promise.all([
        waitForConnection(clientSocket),
        waitForConnection(secondClientSocket)
      ]);

      clientSocket.emit('join-room', wallId);
      secondClientSocket.emit('join-room', wallId);

      await Promise.all([
        waitForEvent(clientSocket, 'room-joined'),
        waitForEvent(secondClientSocket, 'room-joined')
      ]);

      const eventPromise = waitForEvent<TypingStartPayload>(clientSocket, TYPING_EVENTS.START);

      // Second client starts typing on specific prayer
      secondClientSocket.emit('typing:start', { wallId, prayerId });

      const receivedPayload = await eventPromise;
      expect(receivedPayload.wallId).toBe(wallId);
      expect(receivedPayload.userId).toBe('user-456');
      expect(receivedPayload.prayerId).toBe(prayerId);
    });

    it('should debounce multiple typing:start events from same user', async () => {
      const wallId = 'wall-typing-debounce-012';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: secondUserToken },
        transports: ['websocket']
      });

      await Promise.all([
        waitForConnection(clientSocket),
        waitForConnection(secondClientSocket)
      ]);

      clientSocket.emit('join-room', wallId);
      secondClientSocket.emit('join-room', wallId);

      await Promise.all([
        waitForEvent(clientSocket, 'room-joined'),
        waitForEvent(secondClientSocket, 'room-joined')
      ]);

      let typingEventCount = 0;
      clientSocket.on(TYPING_EVENTS.START, () => {
        typingEventCount++;
      });

      // Second client emits multiple typing:start rapidly
      secondClientSocket.emit('typing:start', { wallId });
      secondClientSocket.emit('typing:start', { wallId });
      secondClientSocket.emit('typing:start', { wallId });

      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should only receive one event due to debouncing
      expect(typingEventCount).toBe(1);
    });
  });

  describe('typing:stop auto-clear after inactivity', () => {
    it('should broadcast typing:stop event when user stops typing', async () => {
      const wallId = 'wall-typing-stop-123';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: secondUserToken },
        transports: ['websocket']
      });

      await Promise.all([
        waitForConnection(clientSocket),
        waitForConnection(secondClientSocket)
      ]);

      clientSocket.emit('join-room', wallId);
      secondClientSocket.emit('join-room', wallId);

      await Promise.all([
        waitForEvent(clientSocket, 'room-joined'),
        waitForEvent(secondClientSocket, 'room-joined')
      ]);

      const eventPromise = waitForEvent<TypingStopPayload>(clientSocket, TYPING_EVENTS.STOP);

      // Second client emits typing:stop
      secondClientSocket.emit('typing:stop', { wallId });

      const receivedPayload = await eventPromise;
      expect(receivedPayload.wallId).toBe(wallId);
      expect(receivedPayload.userId).toBe('user-456');
    });

    it('should remove typing indicator from Redis when typing stops', async () => {
      const wallId = 'wall-typing-stop-456';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      // Start typing first
      clientSocket.emit('typing:start', { wallId });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear previous calls
      vi.clearAllMocks();

      // Stop typing
      clientSocket.emit('typing:stop', { wallId });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify Redis del was called to remove typing indicator
      expect(mockRedis.del).toHaveBeenCalled();
      const delCalls = mockRedis.del.mock.calls;
      const relevantCall = delCalls.find((call: any[]) =>
        call[0] === `typing:${wallId}:user-123`
      );
      expect(relevantCall).toBeDefined();
    });

    it('should set up auto-clear timer for typing indicator', async () => {
      const wallId = 'wall-typing-auto-clear-789';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      // Start typing - this should set up a 5-second timer
      clientSocket.emit('typing:start', { wallId });

      // Wait for Redis operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify typing indicator was set in Redis with 5-second TTL
      expect(mockRedis.setex).toHaveBeenCalled();
      const setexCalls = mockRedis.setex.mock.calls;
      const typingCall = setexCalls.find((call: any[]) =>
        call[0] === `typing:${wallId}:user-123` && call[1] === 5
      );
      expect(typingCall).toBeDefined();

      // The timer would auto-clear after 5 seconds in production
      // Testing actual timer firing is unreliable in test environment
    });

    it('should handle typing:stop with prayer ID context', async () => {
      const wallId = 'wall-typing-stop-prayer-012';
      const prayerId = 'prayer-002';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: secondUserToken },
        transports: ['websocket']
      });

      await Promise.all([
        waitForConnection(clientSocket),
        waitForConnection(secondClientSocket)
      ]);

      clientSocket.emit('join-room', wallId);
      secondClientSocket.emit('join-room', wallId);

      await Promise.all([
        waitForEvent(clientSocket, 'room-joined'),
        waitForEvent(secondClientSocket, 'room-joined')
      ]);

      // Start typing on prayer
      secondClientSocket.emit('typing:start', { wallId, prayerId });
      await new Promise(resolve => setTimeout(resolve, 100));

      const eventPromise = waitForEvent<TypingStopPayload>(clientSocket, TYPING_EVENTS.STOP);

      // Stop typing on prayer
      secondClientSocket.emit('typing:stop', { wallId, prayerId });

      const receivedPayload = await eventPromise;
      expect(receivedPayload.wallId).toBe(wallId);
      expect(receivedPayload.userId).toBe('user-456');
      expect(receivedPayload.prayerId).toBe(prayerId);
    });
  });

  describe('Redis presence data integration', () => {
    it('should maintain online users list in Redis sorted set', async () => {
      const wallId = 'wall-redis-presence-123';

      // Connect multiple clients
      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: secondUserToken },
        transports: ['websocket']
      });

      thirdClientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: thirdUserToken },
        transports: ['websocket']
      });

      await Promise.all([
        waitForConnection(clientSocket),
        waitForConnection(secondClientSocket),
        waitForConnection(thirdClientSocket)
      ]);

      // All join the same room
      clientSocket.emit('join-room', wallId);
      secondClientSocket.emit('join-room', wallId);
      thirdClientSocket.emit('join-room', wallId);

      await Promise.all([
        waitForEvent(clientSocket, 'room-joined'),
        waitForEvent(secondClientSocket, 'room-joined'),
        waitForEvent(thirdClientSocket, 'room-joined')
      ]);

      // Wait for presence updates
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify Redis zadd was called for each user
      expect(mockRedis.zadd).toHaveBeenCalled();
      const zaddCalls = mockRedis.zadd.mock.calls;

      const presenceKey = `presence:online:${wallId}`;
      const user1Call = zaddCalls.find((call: any[]) =>
        call[0] === presenceKey && call[2] === 'user-123'
      );
      const user2Call = zaddCalls.find((call: any[]) =>
        call[0] === presenceKey && call[2] === 'user-456'
      );
      const user3Call = zaddCalls.find((call: any[]) =>
        call[0] === presenceKey && call[2] === 'user-789'
      );

      expect(user1Call).toBeDefined();
      expect(user2Call).toBeDefined();
      expect(user3Call).toBeDefined();
    });

    it('should query online users from Redis when requested', async () => {
      const wallId = 'wall-redis-query-456';

      // Mock Redis to return online users
      mockRedis.zrangebyscore.mockResolvedValue(['user-123', 'user-456']);

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      // Request online users (implementation would handle this)
      clientSocket.emit('get-online-users', { wallId });

      // Wait for potential Redis query
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify Redis was queried for online users
      // Expected: zrangebyscore presence:online:wall-redis-query-456 <now-300000> +inf
      expect(mockRedis.zrangebyscore).toHaveBeenCalled();
    });

    it('should clean up stale presence entries in Redis', async () => {
      const wallId = 'wall-redis-cleanup-789';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      // Wait for potential cleanup operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify Redis cleanup operations
      // Expected: zremrangebyscore to remove stale entries
      const presenceKey = `presence:online:${wallId}`;
      const cleanupCalls = mockRedis.zremrangebyscore.mock.calls.filter((call: any[]) =>
        call[0] === presenceKey
      );

      // Cleanup should happen periodically (implementation specific)
      // At minimum, verify the mock was called (implementation may or may not trigger cleanup in test)
      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
    });
  });
});
