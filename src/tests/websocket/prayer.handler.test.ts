import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { Server as HttpServer, createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import * as jose from 'jose';
import {
  PRAYER_EVENTS,
  type PrayerCreatedPayload,
  type PrayerUpdatedPayload,
  type PrayerDeletedPayload,
  type PrayerResponsePayload,
} from '../../websocket/events';
import { AnonymityLevel, type PrayerRequest } from '../../prayer-walls/types/prayer-wall.types';
import {
  registerPrayerHandlers,
  broadcastPrayerCreated,
  broadcastPrayerUpdated,
  broadcastPrayerDeleted,
  broadcastPrayerResponse,
} from '../../websocket/handlers/prayer.handler';

/**
 * Prayer WebSocket Event Handler Tests
 *
 * These tests verify the real-time event broadcasting for prayer wall operations.
 * Tests focus on:
 * 1. Event broadcast to correct rooms
 * 2. Anonymity enforcement in event payloads
 * 3. Proper payload structure and data
 * 4. Thread and response tracking
 *
 * IMPORTANT: Following TDD - these tests should FAIL until handlers are implemented.
 */
describe('Prayer WebSocket Event Handlers', () => {
  let httpServer: HttpServer;
  let io: SocketServer;
  let clientSocket: ClientSocket;
  let secondClientSocket: ClientSocket;
  let serverPort: number;
  let validToken: string;
  let secondUserToken: string;

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

    // Register prayer event handlers
    registerPrayerHandlers(io);

    // Handle room join/leave
    io.on('connection', (socket) => {
      socket.on('join-room', (roomId: string) => {
        socket.join(roomId);
        socket.emit('room-joined', { roomId });
      });

      socket.on('leave-room', (roomId: string) => {
        socket.leave(roomId);
        socket.emit('room-left', { roomId });
      });
    });
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

    // Clean up servers
    if (io) {
      io.close();
    }
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  describe('prayer:created event broadcast', () => {
    it('should broadcast prayer:created event to wall room with identified author', async () => {
      const wallId = 'wall-123';

      // Connect client and join room
      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      // Join wall room
      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      // Listen for prayer:created event
      const eventPromise = waitForEvent<PrayerCreatedPayload>(clientSocket, PRAYER_EVENTS.CREATED);

      // Create mock prayer request with identified author
      const prayer: PrayerRequest = {
        id: 'prayer-001',
        wall_id: wallId,
        author_id: 'user-789',
        parent_id: null,
        thread_depth: 0,
        content: 'Please pray for my family',
        anonymity_level: AnonymityLevel.IDENTIFIED,
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null
      };

      const authorName = 'John Doe';

      // Call handler function to broadcast
      broadcastPrayerCreated(io, prayer, authorName);

      // Verify event received
      const receivedPayload = await eventPromise;
      expect(receivedPayload.prayerId).toBe(prayer.id);
      expect(receivedPayload.wallId).toBe(wallId);
      expect(receivedPayload.content).toBe(prayer.content);
      expect(receivedPayload.authorId).toBe(prayer.author_id);
      expect(receivedPayload.authorName).toBe(authorName);
      expect(receivedPayload.isAnonymous).toBe(false);
      expect(receivedPayload.createdAt).toBeDefined();
    });

    it('should enforce anonymity for anonymous_to_members level in prayer:created event', async () => {
      const wallId = 'wall-456';

      // Connect client and join room
      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      const eventPromise = waitForEvent<PrayerCreatedPayload>(clientSocket, PRAYER_EVENTS.CREATED);

      // Create mock prayer with anonymous_to_members level
      const prayer: PrayerRequest = {
        id: 'prayer-002',
        wall_id: wallId,
        author_id: 'user-999',
        parent_id: null,
        thread_depth: 0,
        content: 'Anonymous prayer request',
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null
      };

      const authorName = 'Real User Name';

      broadcastPrayerCreated(io, prayer, authorName);

      const receivedPayload = await eventPromise;
      expect(receivedPayload.prayerId).toBe(prayer.id);
      expect(receivedPayload.authorId).toBeUndefined();
      expect(receivedPayload.authorName).toBe('Anonymous Member');
      expect(receivedPayload.isAnonymous).toBe(true);
    });

    it('should enforce full anonymity for fully_anonymous level in prayer:created event', async () => {
      const wallId = 'wall-789';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      const eventPromise = waitForEvent<PrayerCreatedPayload>(clientSocket, PRAYER_EVENTS.CREATED);

      // Create mock prayer with fully_anonymous level
      const prayer: PrayerRequest = {
        id: 'prayer-003',
        wall_id: wallId,
        author_id: 'user-888',
        parent_id: null,
        thread_depth: 0,
        content: 'Fully anonymous request',
        anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null
      };

      const authorName = 'Real User Name';

      broadcastPrayerCreated(io, prayer, authorName);

      const receivedPayload = await eventPromise;
      expect(receivedPayload.authorId).toBeUndefined();
      expect(receivedPayload.authorName).toBe('Anonymous');
      expect(receivedPayload.isAnonymous).toBe(true);
    });
  });

  describe('prayer:updated event broadcast', () => {
    it('should broadcast prayer:updated event to wall room with updated content', async () => {
      const wallId = 'wall-update-123';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      const eventPromise = waitForEvent<PrayerUpdatedPayload>(clientSocket, PRAYER_EVENTS.UPDATED);

      const updatedPrayer: PrayerRequest = {
        id: 'prayer-001',
        wall_id: wallId,
        author_id: 'user-123',
        parent_id: null,
        thread_depth: 0,
        content: 'Updated prayer content - more specific details',
        anonymity_level: AnonymityLevel.IDENTIFIED,
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null
      };

      broadcastPrayerUpdated(io, updatedPrayer);

      const receivedPayload = await eventPromise;
      expect(receivedPayload.prayerId).toBe(updatedPrayer.id);
      expect(receivedPayload.wallId).toBe(wallId);
      expect(receivedPayload.content).toBe(updatedPrayer.content);
      expect(receivedPayload.updatedAt).toBeDefined();
    });

    it('should only broadcast prayer:updated to clients in the specific wall room', async () => {
      const wallId1 = 'wall-update-456';
      const wallId2 = 'wall-update-789';

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

      // Set up listeners
      const client1Promise = waitForEvent<PrayerUpdatedPayload>(clientSocket, PRAYER_EVENTS.UPDATED);

      let client2ReceivedEvent = false;
      secondClientSocket.once(PRAYER_EVENTS.UPDATED, () => {
        client2ReceivedEvent = true;
      });

      // Broadcast to wallId1 only
      const updatedPrayer: PrayerRequest = {
        id: 'prayer-001',
        wall_id: wallId1,
        author_id: 'user-123',
        parent_id: null,
        thread_depth: 0,
        content: 'Update for wall 1',
        anonymity_level: AnonymityLevel.IDENTIFIED,
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null
      };

      broadcastPrayerUpdated(io, updatedPrayer);

      // First client should receive
      await client1Promise;

      // Wait a bit to ensure second client doesn't receive
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(client2ReceivedEvent).toBe(false);
    });
  });

  describe('prayer:deleted event broadcast', () => {
    it('should broadcast prayer:deleted event to wall room', async () => {
      const wallId = 'wall-delete-123';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      const eventPromise = waitForEvent<PrayerDeletedPayload>(clientSocket, PRAYER_EVENTS.DELETED);

      const deletedPrayer: PrayerRequest = {
        id: 'prayer-001',
        wall_id: wallId,
        author_id: 'user-123',
        parent_id: null,
        thread_depth: 0,
        content: 'Deleted prayer',
        anonymity_level: AnonymityLevel.IDENTIFIED,
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: new Date(),
        deleted_by: 'user-123'
      };

      broadcastPrayerDeleted(io, deletedPrayer);

      const receivedPayload = await eventPromise;
      expect(receivedPayload.prayerId).toBe(deletedPrayer.id);
      expect(receivedPayload.wallId).toBe(wallId);
      expect(receivedPayload.deletedAt).toBeDefined();
    });
  });

  describe('prayer:response event broadcast', () => {
    it('should broadcast prayer:response event with thread info and identified author', async () => {
      const wallId = 'wall-response-123';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      const eventPromise = waitForEvent<PrayerResponsePayload>(clientSocket, PRAYER_EVENTS.RESPONSE);

      // Response prayer (parent_id is set, thread_depth is 1)
      const response: PrayerRequest = {
        id: 'response-001',
        wall_id: wallId,
        author_id: 'user-123',
        parent_id: 'prayer-001',
        thread_depth: 1,
        content: 'I will be praying for you',
        anonymity_level: AnonymityLevel.IDENTIFIED,
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null
      };

      const authorName = 'Jane Smith';

      broadcastPrayerResponse(io, response, authorName);

      const receivedPayload = await eventPromise;
      expect(receivedPayload.responseId).toBe(response.id);
      expect(receivedPayload.prayerId).toBe(response.parent_id);
      expect(receivedPayload.wallId).toBe(wallId);
      expect(receivedPayload.content).toBe(response.content);
      expect(receivedPayload.authorId).toBe(response.author_id);
      expect(receivedPayload.authorName).toBe(authorName);
      expect(receivedPayload.isAnonymous).toBe(false);
      expect(receivedPayload.createdAt).toBeDefined();
    });

    it('should enforce anonymity in prayer:response event for anonymous responders', async () => {
      const wallId = 'wall-response-456';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket']
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      const eventPromise = waitForEvent<PrayerResponsePayload>(clientSocket, PRAYER_EVENTS.RESPONSE);

      const response: PrayerRequest = {
        id: 'response-002',
        wall_id: wallId,
        author_id: 'user-456',
        parent_id: 'prayer-002',
        thread_depth: 1,
        content: 'Praying for you anonymously',
        anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null
      };

      const authorName = 'Real Name';

      broadcastPrayerResponse(io, response, authorName);

      const receivedPayload = await eventPromise;
      expect(receivedPayload.responseId).toBe(response.id);
      expect(receivedPayload.prayerId).toBe(response.parent_id);
      expect(receivedPayload.authorId).toBeUndefined();
      expect(receivedPayload.authorName).toBe('Anonymous Member');
      expect(receivedPayload.isAnonymous).toBe(true);
    });

    it('should broadcast prayer:response to multiple clients in the same wall', async () => {
      const wallId = 'wall-response-multi-789';

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

      // Set up listeners on both clients
      const client1Promise = waitForEvent<PrayerResponsePayload>(clientSocket, PRAYER_EVENTS.RESPONSE);
      const client2Promise = waitForEvent<PrayerResponsePayload>(secondClientSocket, PRAYER_EVENTS.RESPONSE);

      const response: PrayerRequest = {
        id: 'response-003',
        wall_id: wallId,
        author_id: 'user-999',
        parent_id: 'prayer-003',
        thread_depth: 1,
        content: 'Broadcast to all',
        anonymity_level: AnonymityLevel.IDENTIFIED,
        has_attachment: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        deleted_by: null
      };

      const authorName = 'Broadcaster';

      broadcastPrayerResponse(io, response, authorName);

      // Both clients should receive
      const [received1, received2] = await Promise.all([client1Promise, client2Promise]);

      expect(received1.responseId).toBe(response.id);
      expect(received2.responseId).toBe(response.id);
      expect(received1.prayerId).toBe(response.parent_id);
      expect(received2.prayerId).toBe(response.parent_id);
    });
  });
});
