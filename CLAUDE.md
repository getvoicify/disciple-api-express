- Always use the safeExecute utility for promises and unsafe function calls that require a try/catch block.
- NEVER use `console.log`, `console.error`, or `console.warn`. Always use the structured logger instead.

## Logging Guidelines

This project uses a structured logging system based on Pino with an abstraction layer for easy replacement.

### Core Principles
- **Never use console.*** - Always use the structured logger
- **Request-scoped logging** - Use `req.log` in Express handlers for automatic correlation IDs and context
- **Application-wide logging** - Import the singleton `logger` for non-request contexts
- **Structured data** - Always pass context as an object, message as a string

### Usage Patterns

**In Express endpoints/middleware** (request-scoped with correlation ID):
```typescript
// Access via req.log (attached by request logging middleware)
(req as any).log?.info({ userId, noteId }, 'Note created successfully');
(req as any).log?.error({ error, mediaId }, 'Media proxy error');
(req as any).log?.warn({ key }, 'Cache hit');
(req as any).log?.debug({ count }, 'Processing items');
```

**In services, repositories, utilities** (application-wide):
```typescript
import { logger } from '../logging';

logger.info({ userId, resourceId }, 'Resource created');
logger.error({ error, operation }, 'Database operation failed');
logger.warn({ resourceId }, 'Resource already exists');
logger.debug({ count }, 'Processing batch');
```

### Log Levels (from least to most severe)
- `trace` - Very detailed debugging (rarely used)
- `debug` - Detailed information for debugging
- `info` - General informational messages
- `warn` - Warning messages for recoverable issues
- `error` - Error messages for failures
- `fatal` - Critical errors causing shutdown

### Context First, Message Second
```typescript
// ✅ CORRECT - context object first, message second
logger.error({ error, userId, action }, 'Failed to process request');
req.log?.info({ orderId, status }, 'Order updated');

// ❌ WRONG - don't pass just a string
logger.error('An error occurred');

// ❌ WRONG - don't concatenate context into message
logger.error(`Error for user ${userId}: ${error.message}`);
```

### Best Practices
1. **Include error objects**: `logger.error({ error }, 'Operation failed')`
2. **Add relevant IDs**: `{ userId, resourceId, transactionId }`
3. **Use appropriate levels**: 4xx → warn, 5xx → error
4. **Be concise but descriptive**: Messages should explain what happened
5. **Sensitive data redaction**: Passwords, tokens, auth headers are automatically redacted

### Examples from Codebase

**Error Handler Middleware** (src/middleware/error-handler.middleware.ts:58):
```typescript
const logger = getLogger(req);
if (logger) {
  logger.error({
    message: err.message,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
  }, 'Request error');
}
```

**Cache Operations** (src/cache/redis-cache.repository.ts:26):
```typescript
this.redis.on('error', (error: Error) => {
  logger.error({ error: error.message }, 'Redis connection error');
});
```

**Keycloak Operations** (src/keycloak/outbox.publisher.ts:57):
```typescript
logger.warn({ eventId: event.id, error: error.message }, 'Graceful error processing Keycloak event');
```

### Logger Abstraction
The logger uses interfaces (`ILogger`, `ILoggerFactory`) so you can swap Pino for Winston, Bunyan, or any other implementation without changing application code. See `src/logging/` for the abstraction layer.

## User Object Access Pattern

When accessing the authenticated user in Express endpoints, always use the following pattern:

```typescript
const user = req.user?.[1]?.['payload'];
const userId = user?.['sub'];
```

**Alternative compact syntax:**
```typescript
const userId = req['user']?.[1].payload?.sub || '';
```

**Key Details:**
- The `User` type is defined as `jose.JWTPayload[]` (an array of JWT payloads)
- The authenticated user payload is at **index 1** (`user[1]`)
- The user data is nested within a `payload` property
- The user ID is accessed via the `sub` property from the JWT payload
- Always use the `EndpointRequest` type from `src/types/endpoint-handler.ts` instead of Express's `Request` type
- The `EndpointRequest` type extends Express's `Request` with `user?: User`

**Example from codebase:**
```typescript
import type { EndpointRequest } from '../../types/endpoint-handler';

export const someEndpoint = (service: SomeService) => {
  return async (req: EndpointRequest, res: Response, next: NextFunction) => {
    const user = req.user?.[1]?.['payload'];
    const userId = user?.['sub'];
    if (!userId) {
      return next(new Error('User context is required'));
    }

    // Use userId here
    const [error, result] = await safeExecute(service.doSomething(userId as string));
  };
};
```

## safeExecute Utility Memory

The `safeExecute` function in `src/utils/handle-async.ts` eliminates try/catch blocks by returning a tuple pattern `[Error] | [undefined, T]`.

### Function Signatures:
```typescript
safeExecute<T>(promise: Promise<T>): Promise<[Error] | [undefined, T]>
safeExecute<T>(fn: () => T | Promise<T>): Promise<[Error] | [undefined, T]>
```

### Always use safeExecute for:
- Database operations (`repository.findById()`, `repository.create()`)
- File system operations (`fs.readFile()`, `fs.unlink()`)
- External API calls (`fetch()`, HTTP requests)
- Cloud service operations (S3, R2 uploads/downloads)
- Any Promise that might reject
- Synchronous operations that might throw

### Standard Pattern:
```typescript
const [error, result] = await safeExecute(someAsyncOperation());
if (error) {
    // handle error
    return;
}
// use result safely
```

### Examples from codebase:
- `safeExecute(mediaRepository.findById(mediaId))` - Database query
- `safeExecute(() => import('fs').then(fs => fs.readFileSync(path)))` - File operations
- `safeExecute(service.createNote(data, ownerId))` - Service calls
- `safeExecute(this.s3Client.send(command))` - Cloud operations
- For unsafe executions, the proper way to use safeExecute is `safeExecute(() => unsafeFn())`
- Services should always throw custom errors based on the AppError class or one of the other classes that extends it

## WebSocket Guidelines

This project uses Socket.io for real-time prayer wall communication. Follow these patterns when working with WebSocket features.

### Core Principles
- **Use helper functions** - Import and use broadcasting helpers from `src/websocket/handlers`
- **Respect anonymity** - Check prayer anonymity settings before broadcasting author info
- **Event naming** - Follow the `resource:action` pattern (e.g., `prayer:created`, `user:online`)
- **Room-based** - All events are broadcast to specific prayer wall rooms (wallId)
- **Structured logging** - Use the logger for WebSocket events, never console.*

### Broadcasting from Endpoints

When REST endpoints create/update/delete resources that need real-time updates, broadcast the event to connected clients.

**Pattern:**
```typescript
import { broadcastPrayerCreated } from '../../websocket/handlers/prayer.handler';
import type { Server } from 'socket.io';

export const createPrayer = (service: PrayerService, io: Server) => {
  return async (req: EndpointRequest, res: Response) => {
    const [error, prayer] = await safeExecute(service.create(data, userId));
    if (error) {
      // handle error...
    }

    // Broadcast to all connected clients in the prayer wall room
    broadcastPrayerCreated(io, prayer, authorName);

    res.status(201).json({ success: true, data: prayer });
  };
};
```

**Key Points:**
- The Socket.io server instance (`io`) is passed to route handlers via dependency injection
- Use the appropriate broadcasting helper function (never call `io.to().emit()` directly)
- Broadcasting happens AFTER successful database operations
- Extract author name from JWT payload before broadcasting

### Available Broadcasting Helpers

Import these from `src/websocket/handlers`:

**Prayer Events:**
```typescript
import {
  broadcastPrayerCreated,
  broadcastPrayerUpdated,
  broadcastPrayerDeleted,
  broadcastPrayerResponse,
  broadcastPrayerReply,
} from '../websocket/handlers/prayer.handler';

// Usage:
broadcastPrayerCreated(io, prayer, authorName);
broadcastPrayerUpdated(io, wallId, prayerId, updatedContent);
broadcastPrayerDeleted(io, wallId, prayerId);
```

**Moderation Events:**
```typescript
import {
  broadcastContentFlagged,
  broadcastContentHidden,
  broadcastContentRestored,
  broadcastUserBanned,
} from '../websocket/handlers/moderation.handler';

// Usage (to pastors only):
broadcastContentFlagged(io, wallId, contentId, contentType, flaggedBy, reason);

// Usage (to all members):
broadcastContentHidden(io, wallId, contentId, contentType, hiddenBy, reason);
```

**Presence Events:**
```typescript
import {
  broadcastUserOnline,
  broadcastUserOffline,
  broadcastTypingStart,
  broadcastTypingStop,
} from '../websocket/handlers/presence.handler';

// Usage:
broadcastUserOnline(io, wallId, userId, userName);
broadcastUserOffline(io, wallId, userId);
```

**Generic Broadcasting:**
```typescript
import { broadcastToWall } from '../websocket/handlers/prayer.handler';

// For custom events:
broadcastToWall(io, wallId, 'custom:event', { data: 'value' });
```

### Anonymity Enforcement

ALWAYS check prayer anonymity settings before including author information in broadcasts:

```typescript
// From src/websocket/handlers/prayer.handler.ts
export function broadcastPrayerCreated(
  io: Server,
  prayer: Prayer,
  authorName?: string
): void {
  const payload: PrayerCreatedPayload = {
    prayerId: prayer.id,
    wallId: prayer.wallId,
    content: prayer.content,
    authorId: prayer.anonymity === 'identified' ? prayer.authorId : undefined,
    authorName: prayer.anonymity === 'identified' ? authorName :
                prayer.anonymity === 'anonymous_to_members' ? 'Anonymous Member' :
                'Anonymous',
    isAnonymous: prayer.anonymity !== 'identified',
    createdAt: prayer.createdAt.toISOString(),
  };

  io.to(prayer.wallId).emit('prayer:created', payload);
}
```

**Anonymity Settings:**
- `identified` - Include full author ID and name
- `anonymous_to_members` - Show "Anonymous Member" (no ID)
- `fully_anonymous` - Show "Anonymous" (no ID)

### Integrating Socket.io with Routes

Routes receive the Socket.io server instance and pass it to endpoints:

**Example from src/prayer-walls/routes/prayers.routes.ts:**
```typescript
import { Server } from 'socket.io';

export default function prayersRouter(
  service: PrayerRequestService,
  io: Server  // Socket.io instance
): Router {
  const router = Router();

  router.post(
    '/prayer-walls/:wallId/prayers',
    requireAuth,
    createPrayer(service, io)  // Pass io to endpoint
  );

  return router;
}
```

**In src/index.ts:**
```typescript
// Initialize Socket.io server
const io = initializeSocketServer(httpServer, {
  redisUrl: process.env.REDIS_URL,
  iamEndpoint: IAM_ENDPOINT,
  iamRealm: IAM_REALM,
});

// Pass io to routes that need real-time features
app.use('/api', prayersRouter(prayerRequestService, io));
app.use('/api', moderationRouter(moderationService, prayerRequestRepository, io));
```

### Event Naming Conventions

Follow these patterns for event names (defined in `src/websocket/events.ts`):

| Pattern | Examples | Usage |
|---------|----------|-------|
| `resource:action` | `prayer:created`, `prayer:updated` | CRUD operations |
| `entity:state` | `user:online`, `user:offline` | Status changes |
| `action:verb` | `typing:start`, `typing:stop` | Transient actions |
| `subject:verb` | `content:flagged`, `content:hidden` | Moderation |
| `noun-noun` | `join-room`, `leave-room` | Client commands |

**NEVER create custom event names without adding them to `src/websocket/events.ts` first.**

### Testing WebSocket Handlers

Mock the Socket.io server in tests:

```typescript
import { Server } from 'socket.io';
import { broadcastPrayerCreated } from '../handlers/prayer.handler';

describe('Prayer Broadcasting', () => {
  let mockIo: jest.Mocked<Server>;

  beforeEach(() => {
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;
  });

  it('should broadcast prayer created event', () => {
    const prayer = {
      id: 'prayer-123',
      wallId: 'wall-456',
      content: 'Test prayer',
      anonymity: 'identified',
      authorId: 'user-789',
      createdAt: new Date(),
    };

    broadcastPrayerCreated(mockIo, prayer, 'John Doe');

    expect(mockIo.to).toHaveBeenCalledWith('wall-456');
    expect(mockIo.emit).toHaveBeenCalledWith('prayer:created', {
      prayerId: 'prayer-123',
      wallId: 'wall-456',
      content: 'Test prayer',
      authorId: 'user-789',
      authorName: 'John Doe',
      isAnonymous: false,
      createdAt: expect.any(String),
    });
  });
});
```

### Logging WebSocket Events

Use the structured logger for WebSocket operations:

```typescript
import { logger } from '../logging';

// In WebSocket handlers
socket.on('join-room', async (payload: RoomJoinPayload) => {
  const { roomId } = payload;
  const userId = socket.data.userId;

  logger.info({ userId, roomId }, 'User joining prayer wall room');

  await socket.join(roomId);

  logger.info({ userId, roomId }, 'User successfully joined room');
});

// Error handling
socket.on('error', (error: Error) => {
  logger.error({ error, socketId: socket.id }, 'WebSocket error occurred');
});
```

### Common Patterns

**Pattern 1: Broadcast after database operation**
```typescript
// 1. Perform database operation with safeExecute
const [error, prayer] = await safeExecute(service.createPrayer(data));
if (error) return handleError(error);

// 2. Extract any required context (author name, etc.)
const authorName = extractUserName(req.user);

// 3. Broadcast to connected clients
broadcastPrayerCreated(io, prayer, authorName);

// 4. Return HTTP response
res.status(201).json({ success: true, data: prayer });
```

**Pattern 2: Conditional broadcasting based on anonymity**
```typescript
// Broadcasting respects anonymity settings automatically
broadcastPrayerCreated(io, prayer, authorName);
// Helper function handles:
// - identified: sends full author info
// - anonymous_to_members: sends "Anonymous Member"
// - fully_anonymous: sends "Anonymous"
```

**Pattern 3: Multiple broadcasts for related actions**
```typescript
// Example: Hiding content broadcasts to all, flagging to pastors only
await service.hideContent(contentId, reason);

// Broadcast to all members that content is hidden
broadcastContentHidden(io, wallId, contentId, contentType, moderatorId, reason);

// If it was flagged, pastors were already notified via broadcastContentFlagged
```

### Files Reference

Key WebSocket implementation files:
- `src/websocket/socket.server.ts` - Server initialization (lines 351-355 in src/index.ts)
- `src/websocket/events.ts` - Event type definitions and payloads
- `src/websocket/middleware/auth.middleware.ts` - JWT authentication for connections
- `src/websocket/handlers/prayer.handler.ts` - Prayer broadcasting helpers
- `src/websocket/handlers/presence.handler.ts` - Presence/typing handlers
- `src/websocket/handlers/moderation.handler.ts` - Moderation broadcasting
- `src/websocket/services/user-info-extractor.service.ts` - Extract user names from JWT