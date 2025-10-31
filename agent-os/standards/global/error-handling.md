## Error handling best practices

### Core Principles
- **User-Friendly Messages**: Provide clear, actionable error messages to users without exposing technical details or security information
- **Fail Fast and Explicitly**: Validate input and check preconditions early; fail with clear error messages rather than allowing invalid state
- **Specific Exception Types**: Use specific exception/error types rather than generic ones to enable targeted handling
- **Custom Error Classes**: Create custom error classes to encapsulate error details and provide additional context
- **Graceful Degradation**: Design systems to degrade gracefully when non-critical services fail rather than breaking entirely
- **Retry Strategies**: Implement exponential backoff for transient failures in external service calls
- **Clean Up Resources**: Always clean up resources (file handles, connections) in finally blocks or equivalent mechanisms

### safeExecute Utility Pattern

**ALWAYS use the `safeExecute` utility for promises and unsafe function calls** instead of try-catch blocks. This pattern eliminates the need for try-catch blocks by returning a tuple `[Error] | [undefined, T]`.

#### Function Signatures
```typescript
safeExecute<T>(promise: Promise<T>): Promise<[Error] | [undefined, T]>
safeExecute<T>(fn: () => T | Promise<T>): Promise<[Error] | [undefined, T]>
```

#### Standard Pattern
```typescript
const [error, result] = await safeExecute(someAsyncOperation());
if (error) {
    // Handle error
    return;
}
// Use result safely
```

#### When to Use safeExecute
Always use `safeExecute` for:
- Database operations (`repository.findById()`, `repository.create()`)
- File system operations (`fs.readFile()`, `fs.unlink()`)
- External API calls (`fetch()`, HTTP requests)
- Cloud service operations (S3, R2 uploads/downloads)
- Any Promise that might reject
- Synchronous operations that might throw

#### Examples

**Database Operations:**
```typescript
const [err, note] = await safeExecute(service.createNote(noteToCreate, ownerId));
if (err) {
    res.status(400).json({
        error: err.message,
        success: false,
    });
    return;
}
```

**Service Calls:**
```typescript
const [err, note] = await safeExecute(service.getNoteById(noteId));
if (err) {
    const code = err.message === 'Note not found' ? 404 : 400;
    res.status(code).json({
        error: err.message,
        success: false,
    });
    return;
}
```

**Unsafe Function Calls:**
For synchronous operations that might throw, wrap in an arrow function:
```typescript
const [error, result] = await safeExecute(() => unsafeSyncFunction());
```

**File Operations:**
```typescript
const [err, data] = await safeExecute(() => fs.readFileSync(path));
```

**Cloud Operations:**
```typescript
const [err, response] = await safeExecute(s3Client.send(command));
```

### Error Response Pattern

In Express endpoints, always return consistent error responses:

```typescript
if (err) {
    // Log the error with context
    (req as any).log?.error({ error: err, context }, 'Operation failed');

    // Determine appropriate status code
    const code = err.message === 'Not found' ? 404 : 400;

    // Return consistent error response
    res.status(code).json({
        error: err.message,
        success: false,
    });
    return;
}
```

### Benefits of safeExecute

1. **No try-catch blocks**: Cleaner, more readable code
2. **Consistent error handling**: All errors handled the same way
3. **Type safety**: TypeScript knows the result type after error check
4. **Explicit error handling**: Forces you to handle errors at the call site
5. **Works with both sync and async**: Single pattern for all operations
