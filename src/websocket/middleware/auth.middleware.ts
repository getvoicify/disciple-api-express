import type { Socket } from 'socket.io';
import { jwtVerify } from 'jose';
import { logger } from '../../logging';
import { safeExecute } from '../../utils/handle-async';
import type { validateTokenService } from '../../utils/token.service';

/**
 * Creates WebSocket authentication middleware that validates JWT tokens
 *
 * This middleware extracts JWT tokens from the WebSocket handshake (auth object,
 * authorization header, or query parameters), validates them using the provided
 * token validation service, and attaches user context to the socket for authenticated
 * connections.
 *
 * @param validateTokenService - Token validation service function
 * @param iamEndpoint - IAM endpoint URL for token validation
 * @param iamRealm - IAM realm name for token validation
 * @returns Socket.io middleware function that validates authentication
 *
 * @example
 * ```typescript
 * const authMiddleware = createAuthMiddleware(
 *   validateTokenService,
 *   'https://iam.example.com',
 *   'production'
 * );
 * io.use(authMiddleware);
 * ```
 */
export const createAuthMiddleware = (
  tokenValidator: typeof validateTokenService,
  iamEndpoint: string,
  iamRealm: string
) => {
  return async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
    // 1. Validate configuration
    if (!iamEndpoint) {
      logger.error('IAM endpoint is not configured');
      return next(new Error('Server configuration error'));
    }

    if (!iamRealm) {
      logger.error('IAM realm is not configured');
      return next(new Error('Server configuration error'));
    }

    // 2. Extract token (priority: auth > header > query)
    let token: string | undefined;

    // Highest priority: auth object
    if (socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }
    // Medium priority: authorization header
    else if (socket.handshake.headers?.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      // Strip "Bearer " prefix if present
      token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;
    }
    // Lowest priority: query parameter
    else if (socket.handshake.query?.token) {
      token = socket.handshake.query.token as string;
    }

    // Check if token was found
    if (!token) {
      logger.warn({ socketId: socket.id }, 'WebSocket connection attempt without token');
      return next(new Error('Authentication token required'));
    }

    // 3. Validate token
    const [error, result] = await safeExecute(
      tokenValidator(token, iamEndpoint, iamRealm, jwtVerify)
    );

    if (error || !result) {
      const errorMessage = error?.message || 'Token validation failed';
      logger.warn({ error: errorMessage, socketId: socket.id }, 'WebSocket authentication failed');
      return next(new Error('Invalid or expired token'));
    }

    // 4. Extract user context from validation result
    // result is [undefined, { payload, protectedHeader }]
    const verifyResult = result[1] as any;
    const payload = verifyResult.payload;
    const userId = payload?.sub as string;

    if (!userId) {
      logger.warn({ socketId: socket.id }, 'Token validation succeeded but no user ID found');
      return next(new Error('Invalid or expired token'));
    }

    // 5. Attach user context to socket
    socket.data.userId = userId;
    socket.data.user = verifyResult;

    logger.info({ userId, socketId: socket.id }, 'WebSocket authentication successful');

    // 6. Continue to next middleware
    next();
  };
};
