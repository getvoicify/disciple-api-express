## API endpoint standards and conventions

### General REST Principles
- **RESTful Design**: Follow REST principles with clear resource-based URLs and appropriate HTTP methods (GET, POST, PUT, PATCH, DELETE)
- **Consistent Naming**: Use consistent, lowercase, hyphenated or underscored naming conventions for endpoints across the API
- **Versioning**: Implement API versioning strategy (URL path or headers) to manage breaking changes without disrupting existing clients
- **Plural Nouns**: Use plural nouns for resource endpoints (e.g., `/users`, `/products`) for consistency
- **Nested Resources**: Limit nesting depth to 2-3 levels maximum to keep URLs readable and maintainable
- **Query Parameters**: Use query parameters for filtering, sorting, pagination, and search rather than creating separate endpoints
- **HTTP Status Codes**: Return appropriate, consistent HTTP status codes that accurately reflect the response (200, 201, 400, 404, 500, etc.)

### Express Endpoint Patterns

#### Handler Factory Pattern
Always use factory functions that return async handlers. This enables dependency injection:

```typescript
export const noteCreateEndpoint = (service: NoteService) =>
    async (req: express.Request, res: express.Response) => {
        // Handler implementation
    }
```

#### Input Validation with Zod
Use Zod schemas to validate all inputs (body, params, query):

```typescript
import {z} from 'zod';

// For path parameters
export const NoteFetchParamsInput = z.object({
    noteId: z.uuid(),
});

// For request body
export const CreateNoteInput = z.object({
    title: z.string(),
    content: z.string(),
});

// In handler
const { noteId } = NoteFetchParamsInput.parse(req.params);
const noteToCreate = CreateNoteInput.parse(req.body);
```

#### User Authentication Access
Extract authenticated user ID using this pattern:

```typescript
const ownerId = req['user']?.[1].payload?.sub || '';
if (!ownerId) {
    res.status(401).json({
        error: 'User authentication required',
        success: false,
    });
    return;
}
```

#### safeExecute for Async Operations
Always use `safeExecute` instead of try-catch blocks:

```typescript
import {safeExecute} from "../../utils/handle-async";

const [err, note] = await safeExecute(service.createNote(noteToCreate, ownerId));

if (err) {
    const code = err.message === 'Note not found' ? 404 : 400;
    res.status(code).json({
        error: err.message,
        success: false,
    });
} else {
    res.status(201).json({
        note,
        success: true,
    });
}
```

#### Consistent Response Structure
Always return responses in this format:

```typescript
// Success response
res.status(200).json({
    data: result,
    success: true,
});

// Error response
res.status(400).json({
    error: err.message,
    success: false,
});

// For DELETE operations
res.status(204).send();
```

#### Request-Scoped Logging
Use request-scoped logging for automatic correlation IDs:

```typescript
(req as any).log?.info({ userId, resourceId }, 'Resource created successfully');
(req as any).log?.error({ error: err, filters }, 'Failed to list resources');
(req as any).log?.debug({ key }, 'Writing cache');
```

**NEVER use `console.log`, `console.error`, or `console.warn`** - always use structured logging.

#### OpenAPI Documentation
Include comprehensive JSDoc comments with @openapi annotations:

```typescript
/**
 * @openapi
 * /notes:
 *   post:
 *     summary: Create a new note
 *     description: Create a new sermon note with optional scripture references
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNoteInput'
 *     responses:
 *       201:
 *         description: Note created successfully
 */
```

### Complete Endpoint Example

```typescript
import type {NoteService} from "../service";
import type express from "express";
import {CreateNoteInput} from "../schemas";
import {safeExecute} from "../../utils/handle-async";
import {z} from "zod";

export const NoteParamsInput = z.object({
    noteId: z.uuid(),
});

export const noteCreateEndpoint = (service: NoteService) =>
    async (req: express.Request, res: express.Response) => {
        // Validate input
        const noteToCreate = CreateNoteInput.parse(req.body);

        // Extract authenticated user
        const ownerId = req['user']?.[1].payload?.sub || '';
        if (!ownerId) {
            res.status(401).json({
                error: 'User authentication required',
                success: false,
            });
            return;
        }

        // Execute service call with safeExecute
        const [err, note] = await safeExecute(service.createNote(noteToCreate, ownerId));

        if (err) {
            (req as any).log?.error({ error: err, ownerId }, 'Failed to create note');
            res.status(400).json({
                error: err.message,
                success: false,
            });
        } else {
            (req as any).log?.info({ noteId: note.id }, 'Note created successfully');
            res.status(201).json({
                note,
                success: true,
            })
        }
    }
```
