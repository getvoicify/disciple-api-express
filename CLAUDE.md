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