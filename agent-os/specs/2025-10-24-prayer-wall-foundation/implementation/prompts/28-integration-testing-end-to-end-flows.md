We're continuing our implementation of Prayer Wall Foundation by implementing task group number 28:

## Implement this task and its sub-tasks:

### Task Group 28: Integration Testing - End-to-End Flows
**Phase:** 5
**Dependencies:** Task Group 27
**Estimated Time:** 4 hours

- [ ] 28.0 Test complete user workflows
  - [ ] 28.1 Write E2E test: Member joins wall, posts prayer, receives response
    - Join wall → POST /join
    - Submit prayer → POST /prayers
    - Receive WebSocket event → prayer:created
    - Another member responds → POST /responses
    - Original author receives notification → WebSocket event
  - [ ] 28.2 Write E2E test: Anonymity scenarios
    - Member posts anonymous prayer
    - Other members see "Anonymous Member"
    - Pastor views same prayer and sees identity
  - [ ] 28.3 Write E2E test: Moderation workflow
    - Member flags inappropriate content
    - Content auto-hidden from members
    - Pastor receives notification
    - Pastor reviews and deletes content
    - Audit log created
  - [ ] 28.4 Write E2E test: Threading depth validation
    - Create root prayer
    - Add response (depth 1)
    - Add reply (depth 2)
    - Add reply to reply (depth 3)
    - Attempt depth 4 → rejected with error
  - [ ] 28.5 Write E2E test: Soft-delete restoration
    - Author deletes prayer
    - Author restores within 24 hours → success
    - Author attempts restore after 24 hours → fails
    - Pastor restores within 30 days → success
  - [ ] 28.6 Run all E2E tests

**Acceptance Criteria:**
- All E2E workflows pass
- Anonymity enforced correctly
- Moderation workflow works end-to-end
- Thread depth validation works
- Restoration rules enforced

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
