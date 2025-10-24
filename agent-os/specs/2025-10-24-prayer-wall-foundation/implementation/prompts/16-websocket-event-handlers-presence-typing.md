We're continuing our implementation of Prayer Wall Foundation by implementing task group number 16:

## Implement this task and its sub-tasks:

### Task Group 16: WebSocket Event Handlers - Presence & Typing
**Phase:** 2
**Dependencies:** Task Group 15
**Estimated Time:** 4 hours

- [ ] 16.0 Implement presence and typing indicators
  - [ ] 16.1 Write 2-8 focused tests for presence events
    - Test user:online event on connection
    - Test user:offline event on disconnection
    - Test typing:start with debouncing
    - Test typing:stop auto-clear
    - Test presence data in Redis
  - [ ] 16.2 Create file: `/src/websocket/handlers/presence.handler.ts`
    - Handler: onConnection - Mark user online, broadcast user:online, store in Redis sorted set
    - Handler: onDisconnect - Mark user offline, broadcast user:offline, remove from Redis
    - Handler: onTypingStart - Broadcast to room, store in Redis with 5-second TTL
    - Handler: onTypingStop - Broadcast to room, remove from Redis
    - Handler: onUserAway - Mark user away after 5 minutes inactive
  - [ ] 16.3 Create file: `/src/prayer-walls/services/presence.service.ts`
    - Class: PresenceService
    - Dependencies: RedisCacheRepository
    - Methods: setOnline(userId, wallId), setOffline(userId, wallId), setAway(userId, wallId), getOnlineUsers(wallId), setTyping(userId, wallId, prayerId), clearTyping(userId, wallId, prayerId), getTypingUsers(wallId, prayerId)
    - Use Redis sorted sets with timestamps for TTL
  - [ ] 16.4 Register presence handlers in Socket.io server
  - [ ] 16.5 Ensure presence tests pass
    - Run ONLY the 2-8 tests written in 16.1

**Acceptance Criteria:**
- Presence tracking works correctly
- Typing indicators with 5-second TTL
- The 2-8 tests written in 16.1 pass
- Redis stores presence data

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
