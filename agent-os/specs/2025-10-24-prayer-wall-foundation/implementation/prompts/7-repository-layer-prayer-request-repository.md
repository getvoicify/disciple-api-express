We're continuing our implementation of Prayer Wall Foundation by implementing task group number 7:

## Implement this task and its sub-tasks:

### Task Group 7: Repository Layer - Prayer Request Repository
**Phase:** 1
**Dependencies:** Task Group 6
**Estimated Time:** 3 hours

- [ ] 7.0 Implement PrayerRequestRepository
  - [ ] 7.1 Write 2-8 focused tests for PrayerRequestRepository
    - Test create prayer with threading
    - Test findByWallId with pagination
    - Test findById with thread children
    - Test update prayer content
    - Test soft-delete and restoration
  - [ ] 7.2 Create file: `/src/prayer-walls/repositories/prayer-request.repository.ts`
    - Interface: IPrayerRequestRepository
    - Methods: create(data), findById(id), findByWallId(wallId, pagination), findThreadChildren(parentId), update(id, data), softDelete(id, deletedBy), restore(id), validateThreadDepth(parentId)
    - Use recursive CTE for fetching full threads
    - Implement cursor-based pagination
  - [ ] 7.3 Ensure repository tests pass
    - Run ONLY the 2-8 tests written in 7.1

**Acceptance Criteria:**
- Repository handles threading correctly
- Thread depth validation works
- The 2-8 tests written in 7.1 pass
- Pagination uses cursor-based approach

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
