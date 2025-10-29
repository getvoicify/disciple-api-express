We're continuing our implementation of Prayer Wall Foundation by implementing task group number 21:

## Implement this task and its sub-tasks:

### Task Group 21: Moderation System - Flagging Workflow
**Phase:** 4
**Dependencies:** Task Group 20
**Estimated Time:** 5 hours

- [ ] 21.0 Implement complete moderation workflow
  - [ ] 21.1 Write 2-8 focused tests for moderation
    - Test flag content (auto-hide)
    - Test pastor review workflow
    - Test delete action
    - Test restore action
    - Test ban user action
    - Test audit trail logging
  - [ ] 21.2 Create file: `/src/prayer-walls/services/moderation.service.ts`
    - Class: ModerationService (implements IModerationService)
    - Dependencies: FlaggedContentRepository, PrayerRequestRepository, PrayerWallMembershipRepository
    - Methods: flagContent(prayerId, flaggedBy, reason), listFlaggedContent(churchId), reviewFlaggedContent(flagId, action, reviewedBy, notes), deleteContent(prayerId, deletedBy), restoreContent(prayerId, restoredBy), banUser(wallId, userId, bannedBy, churchWide)
    - Business logic: Auto-hide on flag, pastor-only review, audit logging
  - [ ] 21.3 Create Zod schemas: `/src/prayer-walls/schemas/moderation.schemas.ts`
    - Schemas: flagContentSchema, reviewFlaggedContentSchema
  - [ ] 21.4 Create routes file: `/src/prayer-walls/routes/moderation.routes.ts`
    - Route: POST /api/prayer-walls/:wallId/prayers/:prayerId/flag - Flag content
    - Route: GET /api/churches/:churchId/moderation/flagged - List flagged content (pastors)
    - Route: POST /api/moderation/flagged/:flagId/delete - Delete flagged content (pastors)
    - Route: POST /api/moderation/flagged/:flagId/restore - Restore flagged content (pastors)
    - Route: GET /api/churches/:churchId/moderation/audit - View audit trail (pastors)
  - [ ] 21.5 Create WebSocket moderation handler: `/src/websocket/handlers/moderation.handler.ts`
    - Handler: onContentFlagged - Notify pastors
    - Handler: onContentHidden - Broadcast to room (auto-hide)
    - Handler: onContentRestored - Broadcast to room
    - Handler: onUserBanned - Broadcast to room
  - [ ] 21.6 Integrate moderation events with API
    - Emit content:flagged when POST /flag succeeds
    - Emit content:restored when POST /restore succeeds
    - Emit user:banned when POST /ban succeeds
  - [ ] 21.7 Register routes in `/src/index.ts`
  - [ ] 21.8 Ensure moderation tests pass
    - Run ONLY the 2-8 tests written in 21.1

**Acceptance Criteria:**
- Flagging auto-hides content
- Pastors can review and take actions
- The 2-8 tests written in 21.1 pass
- Audit trail logs all actions
- Real-time notifications work

## Understand the context

Read @agent-os/specs/2025-10-24-prayer-wall-foundation/spec.md to understand the context for this spec and where the current task fits into it.

Also read these for further context and reference:
- @agent-os/specs/2025-10-24-prayer-wall-foundation/planning/requirements.md
- @agent-os/specs/2025-10-24-prayer-wall-foundation/planning/visuals

## Perform the implementation

Implement all tasks assigned to you and ONLY those task(s) that have been assigned to you.
Use the test-driven-developer agent to write the test.
Do NOT write the implementation code until you have written the test.
Make sure the tests are failing due to missing implementation and not due to syntax errors.
Review the tests using the coderabbit-reviewer agent
You should delegate the actual implementation to the implementer agent for each task.

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
