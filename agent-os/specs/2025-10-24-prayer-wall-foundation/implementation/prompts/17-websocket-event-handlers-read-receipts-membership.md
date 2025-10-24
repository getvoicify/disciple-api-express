We're continuing our implementation of Prayer Wall Foundation by implementing task group number 17:

## Implement this task and its sub-tasks:

### Task Group 17: WebSocket Event Handlers - Read Receipts & Membership
**Phase:** 2
**Dependencies:** Task Group 16
**Estimated Time:** 3 hours

- [ ] 17.0 Implement read receipts and membership events
  - [ ] 17.1 Write 2-8 focused tests for read receipts and membership
    - Test prayer:read event
    - Test read count aggregation
    - Test member:joined broadcast
    - Test member:left broadcast
    - Test member:invited notification
  - [ ] 17.2 Add read receipt handlers to `/src/websocket/handlers/prayer.handler.ts`
    - Handler: onPrayerRead - Mark as read, broadcast aggregate count, use PrayerReadReceiptRepository
  - [ ] 17.3 Add membership handlers to `/src/websocket/handlers/prayer.handler.ts`
    - Handler: onMemberJoined - Broadcast to wall room
    - Handler: onMemberLeft - Broadcast to wall room
    - Handler: onMemberInvited - Send to specific user
  - [ ] 17.4 Integrate events with REST API endpoints
    - Emit member:joined when POST /join succeeds
    - Emit member:left when POST /leave succeeds
    - Emit member:invited when POST /invite succeeds
  - [ ] 17.5 Ensure read receipt and membership tests pass
    - Run ONLY the 2-8 tests written in 17.1

**Acceptance Criteria:**
- Read receipts track correctly
- Membership events broadcast
- The 2-8 tests written in 17.1 pass
- Events integrated with API

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
