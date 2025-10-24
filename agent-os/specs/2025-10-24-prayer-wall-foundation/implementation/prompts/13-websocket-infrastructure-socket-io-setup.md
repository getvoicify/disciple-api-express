We're continuing our implementation of Prayer Wall Foundation by implementing task group number 13:

## Implement this task and its sub-tasks:

### Task Group 13: WebSocket Infrastructure - Socket.io Setup
**Phase:** 2
**Dependencies:** Task Group 12
**Estimated Time:** 4 hours

- [ ] 13.0 Set up Socket.io server with Redis adapter
  - [ ] 13.1 Write 2-8 focused tests for WebSocket infrastructure
    - Test WebSocket connection with valid JWT
    - Test connection rejection with invalid JWT
    - Test room join/leave
    - Test Redis adapter pub/sub
  - [ ] 13.2 Install dependencies
    - Run: `npm install socket.io @socket.io/redis-adapter`
    - Run: `npm install --save-dev @types/socket.io`
  - [ ] 13.3 Create file: `/src/websocket/socket.server.ts`
    - Set up Socket.io server attached to Express
    - Configure Redis adapter for multi-server scaling
    - Namespace: `/churches/:churchId/prayer-walls`
    - Rooms: `wall-{wallId}` for each prayer wall
    - Enable CORS for WebSocket connections
    - Configure reconnection settings
  - [ ] 13.4 Create file: `/src/websocket/events.ts`
    - Define event type constants: prayer:created, prayer:updated, prayer:deleted, prayer:response, prayer:reply, typing:start, typing:stop, user:online, user:offline, user:away, prayer:read, content:flagged, content:hidden, content:restored, user:banned, member:joined, member:left, member:invited
    - Define event payload types
  - [ ] 13.5 Integrate Socket.io server in `/src/index.ts`
  - [ ] 13.6 Ensure WebSocket infrastructure tests pass
    - Run ONLY the 2-8 tests written in 13.1

**Acceptance Criteria:**
- Socket.io server runs successfully
- Redis adapter configured for scaling
- The 2-8 tests written in 13.1 pass
- WebSocket connections work

## Understand the context

Read @agent-os/specs/2025-10-24-prayer-wall-foundation/spec.md to understand the context for this spec and where the current task fits into it.

Also read these for further context and reference:
- @agent-os/specs/2025-10-24-prayer-wall-foundation/planning/requirements.md
- @agent-os/specs/2025-10-24-prayer-wall-foundation/planning/visuals

## Perform the implementation

Implement all tasks assigned to you and ONLY those task(s) that have been assigned to you.

### Implementation process:

1. Analyze the provided spec.md, requirements.md, and visuals (if any)
2. Analyze patterns in the codebase according to its built-in workflow
3. Implement the assigned task group according to requirements and standards
4. Update `agent-os/specs/2025-10-24-prayer-wall-foundation/tasks.md` to update the tasks you've implemented to mark them as done by updating their checkbox to checked state: `- [x]`

### Guide your implementation using:
- **The existing patterns** that you've found and analyzed in the codebase
- **User Standards & Preferences** defined in CLAUDE.md files

### Self-verify and test your work by:
- Running ONLY the tests you've written (if any) and ensuring those tests pass
- IF your task involves user-facing UI, and IF you have access to browser testing tools, open a browser and use the feature you've implemented as if you are a user to ensure a user can use the feature in the intended way
