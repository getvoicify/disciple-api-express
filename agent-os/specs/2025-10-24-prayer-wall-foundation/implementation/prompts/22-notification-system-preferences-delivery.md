We're continuing our implementation of Prayer Wall Foundation by implementing task group number 22:

## Implement this task and its sub-tasks:

### Task Group 22: Notification System - Preferences & Delivery
**Phase:** 4
**Dependencies:** Task Group 21
**Estimated Time:** 5 hours

- [ ] 22.0 Implement notification system
  - [ ] 22.1 Write 2-8 focused tests for notifications
    - Test create notification preferences
    - Test update per-wall preferences
    - Test notification filtering based on preferences
    - Test batched notifications
    - Test delivery channels (in-app, push, email)
  - [ ] 22.2 Create file: `/src/prayer-walls/services/notification.service.ts`
    - Class: NotificationService
    - Dependencies: NotificationPreferenceRepository, RedisCacheRepository
    - Methods: sendNotification(userId, wallId, type, data), checkPreferences(userId, wallId, type), batchNotifications(wallId, type, data), sendToChannel(userId, channel, notification)
    - Business logic: Check preferences before sending, batch rapid events (30-second window), support multiple channels
  - [ ] 22.3 Create routes file: `/src/prayer-walls/routes/notifications.routes.ts`
    - Route: GET /api/users/me/notification-preferences - Get preferences
    - Route: PATCH /api/users/me/notification-preferences/:wallId - Update per-wall preferences
  - [ ] 22.4 Integrate notifications with events
    - New prayer posted → Notify wall members (if preferences allow)
    - Response to prayer → Notify prayer author
    - Reply to response → Notify response author
    - Wall invitation → Notify invitee
    - Content flagged → Notify pastors
  - [ ] 22.5 Implement notification batching
    - Use Redis to collect events in 30-second window
    - Send single notification: "5 new prayers in Youth Group"
  - [ ] 22.6 Register routes in `/src/index.ts`
  - [ ] 22.7 Ensure notification tests pass
    - Run ONLY the 2-8 tests written in 22.1

**Acceptance Criteria:**
- Granular preferences work per-wall
- Notifications respect user preferences
- The 2-8 tests written in 22.1 pass
- Batching prevents spam
- Multiple delivery channels supported

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
