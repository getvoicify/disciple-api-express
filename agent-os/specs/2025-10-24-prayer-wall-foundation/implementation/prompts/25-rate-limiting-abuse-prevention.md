We're continuing our implementation of Prayer Wall Foundation by implementing task group number 25:

## Implement this task and its sub-tasks:

### Task Group 25: Rate Limiting - Abuse Prevention
**Phase:** 5
**Dependencies:** Task Group 24
**Estimated Time:** 3 hours

- [ ] 25.0 Implement rate limiting
  - [ ] 25.1 Install rate limiting package: `npm install express-rate-limit`
  - [ ] 25.2 Create rate limiting middleware: `/src/middleware/rate-limit.middleware.ts`
    - Limit: Prayer submissions (5 per minute per user)
    - Limit: Flagging (10 flags per hour per user)
    - Limit: Invitations (20 invitations per hour per wall)
    - Limit: WebSocket messages (100 per minute per connection)
  - [ ] 25.3 Apply rate limiting to endpoints
    - POST /prayers - 5 per minute
    - POST /flag - 10 per hour
    - POST /invite - 20 per hour
  - [ ] 25.4 Apply rate limiting to WebSocket events
    - All emitted events - 100 per minute per connection
  - [ ] 25.5 Test rate limiting with load tests
    - Verify 429 status returned when limit exceeded
    - Verify retry-after header present

**Acceptance Criteria:**
- Rate limits enforced on all endpoints
- WebSocket rate limiting works
- 429 status with retry-after header
- Limits prevent abuse

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
