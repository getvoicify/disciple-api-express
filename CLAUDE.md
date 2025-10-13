- Always use the safeExecute utility for promises and unsafe function calls that require a try/catch block.

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