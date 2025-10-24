## Test coverage best practices

### Test-Driven Development (TDD)

**Unless explicitly instructed otherwise, ALWAYS use TDD for all code you write.** This means:

1. **Write the test first** - Before writing any implementation code, write a failing test
2. **Run the test and see it fail** - Verify the test fails for the right reason
3. **Write minimal code to pass** - Implement just enough code to make the test pass
4. **Review test code** - **ALWAYS use the coderabbit agent to review test code before proceeding**
5. **Refactor** - Clean up the code while keeping tests green
6. **Repeat** - Continue the cycle for each new requirement

### Code Review for Tests

**CRITICAL: Always run the coderabbit agent to review test code.** This helps catch issues early:
- Invalid test patterns
- Missing assertions
- Improper mocking
- Test brittleness
- Coverage gaps

Run the review immediately after writing tests and before implementing the feature code. This prevents wasted effort on tests that need rework.

### Testing Framework

- **Test Runner:** Vitest
- **HTTP Testing:** Supertest for API endpoint testing
- **Coverage:** @vitest/coverage-v8
- **Test UI:** @vitest/ui for interactive test development

### Testing Principles

- **Write Minimal Tests During Development**: Do NOT write tests for every change or intermediate step. Focus on completing the feature implementation first, then add strategic tests only at logical completion points
- **Test Only Core User Flows**: Write tests exclusively for critical paths and primary user workflows. Skip writing tests for non-critical utilities and secondary workflows until if/when you're instructed to do so.
- **Defer Edge Case Testing**: Do NOT test edge cases, error states, or validation logic unless they are business-critical. These can be addressed in dedicated testing phases, not during feature development.
- **Test Behavior, Not Implementation**: Focus tests on what the code does, not how it does it, to reduce brittleness
- **Clear Test Names**: Use descriptive names that explain what's being tested and the expected outcome
- **Mock External Dependencies**: Isolate units by mocking databases, APIs, file systems, and other external services
- **Fast Execution**: Keep unit tests fast (milliseconds) so developers run them frequently during development

### Test Structure

Use Vitest's `describe` and `it` blocks for clear test organization:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('NoteService', () => {
    beforeEach(() => {
        // Setup code
    });

    afterEach(() => {
        // Cleanup code
    });

    describe('createNote', () => {
        it('should create a note with valid input', async () => {
            // Arrange
            const input = {
                title: 'Test Note',
                content: 'Test content'
            };
            const ownerId = 'user-123';

            // Act
            const [error, note] = await safeExecute(
                service.createNote(input, ownerId)
            );

            // Assert
            expect(error).toBeUndefined();
            expect(note).toBeDefined();
            expect(note.title).toBe('Test Note');
        });

        it('should return error for missing title', async () => {
            // Test implementation
        });
    });
});
```

### Testing with safeExecute

When testing code that uses `safeExecute`, verify both success and error cases:

```typescript
// Test successful execution
it('should return result on success', async () => {
    const [error, result] = await safeExecute(operation());
    expect(error).toBeUndefined();
    expect(result).toBeDefined();
});

// Test error handling
it('should return error on failure', async () => {
    const [error, result] = await safeExecute(failingOperation());
    expect(error).toBeDefined();
    expect(result).toBeUndefined();
});
```

### Testing Express Endpoints

Use Supertest to test HTTP endpoints:

```typescript
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../app';

describe('POST /notes', () => {
    it('should create a note successfully', async () => {
        const response = await request(app)
            .post('/notes')
            .set('Authorization', 'Bearer valid-token')
            .send({
                title: 'Test Note',
                content: 'Test content'
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.note).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
        const response = await request(app)
            .post('/notes')
            .send({
                title: 'Test Note',
                content: 'Test content'
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
    });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm test -- --coverage
```

### Test Coverage Goals

- **Critical paths:** 100% coverage required
- **Core business logic:** 90%+ coverage
- **Edge cases:** Test as needed for business-critical scenarios
- **Error handling:** Test error paths for all safeExecute calls
