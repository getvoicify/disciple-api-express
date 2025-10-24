We're continuing our implementation of Prayer Wall Foundation by implementing task group number 15:

## Implement this task and its sub-tasks:

### Task Group 15: WebSocket Event Handlers - Prayer Events
**Phase:** 2
**Dependencies:** Task Group 14
**Estimated Time:** 4 hours

- [ ] 15.0 Implement prayer-related WebSocket event handlers
  - [ ] 15.1 Write 2-8 focused tests for prayer events
    - Test prayer:created event broadcast
    - Test prayer:updated event broadcast
    - Test prayer:deleted event broadcast
    - Test prayer:response event broadcast
    - Test anonymity enforcement in events
  - [ ] 15.2 Create file: `/src/websocket/handlers/prayer.handler.ts`
    - Handler: onPrayerCreated - Broadcast to room `wall-{wallId}`
    - Handler: onPrayerUpdated - Broadcast updated prayer
    - Handler: onPrayerDeleted - Broadcast deletion event
    - Handler: onPrayerResponse - Broadcast response with thread info
    - Handler: onPrayerReply - Broadcast reply with thread depth
    - Integrate with PrayerRequestService for data retrieval
    - Enforce anonymity in event payloads
    - Use structured logging: `logger.info({ context }, 'message')`
  - [ ] 15.3 Register event handlers in Socket.io server
  - [ ] 15.4 Integrate events with REST API endpoints
    - Emit prayer:created when POST /prayers succeeds
    - Emit prayer:updated when PATCH /prayers/:id succeeds
    - Emit prayer:deleted when DELETE /prayers/:id succeeds
    - Emit prayer:response when POST /prayers/:id/responses succeeds
  - [ ] 15.5 Ensure prayer event tests pass
    - Run ONLY the 2-8 tests written in 15.1

**Acceptance Criteria:**
- All prayer events broadcast correctly
- Anonymity enforced in event payloads
- The 2-8 tests written in 15.1 pass
- Events triggered from REST API

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
