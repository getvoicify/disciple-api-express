We're continuing our implementation of Prayer Wall Foundation by implementing task group number 9:

## Implement this task and its sub-tasks:

### Task Group 9: Service Layer - Prayer Wall Service
**Phase:** 1
**Dependencies:** Task Group 8
**Estimated Time:** 4 hours

- [ ] 9.0 Implement PrayerWallService
  - [ ] 9.1 Write 2-8 focused tests for PrayerWallService
    - Test create wall (pastor permission check)
    - Test edit wall (creator-only check)
    - Test list walls (public vs private visibility)
    - Test join wall (membership validation)
    - Test leave wall
  - [ ] 9.2 Create file: `/src/prayer-walls/services/prayer-wall.service.ts`
    - Class: PrayerWallService
    - Dependencies: PrayerWallRepository, PrayerWallMembershipRepository, RedisCacheRepository
    - Methods: createWall(data, creatorId, creatorRole), updateWall(wallId, data, userId), getWall(wallId, userId), listWalls(churchId, userId), joinWall(wallId, userId, invitedBy?), leaveWall(wallId, userId), inviteMember(wallId, userId, invitedBy), removeMember(wallId, userId, removedBy), banUser(wallId, userId, bannedBy)
    - Business logic: Permission checks, private wall visibility, membership validation
    - Cache: Wall details (1 min TTL), membership checks (5 min TTL)
  - [ ] 9.3 Ensure service tests pass
    - Run ONLY the 2-8 tests written in 9.1

**Acceptance Criteria:**
- Service implements all business logic
- Permission checks enforce authorization matrix
- The 2-8 tests written in 9.1 pass
- Caching works correctly

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
