## Logging best practices

### Core Principles
- **Never use console.*** - Always use the structured logger
- **Request-scoped logging** - Use `req.log` in Express handlers for automatic correlation IDs and context
- **Application-wide logging** - Import the singleton `logger` for non-request contexts
- **Structured data** - Always pass context as an object, message as a string
- **Context first, message second** - Context object first parameter, message as second parameter

### Usage Patterns

#### In Express Endpoints (Request-Scoped)
Access via `req.log` (attached by request logging middleware) for automatic correlation IDs:

```typescript
(req as any).log?.info({ userId, noteId }, 'Note created successfully');
(req as any).log?.error({ error, mediaId }, 'Media proxy error');
(req as any).log?.warn({ key }, 'Cache hit');
(req as any).log?.debug({ count }, 'Processing items');
```

#### In Services, Repositories, Utilities (Application-Wide)
Import and use the singleton logger:

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

**ALWAYS pass context as the first parameter (object) and message as the second parameter (string):**

```typescript
// ✅ CORRECT - context object first, message second
logger.error({ error, userId, action }, 'Failed to process request');
(req as any).log?.info({ orderId, status }, 'Order updated');

// ❌ WRONG - don't pass just a string
logger.error('An error occurred');

// ❌ WRONG - don't concatenate context into message
logger.error(`Error for user ${userId}: ${error.message}`);
```

### Best Practices

#### Include Relevant Context
Always include IDs and relevant context:
```typescript
logger.error({ error, userId, resourceId, transactionId }, 'Operation failed');
```

#### Log at Appropriate Levels
- **4xx errors** → `warn`
- **5xx errors** → `error`
- **Successful operations** → `info`
- **Detailed debugging** → `debug`

```typescript
if (err) {
    const code = err.message === 'Note not found' ? 404 : 400;
    if (code === 404) {
        (req as any).log?.warn({ noteId, error: err.message }, 'Note not found');
    } else {
        (req as any).log?.error({ error: err, noteId }, 'Failed to fetch note');
    }
}
```

#### Include Error Objects
Always pass the full error object for stack traces:
```typescript
logger.error({ error: err }, 'Operation failed');
```

#### Be Concise but Descriptive
Messages should explain what happened without being verbose:
```typescript
// ✅ Good
logger.info({ userId, noteId }, 'Note created successfully');

// ❌ Too verbose
logger.info({ userId, noteId }, 'The user has successfully created a new note in the database');

// ❌ Too vague
logger.info({ userId, noteId }, 'Success');
```

### Complete Logging Example

```typescript
import type express from "express";
import {safeExecute} from "../../utils/handle-async";
import {CreateNoteInput} from "../schemas";

export const noteCreateEndpoint = (service: NoteService) =>
    async (req: express.Request, res: express.Response) => {
        const noteToCreate = CreateNoteInput.parse(req.body);
        const ownerId = req['user']?.[1].payload?.sub || '';

        if (!ownerId) {
            (req as any).log?.warn({}, 'Authentication required');
            res.status(401).json({
                error: 'User authentication required',
                success: false,
            });
            return;
        }

        // Log the operation start
        (req as any).log?.debug({ ownerId, title: noteToCreate.title }, 'Creating note');

        const [err, note] = await safeExecute(service.createNote(noteToCreate, ownerId));

        if (err) {
            // Log error with full context
            (req as any).log?.error({ error: err, ownerId }, 'Failed to create note');
            res.status(400).json({
                error: err.message,
                success: false,
            });
        } else {
            // Log success with relevant IDs
            (req as any).log?.info({ noteId: note.id, ownerId }, 'Note created successfully');
            res.status(201).json({
                note,
                success: true,
            })
        }
    }
```

### Sensitive Data Redaction

The logger should automatically redact sensitive information like:
- Passwords
- API tokens
- Authorization headers
- Credit card numbers
- Personal identification numbers

Configure redaction at the logger initialization level.

### Logger Abstraction

Use interfaces (`ILogger`, `ILoggerFactory`) so you can swap Pino for Winston, Bunyan, or any other implementation without changing application code. The abstraction layer ensures consistency across the codebase.