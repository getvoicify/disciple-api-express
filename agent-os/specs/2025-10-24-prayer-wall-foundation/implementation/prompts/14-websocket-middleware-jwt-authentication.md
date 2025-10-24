We're continuing our implementation of Prayer Wall Foundation by implementing task group number 14:

## Implement this task and its sub-tasks:

### Task Group 14: WebSocket Middleware - JWT Authentication
**Phase:** 2
**Dependencies:** Task Group 13
**Estimated Time:** 3 hours

- [ ] 14.0 Implement WebSocket authentication middleware
  - [ ] 14.1 Write 2-8 focused tests for WebSocket auth
    - Test valid JWT token authentication
    - Test invalid/expired token rejection
    - Test missing token rejection
    - Test user context extraction
  - [ ] 14.2 Create file: `/src/websocket/middleware/auth.middleware.ts`
    - Extract JWT from handshake query or headers
    - Validate JWT using existing Keycloak validation logic
    - Extract user ID and roles
    - Attach user context to socket
    - Reject connection if authentication fails
    - Follow pattern from existing JWT middleware
  - [ ] 14.3 Apply middleware to Socket.io namespace
  - [ ] 14.4 Ensure WebSocket auth tests pass
    - Run ONLY the 2-8 tests written in 14.1

**Acceptance Criteria:**
- JWT authentication works for WebSocket
- Invalid tokens rejected
- The 2-8 tests written in 14.1 pass
- User context available on socket

## Understand the context

Read @agent-os/specs/2025-10-24-prayer-wall-foundation/spec.md to understand the context for this spec and where the current task fits into it.

Also read these further context and reference:
- @agent-os/specs/2025-10-24-prayer-wall-foundation/planning/requirements.md
- @agent-os/specs/2025-10-24-prayer-wall-foundation/planning/visuals

## Perform the implementation

Implement all tasks assigned to you and ONLY those task(s) that have been assigned to you.

## Implementation process:

1. Analyze the provided spec.md, requirements.md, and visuals (if any)
2. Analyze patterns in the codebase according to its built-in workflow
3. Implement the assigned task group according to requirements and standards
4. Update `agent-os/specs/2025-10-24-prayer-wall-foundation/tasks.md` to update the tasks you've implemented to mark that as done by updating their checkbox to checked state: `- [x]`

## Guide your implementation using:
- **The existing patterns** that you've found and analyzed in the codebase.
- **User Standards & Preferences** which are defined below.

## Self-verify and test your work by:
- Running ONLY the tests you've written (if any) and ensuring those tests pass.
- IF your task involves user-facing UI, and IF you have access to browser testing tools, open a browser and use the feature you've implemented as if you are a user to ensure a user can use the feature in the intended way.
