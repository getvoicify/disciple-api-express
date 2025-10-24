We're continuing our implementation of Prayer Wall Foundation by implementing task group number 11:

## Implement this task and its sub-tasks:

### Task Group 11: Service Layer - Prayer Request Service
**Phase:** 1
**Dependencies:** Task Group 9
**Estimated Time:** 4 hours

- [ ] 11.0 Implement PrayerRequestService
  - [ ] 11.1 Write 2-8 focused tests for PrayerRequestService
    - Test create prayer (membership check, anonymity enforcement)
    - Test thread depth validation (reject if parent depth >= 3)
    - Test edit prayer (5-minute window check)
    - Test soft-delete with restoration windows
    - Test list prayers with pagination
  - [ ] 11.2 Create file: `/src/prayer-walls/services/prayer-request.service.ts`
    - Class: PrayerRequestService
    - Dependencies: PrayerRequestRepository, PrayerWallMembershipRepository, PrayerCategoryRepository, PrayerAttachmentRepository
    - Methods: createPrayer(wallId, data, authorId), updatePrayer(prayerId, content, authorId), getPrayer(prayerId, requestingUserId, requestingUserRole), listPrayers(wallId, userId, pagination), softDelete(prayerId, deletedBy), restore(prayerId, userId, userRole), addResponse(parentId, content, authorId), validateThreadDepth(parentId)
    - Business logic: Thread depth validation (max 3), anonymity enforcement, 5-minute edit window, restoration rules (24hr authors, 30-day pastors, 2-year flagged)
  - [ ] 11.3 Ensure service tests pass
    - Run ONLY the 2-8 tests written in 11.1

**Acceptance Criteria:**
- Service validates thread depth correctly
- Anonymity enforcement works for all 3 levels
- The 2-8 tests written in 11.1 pass
- Restoration rules enforced correctly

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
