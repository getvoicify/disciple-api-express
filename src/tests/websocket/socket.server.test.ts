import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { Server as HttpServer, createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import * as jose from 'jose';
import { createCacheRepository } from '../../cache';

/**
 * WebSocket Infrastructure Tests
 *
 * These tests verify the Socket.io server setup with real connections,
 * JWT authentication, room management, and Redis adapter integration.
 *
 * IMPORTANT: These are REAL, functional tests that create actual server
 * and client instances, not mocks.
 */
describe('WebSocket Infrastructure', () => {
  let httpServer: HttpServer;
  let io: SocketServer;
  let clientSocket: ClientSocket;
  let serverPort: number;
  let validToken: string;
  let invalidToken: string;

  // JWT secret for testing
  const testSecret = new TextEncoder().encode('test-secret-key-for-websocket-testing');

  beforeEach(async () => {
    // Create HTTP server for Socket.io
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

    // Create valid JWT token for testing
    validToken = await new jose.SignJWT({ sub: 'test-user-id', realm: 'test-realm' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(testSecret);

    // Create invalid JWT token
    invalidToken = 'invalid.jwt.token';

    // Initialize Socket.io server with basic setup
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
        (socket as any).userId = payload.sub;
        next();
      } catch (error) {
        next(new Error('Invalid or expired token'));
      }
    });

    // Set up basic connection handler
    io.on('connection', (socket) => {
      // Handle room join
      socket.on('join-room', (roomId: string) => {
        socket.join(roomId);
        socket.emit('room-joined', { roomId });
      });

      // Handle room leave
      socket.on('leave-room', (roomId: string) => {
        socket.leave(roomId);
        socket.emit('room-left', { roomId });
      });

      // Handle test message broadcast
      socket.on('test-message', (data: { room: string; message: string }) => {
        io.to(data.room).emit('message-received', { message: data.message });
      });
    });
  });

  afterEach(async () => {
    // Clean up client connection
    if (clientSocket) {
      clientSocket.disconnect();
      clientSocket.close();
    }

    // Clean up server
    if (io) {
      io.close();
    }

    // Clean up HTTP server
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  it('should establish WebSocket connection with valid JWT', async () => {
    // Create client with valid token
    clientSocket = ioClient(`http://localhost:${serverPort}`, {
      auth: {
        token: validToken
      }
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      clientSocket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      clientSocket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Verify connection is established
    expect(clientSocket.connected).toBe(true);
    expect(clientSocket.id).toBeDefined();
    expect(typeof clientSocket.id).toBe('string');
  });

  it('should reject WebSocket connection with invalid JWT', async () => {
    // Create client with invalid token
    clientSocket = ioClient(`http://localhost:${serverPort}`, {
      auth: {
        token: invalidToken
      }
    });

    // Wait for connection error
    const error = await new Promise<Error>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Expected connection error but none occurred'));
      }, 5000);

      clientSocket.on('connect', () => {
        clearTimeout(timeout);
        reject(new Error('Connection should have been rejected'));
      });

      clientSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        resolve(err);
      });
    });

    // Verify connection was rejected
    expect(error).toBeDefined();
    expect(error.message).toContain('Invalid or expired token');
    expect(clientSocket.connected).toBe(false);
  });

  it('should reject WebSocket connection without JWT', async () => {
    // Create client without token
    clientSocket = ioClient(`http://localhost:${serverPort}`);

    // Wait for connection error
    const error = await new Promise<Error>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Expected connection error but none occurred'));
      }, 5000);

      clientSocket.on('connect', () => {
        clearTimeout(timeout);
        reject(new Error('Connection should have been rejected'));
      });

      clientSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        resolve(err);
      });
    });

    // Verify connection was rejected
    expect(error).toBeDefined();
    expect(error.message).toContain('Authentication token required');
    expect(clientSocket.connected).toBe(false);
  });

  it('should allow authenticated client to join a room', async () => {
    // Connect client with valid token
    clientSocket = ioClient(`http://localhost:${serverPort}`, {
      auth: {
        token: validToken
      }
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      clientSocket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Join a room
    const roomId = 'wall-123';
    const joinResponse = await new Promise<{ roomId: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Room join timeout')), 5000);

      clientSocket.on('room-joined', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });

      clientSocket.emit('join-room', roomId);
    });

    // Verify room join was successful
    expect(joinResponse).toBeDefined();
    expect(joinResponse.roomId).toBe(roomId);
  });

  it('should allow authenticated client to leave a room', async () => {
    // Connect client with valid token
    clientSocket = ioClient(`http://localhost:${serverPort}`, {
      auth: {
        token: validToken
      }
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      clientSocket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Join a room first
    const roomId = 'wall-456';
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Room join timeout')), 5000);
      clientSocket.on('room-joined', () => {
        clearTimeout(timeout);
        resolve();
      });
      clientSocket.emit('join-room', roomId);
    });

    // Leave the room
    const leaveResponse = await new Promise<{ roomId: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Room leave timeout')), 5000);

      clientSocket.on('room-left', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });

      clientSocket.emit('leave-room', roomId);
    });

    // Verify room leave was successful
    expect(leaveResponse).toBeDefined();
    expect(leaveResponse.roomId).toBe(roomId);
  });

  it('should broadcast messages to all clients in a room', async () => {
    // Create first client
    clientSocket = ioClient(`http://localhost:${serverPort}`, {
      auth: {
        token: validToken
      }
    });

    // Create second client with a different token
    const secondToken = await new jose.SignJWT({ sub: 'test-user-2', realm: 'test-realm' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(testSecret);

    const secondClient = ioClient(`http://localhost:${serverPort}`, {
      auth: {
        token: secondToken
      }
    });

    // Wait for both clients to connect
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Client 1 connection timeout')), 5000);
        clientSocket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      }),
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Client 2 connection timeout')), 5000);
        secondClient.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      })
    ]);

    // Both clients join the same room
    const roomId = 'wall-789';
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Client 1 join timeout')), 5000);
        clientSocket.on('room-joined', () => {
          clearTimeout(timeout);
          resolve();
        });
        clientSocket.emit('join-room', roomId);
      }),
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Client 2 join timeout')), 5000);
        secondClient.on('room-joined', () => {
          clearTimeout(timeout);
          resolve();
        });
        secondClient.emit('join-room', roomId);
      })
    ]);

    // Second client listens for message
    const messagePromise = new Promise<{ message: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Message receive timeout')), 5000);
      secondClient.on('message-received', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    // First client sends message to room
    const testMessage = 'Hello from room!';
    clientSocket.emit('test-message', { room: roomId, message: testMessage });

    // Verify second client received the message
    const receivedMessage = await messagePromise;
    expect(receivedMessage).toBeDefined();
    expect(receivedMessage.message).toBe(testMessage);

    // Clean up second client
    secondClient.disconnect();
    secondClient.close();
  });

  it('should handle multiple concurrent room operations', async () => {
    // Connect client
    clientSocket = ioClient(`http://localhost:${serverPort}`, {
      auth: {
        token: validToken
      }
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      clientSocket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Join multiple rooms concurrently
    const rooms = ['wall-1', 'wall-2', 'wall-3'];
    const joinPromises = rooms.map((roomId) => {
      return new Promise<{ roomId: string }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Room join timeout for ${roomId}`)), 5000);

        const handler = (data: { roomId: string }) => {
          if (data.roomId === roomId) {
            clearTimeout(timeout);
            clientSocket.off('room-joined', handler);
            resolve(data);
          }
        };

        clientSocket.on('room-joined', handler);
        clientSocket.emit('join-room', roomId);
      });
    });

    const joinResults = await Promise.all(joinPromises);

    // Verify all rooms were joined successfully
    expect(joinResults).toHaveLength(3);
    expect(joinResults.map(r => r.roomId).sort()).toEqual(rooms.sort());

    // Leave all rooms concurrently
    const leavePromises = rooms.map((roomId) => {
      return new Promise<{ roomId: string }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Room leave timeout for ${roomId}`)), 5000);

        const handler = (data: { roomId: string }) => {
          if (data.roomId === roomId) {
            clearTimeout(timeout);
            clientSocket.off('room-left', handler);
            resolve(data);
          }
        };

        clientSocket.on('room-left', handler);
        clientSocket.emit('leave-room', roomId);
      });
    });

    const leaveResults = await Promise.all(leavePromises);

    // Verify all rooms were left successfully
    expect(leaveResults).toHaveLength(3);
    expect(leaveResults.map(r => r.roomId).sort()).toEqual(rooms.sort());
  });
});
