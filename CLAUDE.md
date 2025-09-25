- Always use the safeExecute utility for promises and unsafe function calls that require a try/catch block.

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