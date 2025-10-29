import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Socket } from 'socket.io';
import * as jose from 'jose';
import { createAuthMiddleware } from '../../websocket/middleware/auth.middleware';
import type { validateTokenService } from '../../utils/token.service';

/**
 * WebSocket Authentication Middleware Tests
 *
 * These tests verify the JWT authentication middleware for Socket.io connections.
 * The middleware validates tokens from handshake auth, headers, or query params,
 * and attaches user context to the socket for authenticated connections.
 *
 * IMPORTANT: Following TDD - these tests should FAIL until the middleware is implemented.
 */
describe('WebSocket Auth Middleware', () => {
  let mockSocket: Partial<Socket>;
  let nextCallback: ReturnType<typeof vi.fn>;
  let mockValidateTokenService: typeof validateTokenService;
  const testSecret = new TextEncoder().encode('test-secret-key-for-websocket-testing');
  let validToken: string;
  let expiredToken: string;
  let malformedToken: string;

  beforeEach(async () => {
    // Create valid JWT token for testing (HS256 for test environment)
    validToken = await new jose.SignJWT({
      sub: 'test-user-123',
      realm: 'test-realm',
      email: 'test@example.com'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(testSecret);

    // Create expired JWT token
    expiredToken = await new jose.SignJWT({
      sub: 'test-user-expired',
      realm: 'test-realm'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('-1h') // Already expired
      .sign(testSecret);

    // Create malformed token
    malformedToken = 'invalid.jwt.token.format';

    // Mock Socket object with minimal required properties
    mockSocket = {
      id: 'socket-test-id-123',
      handshake: {
        auth: {},
        headers: {},
        query: {},
        time: '',
        address: '',
        xdomain: false,
        secure: false,
        issued: 0,
        url: '',
      },
      data: {},
    };

    // Mock the next callback
    nextCallback = vi.fn();

    // Mock validateTokenService - default to successful validation
    mockValidateTokenService = vi.fn().mockImplementation(async (token: string) => {
      if (token === validToken) {
        const { payload } = await jose.jwtVerify(token, testSecret);
        return [undefined, { payload, protectedHeader: { alg: 'HS256' } }];
      }

      if (token === expiredToken) {
        throw new jose.errors.JWTExpired('Token has expired');
      }

      if (token === malformedToken) {
        throw new jose.errors.JWTInvalid('Token is malformed');
      }

      throw new Error('Invalid token');
    });
  });

  describe('Valid JWT Authentication', () => {
    it('should attach user context to socket.data when token is valid from auth object', async () => {
      // Arrange
      mockSocket.handshake!.auth = { token: validToken };
      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(mockSocket.data.userId).toBe('test-user-123');
      expect(mockSocket.data.user).toBeDefined();
      expect(mockSocket.data.user.payload.sub).toBe('test-user-123');
      expect(mockSocket.data.user.payload.email).toBe('test@example.com');
      expect(nextCallback).toHaveBeenCalledWith(); // Called without error
      expect(nextCallback).toHaveBeenCalledTimes(1);
    });

    it('should attach user context when token is valid from authorization header', async () => {
      // Arrange
      mockSocket.handshake!.headers = {
        authorization: `Bearer ${validToken}`
      };
      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(mockSocket.data.userId).toBe('test-user-123');
      expect(mockSocket.data.user).toBeDefined();
      expect(nextCallback).toHaveBeenCalledWith(); // Called without error
    });

    it('should attach user context when token is valid from query params', async () => {
      // Arrange
      mockSocket.handshake!.query = { token: validToken };
      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(mockSocket.data.userId).toBe('test-user-123');
      expect(mockSocket.data.user).toBeDefined();
      expect(nextCallback).toHaveBeenCalledWith(); // Called without error
    });

    it('should prioritize auth token over header and query param', async () => {
      // Arrange - provide tokens in all locations, auth should win
      mockSocket.handshake!.auth = { token: validToken };
      mockSocket.handshake!.headers = { authorization: 'Bearer wrong-token' };
      mockSocket.handshake!.query = { token: 'another-wrong-token' };

      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(mockSocket.data.userId).toBe('test-user-123');
      expect(nextCallback).toHaveBeenCalledWith(); // Called without error
    });
  });

  describe('Invalid/Malformed Token Rejection', () => {
    it('should call next with error when token is malformed', async () => {
      // Arrange
      mockSocket.handshake!.auth = { token: malformedToken };
      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(mockSocket.data.userId).toBeUndefined();
      expect(mockSocket.data.user).toBeUndefined();
      expect(nextCallback).toHaveBeenCalledWith(expect.any(Error));
      expect(nextCallback).toHaveBeenCalledTimes(1);

      const error = nextCallback.mock.calls[0][0] as Error;
      expect(error.message).toContain('Invalid or expired token');
    });

    it('should call next with error when token validation fails', async () => {
      // Arrange
      const invalidToken = 'completely-invalid-token';
      mockSocket.handshake!.auth = { token: invalidToken };

      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(mockSocket.data.userId).toBeUndefined();
      expect(nextCallback).toHaveBeenCalledWith(expect.any(Error));

      const error = nextCallback.mock.calls[0][0] as Error;
      expect(error.message).toContain('Invalid or expired token');
    });
  });

  describe('Expired Token Rejection', () => {
    it('should call next with error when token is expired', async () => {
      // Arrange
      mockSocket.handshake!.auth = { token: expiredToken };
      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(mockSocket.data.userId).toBeUndefined();
      expect(mockSocket.data.user).toBeUndefined();
      expect(nextCallback).toHaveBeenCalledWith(expect.any(Error));

      const error = nextCallback.mock.calls[0][0] as Error;
      expect(error.message).toContain('Invalid or expired token');
    });
  });

  describe('Missing Token Rejection', () => {
    it('should call next with error when no token is provided', async () => {
      // Arrange - no token in auth, headers, or query
      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(mockSocket.data.userId).toBeUndefined();
      expect(mockSocket.data.user).toBeUndefined();
      expect(nextCallback).toHaveBeenCalledWith(expect.any(Error));

      const error = nextCallback.mock.calls[0][0] as Error;
      expect(error.message).toBe('Authentication token required');
    });

    it('should call next with error when auth object is empty', async () => {
      // Arrange
      mockSocket.handshake!.auth = {};
      mockSocket.handshake!.headers = {};
      mockSocket.handshake!.query = {};

      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(nextCallback).toHaveBeenCalledWith(expect.any(Error));
      const error = nextCallback.mock.calls[0][0] as Error;
      expect(error.message).toBe('Authentication token required');
    });
  });

  describe('User Context Extraction', () => {
    it('should extract userId from token payload sub claim', async () => {
      // Arrange
      const customToken = await new jose.SignJWT({
        sub: 'custom-user-id-456',
        realm: 'test-realm',
        name: 'Custom User'
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(testSecret);

      mockSocket.handshake!.auth = { token: customToken };

      // Update mock to handle custom token
      mockValidateTokenService = vi.fn().mockImplementation(async (token: string) => {
        if (token === customToken) {
          const { payload } = await jose.jwtVerify(token, testSecret);
          return [undefined, { payload, protectedHeader: { alg: 'HS256' } }];
        }
        throw new Error('Invalid token');
      });

      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(mockSocket.data.userId).toBe('custom-user-id-456');
      expect(mockSocket.data.user.payload.sub).toBe('custom-user-id-456');
      expect(mockSocket.data.user.payload.name).toBe('Custom User');
    });

    it('should preserve all payload claims in socket.data.user', async () => {
      // Arrange
      const tokenWithClaims = await new jose.SignJWT({
        sub: 'user-789',
        realm: 'production',
        email: 'user@example.com',
        roles: ['user', 'admin'],
        organization: 'test-org'
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(testSecret);

      mockSocket.handshake!.auth = { token: tokenWithClaims };

      mockValidateTokenService = vi.fn().mockImplementation(async (token: string) => {
        if (token === tokenWithClaims) {
          const { payload } = await jose.jwtVerify(token, testSecret);
          return [undefined, { payload, protectedHeader: { alg: 'HS256' } }];
        }
        throw new Error('Invalid token');
      });

      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'production'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(mockSocket.data.user.payload.sub).toBe('user-789');
      expect(mockSocket.data.user.payload.email).toBe('user@example.com');
      expect(mockSocket.data.user.payload.roles).toEqual(['user', 'admin']);
      expect(mockSocket.data.user.payload.organization).toBe('test-org');
    });
  });

  describe('Configuration Error Handling', () => {
    it('should call next with error when IAM endpoint is not provided', async () => {
      // Arrange
      mockSocket.handshake!.auth = { token: validToken };
      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        '', // Empty endpoint
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(nextCallback).toHaveBeenCalledWith(expect.any(Error));
      const error = nextCallback.mock.calls[0][0] as Error;
      expect(error.message).toContain('Server configuration error');
    });

    it('should call next with error when IAM realm is not provided', async () => {
      // Arrange
      mockSocket.handshake!.auth = { token: validToken };
      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        '' // Empty realm
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(nextCallback).toHaveBeenCalledWith(expect.any(Error));
      const error = nextCallback.mock.calls[0][0] as Error;
      expect(error.message).toContain('Server configuration error');
    });
  });

  describe('Test Token Handling (HS256)', () => {
    it('should handle HS256 test tokens in test environment', async () => {
      // Arrange
      const testEnvToken = await new jose.SignJWT({
        sub: 'test-env-user',
        realm: 'test'
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(testSecret);

      mockSocket.handshake!.auth = { token: testEnvToken };

      // Mock for test environment
      mockValidateTokenService = vi.fn().mockImplementation(async (token: string) => {
        // Simulate test environment behavior
        const { payload } = await jose.jwtVerify(token, testSecret);
        return [undefined, { payload, protectedHeader: { alg: 'HS256' } }];
      });

      const middleware = createAuthMiddleware(
        mockValidateTokenService,
        'https://iam.example.com',
        'test-realm'
      );

      // Act
      await middleware(mockSocket as Socket, nextCallback);

      // Assert
      expect(mockSocket.data.userId).toBe('test-env-user');
      expect(mockSocket.data.user).toBeDefined();
      expect(nextCallback).toHaveBeenCalledWith(); // No error
    });
  });
});
