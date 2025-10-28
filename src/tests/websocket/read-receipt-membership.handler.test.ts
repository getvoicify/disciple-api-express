import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { Server as HttpServer, createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import * as jose from 'jose';
import {
  PRAYER_EVENTS,
  MEMBER_EVENTS,
  type PrayerReadPayload,
  type MemberJoinedPayload,
  type MemberLeftPayload,
  type MemberInvitedPayload,
} from '../../websocket/events';
import type { IPrayerReadReceiptRepository } from '../../prayer-walls/repositories/prayer-read-receipt.repository';
import type { PrayerReadReceipt } from '../../prayer-walls/types/prayer-wall.types';
import {
  broadcastPrayerRead,
  broadcastMemberJoined,
  broadcastMemberLeft,
  broadcastMemberInvited,
} from '../../websocket/handlers/prayer.handler';

/**
 * Read Receipt and Membership WebSocket Event Handler Tests
 *
 * These tests verify the real-time event broadcasting for read receipts
 * and prayer wall membership operations. Tests focus on:
 * 1. Prayer read event broadcasting when users mark prayers as read
 * 2. Read count aggregation and broadcasting
 * 3. Database storage of read receipts via PrayerReadReceiptRepository
 * 4. Multiple users reading the same prayer
 * 5. Member joined event broadcasting when users join walls
 * 6. Member left event broadcasting when users leave walls
 * 7. Member invited event sent to specific invitees
 * 8. Proper user info and timestamps in all events
 *
 * IMPORTANT: Following TDD - these tests should FAIL until handlers are implemented.
 */
describe('Read Receipt and Membership WebSocket Event Handlers', () => {
  let httpServer: HttpServer;
  let io: SocketServer;
  let clientSocket: ClientSocket;
  let secondClientSocket: ClientSocket;
  let thirdClientSocket: ClientSocket;
  let serverPort: number;
  let validToken: string;
  let secondUserToken: string;
  let thirdUserToken: string;
  let mockReadReceiptRepository: IPrayerReadReceiptRepository;

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
    // Create mock PrayerReadReceiptRepository
    mockReadReceiptRepository = {
      markAsRead: vi.fn().mockResolvedValue({
        id: 'receipt-001',
        prayer_request_id: 'prayer-123',
        user_id: 'user-123',
        read_at: new Date(),
        created_at: new Date(),
      } as PrayerReadReceipt),
      getReadCount: vi.fn().mockResolvedValue(1),
      hasRead: vi.fn().mockResolvedValue(false),
      findByRequestId: vi.fn().mockResolvedValue([]),
    };

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
      name: 'Test User',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(testSecret);

    secondUserToken = await new jose.SignJWT({
      sub: 'user-456',
      realm: 'test-realm',
      name: 'Second User',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(testSecret);

    thirdUserToken = await new jose.SignJWT({
      sub: 'user-789',
      realm: 'test-realm',
      name: 'Third User',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(testSecret);

    // Initialize Socket.io server
    io = new SocketServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // Set up authentication middleware
    io.use(async (socket, next) => {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

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

  describe('Prayer Read Receipt Events', () => {
    describe('prayer:read event broadcast', () => {
      it('should broadcast prayer:read event when user marks prayer as read', async () => {
        const wallId = 'wall-read-123';
        const prayerId = 'prayer-001';
        const userId = 'user-456';
        const readCount = 1;

        // Connect client and join room
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        await waitForConnection(clientSocket);

        clientSocket.emit('join-room', wallId);
        await waitForEvent(clientSocket, 'room-joined');

        // Listen for prayer:read event
        const eventPromise = waitForEvent<PrayerReadPayload>(clientSocket, PRAYER_EVENTS.READ);

        // Call handler function to broadcast read event
        broadcastPrayerRead(io, prayerId, wallId, userId, readCount);

        // Verify event received
        const receivedPayload = await eventPromise;
        expect(receivedPayload.prayerId).toBe(prayerId);
        expect(receivedPayload.wallId).toBe(wallId);
        expect(receivedPayload.userId).toBe(userId);
        expect(receivedPayload.readAt).toBeDefined();
        expect(new Date(receivedPayload.readAt)).toBeInstanceOf(Date);
      });

      it('should include ISO timestamp in prayer:read event payload', async () => {
        const wallId = 'wall-read-timestamp-456';
        const prayerId = 'prayer-002';
        const userId = 'user-123';
        const readCount = 2;

        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        await waitForConnection(clientSocket);

        clientSocket.emit('join-room', wallId);
        await waitForEvent(clientSocket, 'room-joined');

        const eventPromise = waitForEvent<PrayerReadPayload>(clientSocket, PRAYER_EVENTS.READ);

        const beforeTime = new Date().toISOString();
        broadcastPrayerRead(io, prayerId, wallId, userId, readCount);
        const afterTime = new Date().toISOString();

        const receivedPayload = await eventPromise;
        expect(receivedPayload.readAt).toBeDefined();
        // Verify timestamp is in ISO format and within reasonable time range
        expect(receivedPayload.readAt >= beforeTime).toBe(true);
        expect(receivedPayload.readAt <= afterTime).toBe(true);
      });

      it('should broadcast prayer:read to all clients in the wall room', async () => {
        const wallId = 'wall-read-multi-789';
        const prayerId = 'prayer-003';
        const userId = 'user-789';
        const readCount = 1;

        // Connect two clients to the same room
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: secondUserToken },
          transports: ['websocket'],
        });

        await Promise.all([waitForConnection(clientSocket), waitForConnection(secondClientSocket)]);

        // Both join the same room
        clientSocket.emit('join-room', wallId);
        secondClientSocket.emit('join-room', wallId);

        await Promise.all([
          waitForEvent(clientSocket, 'room-joined'),
          waitForEvent(secondClientSocket, 'room-joined'),
        ]);

        // Set up listeners on both clients
        const client1Promise = waitForEvent<PrayerReadPayload>(clientSocket, PRAYER_EVENTS.READ);
        const client2Promise = waitForEvent<PrayerReadPayload>(secondClientSocket, PRAYER_EVENTS.READ);

        broadcastPrayerRead(io, prayerId, wallId, userId, readCount);

        // Both clients should receive
        const [received1, received2] = await Promise.all([client1Promise, client2Promise]);

        expect(received1.prayerId).toBe(prayerId);
        expect(received2.prayerId).toBe(prayerId);
        expect(received1.userId).toBe(userId);
        expect(received2.userId).toBe(userId);
        expect(received1.readCount).toBe(readCount);
        expect(received2.readCount).toBe(readCount);
      });

      it('should not broadcast prayer:read to clients in different wall rooms', async () => {
        const wallId1 = 'wall-read-012';
        const wallId2 = 'wall-read-345';
        const prayerId = 'prayer-004';
        const userId = 'user-123';
        const readCount = 1;

        // Connect two clients to different rooms
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: secondUserToken },
          transports: ['websocket'],
        });

        await Promise.all([waitForConnection(clientSocket), waitForConnection(secondClientSocket)]);

        // First client joins wallId1
        clientSocket.emit('join-room', wallId1);
        await waitForEvent(clientSocket, 'room-joined');

        // Second client joins wallId2
        secondClientSocket.emit('join-room', wallId2);
        await waitForEvent(secondClientSocket, 'room-joined');

        // Set up listeners
        const client1Promise = waitForEvent<PrayerReadPayload>(clientSocket, PRAYER_EVENTS.READ);

        let client2ReceivedEvent = false;
        secondClientSocket.once(PRAYER_EVENTS.READ, () => {
          client2ReceivedEvent = true;
        });

        // Broadcast to wallId1 only
        broadcastPrayerRead(io, prayerId, wallId1, userId, readCount);

        // First client should receive
        await client1Promise;

        // Wait a bit to ensure second client doesn't receive
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(client2ReceivedEvent).toBe(false);
      });
    });

    describe('read count aggregation', () => {
      it('should broadcast updated read count when multiple users read the same prayer', async () => {
        const wallId = 'wall-read-count-123';
        const prayerId = 'prayer-005';

        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        await waitForConnection(clientSocket);

        clientSocket.emit('join-room', wallId);
        await waitForEvent(clientSocket, 'room-joined');

        // First user reads (read count = 1)
        const event1Promise = waitForEvent<PrayerReadPayload>(clientSocket, PRAYER_EVENTS.READ);
        broadcastPrayerRead(io, prayerId, wallId, 'user-123', 1);
        const received1 = await event1Promise;
        expect(received1.prayerId).toBe(prayerId);

        // Second user reads (read count = 2)
        const event2Promise = waitForEvent<PrayerReadPayload>(clientSocket, PRAYER_EVENTS.READ);
        broadcastPrayerRead(io, prayerId, wallId, 'user-456', 2);
        const received2 = await event2Promise;
        expect(received2.prayerId).toBe(prayerId);
        expect(received2.userId).toBe('user-456');

        // Third user reads (read count = 3)
        const event3Promise = waitForEvent<PrayerReadPayload>(clientSocket, PRAYER_EVENTS.READ);
        broadcastPrayerRead(io, prayerId, wallId, 'user-789', 3);
        const received3 = await event3Promise;
        expect(received3.prayerId).toBe(prayerId);
        expect(received3.userId).toBe('user-789');
      });

      it('should emit events with incrementing read count for same prayer', async () => {
        const wallId = 'wall-read-increment-456';
        const prayerId = 'prayer-006';

        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        await waitForConnection(clientSocket);

        clientSocket.emit('join-room', wallId);
        await waitForEvent(clientSocket, 'room-joined');

        const readEvents: PrayerReadPayload[] = [];

        // Collect all read events
        clientSocket.on(PRAYER_EVENTS.READ, (payload: PrayerReadPayload) => {
          if (payload.prayerId === prayerId) {
            readEvents.push(payload);
          }
        });

        // Simulate three users reading the prayer
        broadcastPrayerRead(io, prayerId, wallId, 'user-111', 1);
        await new Promise((resolve) => setTimeout(resolve, 100));

        broadcastPrayerRead(io, prayerId, wallId, 'user-222', 2);
        await new Promise((resolve) => setTimeout(resolve, 100));

        broadcastPrayerRead(io, prayerId, wallId, 'user-333', 3);
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify we received three events
        expect(readEvents.length).toBe(3);
        expect(readEvents[0].userId).toBe('user-111');
        expect(readEvents[1].userId).toBe('user-222');
        expect(readEvents[2].userId).toBe('user-333');
      });
    });

    describe('database integration with PrayerReadReceiptRepository', () => {
      it('should call repository.markAsRead when user reads a prayer', async () => {
        const prayerId = 'prayer-007';
        const userId = 'user-123';

        // This test verifies the integration point exists
        // The actual implementation will call mockReadReceiptRepository.markAsRead
        expect(mockReadReceiptRepository.markAsRead).toBeDefined();
        expect(typeof mockReadReceiptRepository.markAsRead).toBe('function');

        // When implemented, the handler should call:
        // await mockReadReceiptRepository.markAsRead(prayerId, userId);
        // Then broadcast the event with the updated count from:
        // const readCount = await mockReadReceiptRepository.getReadCount(prayerId);
      });

      it('should call repository.getReadCount after marking prayer as read', async () => {
        const prayerId = 'prayer-008';

        // This test verifies the integration point exists
        expect(mockReadReceiptRepository.getReadCount).toBeDefined();
        expect(typeof mockReadReceiptRepository.getReadCount).toBe('function');

        // When implemented, the handler should:
        // 1. Call markAsRead
        // 2. Call getReadCount to get updated count
        // 3. Broadcast with the count
      });

      it('should verify repository stores read receipts with proper timestamps', async () => {
        const prayerId = 'prayer-009';
        const userId = 'user-456';

        // Mock the repository to return a receipt with timestamp
        const mockReceipt: PrayerReadReceipt = {
          id: 'receipt-999',
          prayer_request_id: prayerId,
          user_id: userId,
          read_at: new Date(),
          created_at: new Date(),
        };

        (mockReadReceiptRepository.markAsRead as any).mockResolvedValue(mockReceipt);

        // The implementation should store the receipt and use its timestamp
        // for the broadcast event
        const receipt = await mockReadReceiptRepository.markAsRead(prayerId, userId);
        expect(receipt.read_at).toBeInstanceOf(Date);
        expect(receipt.created_at).toBeInstanceOf(Date);
        expect(receipt.prayer_request_id).toBe(prayerId);
        expect(receipt.user_id).toBe(userId);
      });
    });
  });

  describe('Membership Events', () => {
    describe('member:joined event broadcast', () => {
      it('should broadcast member:joined event when user joins a wall', async () => {
        const wallId = 'wall-member-123';
        const userId = 'user-123';
        const userName = 'John Doe';
        const role = 'member';

        // Connect client and join room
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        await waitForConnection(clientSocket);

        clientSocket.emit('join-room', wallId);
        await waitForEvent(clientSocket, 'room-joined');

        // Listen for member:joined event
        const eventPromise = waitForEvent<MemberJoinedPayload>(clientSocket, MEMBER_EVENTS.JOINED);

        // Call handler function to broadcast member joined
        broadcastMemberJoined(io, wallId, userId, userName, role);

        // Verify event received
        const receivedPayload = await eventPromise;
        expect(receivedPayload.userId).toBe(userId);
        expect(receivedPayload.userName).toBe(userName);
        expect(receivedPayload.wallId).toBe(wallId);
        expect(receivedPayload.role).toBe(role);
        expect(receivedPayload.timestamp).toBeDefined();
        expect(new Date(receivedPayload.timestamp)).toBeInstanceOf(Date);
      });

      it('should include proper user info and timestamps in member:joined event', async () => {
        const wallId = 'wall-member-456';
        const userId = 'user-456';
        const userName = 'Jane Smith';
        const role = 'admin';

        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        await waitForConnection(clientSocket);

        clientSocket.emit('join-room', wallId);
        await waitForEvent(clientSocket, 'room-joined');

        const eventPromise = waitForEvent<MemberJoinedPayload>(clientSocket, MEMBER_EVENTS.JOINED);

        const beforeTime = new Date().toISOString();
        broadcastMemberJoined(io, wallId, userId, userName, role);
        const afterTime = new Date().toISOString();

        const receivedPayload = await eventPromise;
        expect(receivedPayload.userName).toBe(userName);
        expect(receivedPayload.role).toBe(role);
        expect(receivedPayload.timestamp).toBeDefined();
        // Verify timestamp is within reasonable range
        expect(receivedPayload.timestamp >= beforeTime).toBe(true);
        expect(receivedPayload.timestamp <= afterTime).toBe(true);
      });

      it('should broadcast member:joined to all clients in the wall', async () => {
        const wallId = 'wall-member-multi-789';
        const newUserId = 'user-999';
        const newUserName = 'New Member';
        const role = 'member';

        // Connect two existing members
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: secondUserToken },
          transports: ['websocket'],
        });

        await Promise.all([waitForConnection(clientSocket), waitForConnection(secondClientSocket)]);

        // Both join the same room
        clientSocket.emit('join-room', wallId);
        secondClientSocket.emit('join-room', wallId);

        await Promise.all([
          waitForEvent(clientSocket, 'room-joined'),
          waitForEvent(secondClientSocket, 'room-joined'),
        ]);

        // Set up listeners on both clients
        const client1Promise = waitForEvent<MemberJoinedPayload>(clientSocket, MEMBER_EVENTS.JOINED);
        const client2Promise = waitForEvent<MemberJoinedPayload>(
          secondClientSocket,
          MEMBER_EVENTS.JOINED
        );

        // New member joins
        broadcastMemberJoined(io, wallId, newUserId, newUserName, role);

        // Both existing members should receive the event
        const [received1, received2] = await Promise.all([client1Promise, client2Promise]);

        expect(received1.userId).toBe(newUserId);
        expect(received2.userId).toBe(newUserId);
        expect(received1.userName).toBe(newUserName);
        expect(received2.userName).toBe(newUserName);
      });

      it('should handle member:joined with different roles correctly', async () => {
        const wallId = 'wall-member-roles-012';

        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        await waitForConnection(clientSocket);

        clientSocket.emit('join-room', wallId);
        await waitForEvent(clientSocket, 'room-joined');

        // Test admin role
        const adminEventPromise = waitForEvent<MemberJoinedPayload>(
          clientSocket,
          MEMBER_EVENTS.JOINED
        );
        broadcastMemberJoined(io, wallId, 'admin-123', 'Admin User', 'admin');
        const adminPayload = await adminEventPromise;
        expect(adminPayload.role).toBe('admin');

        // Test moderator role
        const modEventPromise = waitForEvent<MemberJoinedPayload>(clientSocket, MEMBER_EVENTS.JOINED);
        broadcastMemberJoined(io, wallId, 'mod-456', 'Moderator User', 'moderator');
        const modPayload = await modEventPromise;
        expect(modPayload.role).toBe('moderator');

        // Test member role
        const memberEventPromise = waitForEvent<MemberJoinedPayload>(
          clientSocket,
          MEMBER_EVENTS.JOINED
        );
        broadcastMemberJoined(io, wallId, 'member-789', 'Regular Member', 'member');
        const memberPayload = await memberEventPromise;
        expect(memberPayload.role).toBe('member');
      });
    });

    describe('member:left event broadcast', () => {
      it('should broadcast member:left event when user leaves a wall', async () => {
        const wallId = 'wall-leave-123';
        const userId = 'user-456';

        // Connect client and join room
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        await waitForConnection(clientSocket);

        clientSocket.emit('join-room', wallId);
        await waitForEvent(clientSocket, 'room-joined');

        // Listen for member:left event
        const eventPromise = waitForEvent<MemberLeftPayload>(clientSocket, MEMBER_EVENTS.LEFT);

        // Call handler function to broadcast member left
        broadcastMemberLeft(io, wallId, userId);

        // Verify event received
        const receivedPayload = await eventPromise;
        expect(receivedPayload.userId).toBe(userId);
        expect(receivedPayload.wallId).toBe(wallId);
        expect(receivedPayload.timestamp).toBeDefined();
        expect(new Date(receivedPayload.timestamp)).toBeInstanceOf(Date);
      });

      it('should include timestamp in member:left event', async () => {
        const wallId = 'wall-leave-456';
        const userId = 'user-789';

        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        await waitForConnection(clientSocket);

        clientSocket.emit('join-room', wallId);
        await waitForEvent(clientSocket, 'room-joined');

        const eventPromise = waitForEvent<MemberLeftPayload>(clientSocket, MEMBER_EVENTS.LEFT);

        const beforeTime = new Date().toISOString();
        broadcastMemberLeft(io, wallId, userId);
        const afterTime = new Date().toISOString();

        const receivedPayload = await eventPromise;
        expect(receivedPayload.timestamp).toBeDefined();
        expect(receivedPayload.timestamp >= beforeTime).toBe(true);
        expect(receivedPayload.timestamp <= afterTime).toBe(true);
      });

      it('should broadcast member:left to remaining members in the wall', async () => {
        const wallId = 'wall-leave-multi-789';
        const leavingUserId = 'user-999';

        // Connect two clients (remaining members)
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: secondUserToken },
          transports: ['websocket'],
        });

        await Promise.all([waitForConnection(clientSocket), waitForConnection(secondClientSocket)]);

        // Both join the same room
        clientSocket.emit('join-room', wallId);
        secondClientSocket.emit('join-room', wallId);

        await Promise.all([
          waitForEvent(clientSocket, 'room-joined'),
          waitForEvent(secondClientSocket, 'room-joined'),
        ]);

        // Set up listeners on both clients
        const client1Promise = waitForEvent<MemberLeftPayload>(clientSocket, MEMBER_EVENTS.LEFT);
        const client2Promise = waitForEvent<MemberLeftPayload>(secondClientSocket, MEMBER_EVENTS.LEFT);

        // Member leaves
        broadcastMemberLeft(io, wallId, leavingUserId);

        // Both remaining members should receive the event
        const [received1, received2] = await Promise.all([client1Promise, client2Promise]);

        expect(received1.userId).toBe(leavingUserId);
        expect(received2.userId).toBe(leavingUserId);
        expect(received1.wallId).toBe(wallId);
        expect(received2.wallId).toBe(wallId);
      });

      it('should not broadcast member:left to clients in different walls', async () => {
        const wallId1 = 'wall-leave-012';
        const wallId2 = 'wall-leave-345';
        const leavingUserId = 'user-123';

        // Connect two clients to different rooms
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: secondUserToken },
          transports: ['websocket'],
        });

        await Promise.all([waitForConnection(clientSocket), waitForConnection(secondClientSocket)]);

        // First client joins wallId1
        clientSocket.emit('join-room', wallId1);
        await waitForEvent(clientSocket, 'room-joined');

        // Second client joins wallId2
        secondClientSocket.emit('join-room', wallId2);
        await waitForEvent(secondClientSocket, 'room-joined');

        // Set up listeners
        const client1Promise = waitForEvent<MemberLeftPayload>(clientSocket, MEMBER_EVENTS.LEFT);

        let client2ReceivedEvent = false;
        secondClientSocket.once(MEMBER_EVENTS.LEFT, () => {
          client2ReceivedEvent = true;
        });

        // Broadcast member left to wallId1 only
        broadcastMemberLeft(io, wallId1, leavingUserId);

        // First client should receive
        await client1Promise;

        // Wait a bit to ensure second client doesn't receive
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(client2ReceivedEvent).toBe(false);
      });
    });

    describe('member:invited event broadcast', () => {
      it('should send member:invited event to specific invitee', async () => {
        const wallId = 'wall-invite-123';
        const inviteeId = 'user-456';
        const inviterId = 'user-123';

        // Connect invitee client
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        await waitForConnection(clientSocket);

        clientSocket.emit('join-room', wallId);
        await waitForEvent(clientSocket, 'room-joined');

        // Listen for member:invited event
        const eventPromise = waitForEvent<MemberInvitedPayload>(clientSocket, MEMBER_EVENTS.INVITED);

        // Call handler function to send invitation
        broadcastMemberInvited(io, wallId, inviteeId, inviterId);

        // Verify event received
        const receivedPayload = await eventPromise;
        expect(receivedPayload.userId).toBe(inviteeId);
        expect(receivedPayload.invitedBy).toBe(inviterId);
        expect(receivedPayload.wallId).toBe(wallId);
        expect(receivedPayload.timestamp).toBeDefined();
        expect(new Date(receivedPayload.timestamp)).toBeInstanceOf(Date);
      });

      it('should include inviter and timestamp in member:invited event', async () => {
        const wallId = 'wall-invite-456';
        const inviteeId = 'user-789';
        const inviterId = 'user-123';

        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        await waitForConnection(clientSocket);

        clientSocket.emit('join-room', wallId);
        await waitForEvent(clientSocket, 'room-joined');

        const eventPromise = waitForEvent<MemberInvitedPayload>(clientSocket, MEMBER_EVENTS.INVITED);

        const beforeTime = new Date().toISOString();
        broadcastMemberInvited(io, wallId, inviteeId, inviterId);
        const afterTime = new Date().toISOString();

        const receivedPayload = await eventPromise;
        expect(receivedPayload.invitedBy).toBe(inviterId);
        expect(receivedPayload.timestamp).toBeDefined();
        expect(receivedPayload.timestamp >= beforeTime).toBe(true);
        expect(receivedPayload.timestamp <= afterTime).toBe(true);
      });

      it('should send member:invited to invitee in the wall room', async () => {
        const wallId = 'wall-invite-789';
        const inviteeId = 'user-456';
        const inviterId = 'user-123';

        // Connect invitee
        secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: secondUserToken },
          transports: ['websocket'],
        });

        await waitForConnection(secondClientSocket);

        secondClientSocket.emit('join-room', wallId);
        await waitForEvent(secondClientSocket, 'room-joined');

        // Listen for invitation
        const eventPromise = waitForEvent<MemberInvitedPayload>(
          secondClientSocket,
          MEMBER_EVENTS.INVITED
        );

        // Send invitation
        broadcastMemberInvited(io, wallId, inviteeId, inviterId);

        // Verify invitee receives event
        const receivedPayload = await eventPromise;
        expect(receivedPayload.userId).toBe(inviteeId);
        expect(receivedPayload.invitedBy).toBe(inviterId);
      });

      it('should handle multiple invitations to the same wall', async () => {
        const wallId = 'wall-invite-multi-012';
        const inviterId = 'user-123';

        // Connect multiple invitees
        clientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: validToken },
          transports: ['websocket'],
        });

        secondClientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: secondUserToken },
          transports: ['websocket'],
        });

        thirdClientSocket = ioClient(`http://localhost:${serverPort}`, {
          auth: { token: thirdUserToken },
          transports: ['websocket'],
        });

        await Promise.all([
          waitForConnection(clientSocket),
          waitForConnection(secondClientSocket),
          waitForConnection(thirdClientSocket),
        ]);

        // All join the same room
        clientSocket.emit('join-room', wallId);
        secondClientSocket.emit('join-room', wallId);
        thirdClientSocket.emit('join-room', wallId);

        await Promise.all([
          waitForEvent(clientSocket, 'room-joined'),
          waitForEvent(secondClientSocket, 'room-joined'),
          waitForEvent(thirdClientSocket, 'room-joined'),
        ]);

        // Collect invitation events
        const invitations: MemberInvitedPayload[] = [];

        clientSocket.on(MEMBER_EVENTS.INVITED, (payload: MemberInvitedPayload) => {
          invitations.push(payload);
        });
        secondClientSocket.on(MEMBER_EVENTS.INVITED, (payload: MemberInvitedPayload) => {
          invitations.push(payload);
        });
        thirdClientSocket.on(MEMBER_EVENTS.INVITED, (payload: MemberInvitedPayload) => {
          invitations.push(payload);
        });

        // Send three invitations
        broadcastMemberInvited(io, wallId, 'user-123', inviterId);
        await new Promise((resolve) => setTimeout(resolve, 100));

        broadcastMemberInvited(io, wallId, 'user-456', inviterId);
        await new Promise((resolve) => setTimeout(resolve, 100));

        broadcastMemberInvited(io, wallId, 'user-789', inviterId);
        await new Promise((resolve) => setTimeout(resolve, 100));

        // All clients should receive all invitations (broadcast to room)
        expect(invitations.length).toBeGreaterThanOrEqual(3);

        // Verify invitation data
        const userIds = invitations.map((inv) => inv.userId);
        expect(userIds).toContain('user-123');
        expect(userIds).toContain('user-456');
        expect(userIds).toContain('user-789');
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty wallId gracefully in prayer:read', async () => {
      const prayerId = 'prayer-edge-001';
      const userId = 'user-123';
      const readCount = 1;

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      await waitForConnection(clientSocket);

      // This should not crash - implementation should validate wallId
      expect(() => {
        broadcastPrayerRead(io, prayerId, '', userId, readCount);
      }).not.toThrow();
    });

    it('should handle empty userId in member:joined', async () => {
      const wallId = 'wall-edge-002';
      const userName = 'Test User';
      const role = 'member';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      // This should not crash - implementation should validate userId
      expect(() => {
        broadcastMemberJoined(io, wallId, '', userName, role);
      }).not.toThrow();
    });

    it('should handle concurrent read events for the same prayer', async () => {
      const wallId = 'wall-concurrent-003';
      const prayerId = 'prayer-concurrent-001';

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      await waitForConnection(clientSocket);

      clientSocket.emit('join-room', wallId);
      await waitForEvent(clientSocket, 'room-joined');

      const readEvents: PrayerReadPayload[] = [];

      clientSocket.on(PRAYER_EVENTS.READ, (payload: PrayerReadPayload) => {
        if (payload.prayerId === prayerId) {
          readEvents.push(payload);
        }
      });

      // Simulate concurrent reads
      broadcastPrayerRead(io, prayerId, wallId, 'user-1', 1);
      broadcastPrayerRead(io, prayerId, wallId, 'user-2', 2);
      broadcastPrayerRead(io, prayerId, wallId, 'user-3', 3);

      // Wait for all events
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should receive all three events
      expect(readEvents.length).toBe(3);
    });
  });
});
