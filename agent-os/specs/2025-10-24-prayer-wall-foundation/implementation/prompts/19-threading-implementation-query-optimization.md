We're continuing our implementation of Prayer Wall Foundation by implementing task group number 19:

## Implement this task and its sub-tasks:

### Task Group 19: Threading Implementation - Query Optimization
**Phase:** 3
**Dependencies:** Task Group 18
**Estimated Time:** 4 hours

- [ ] 19.0 Optimize threading queries and validation
  - [ ] 19.1 Write 2-8 focused tests for threading
    - Test fetch root prayers (parent_id IS NULL)
    - Test lazy load children (fetch by parent_id)
    - Test recursive CTE for full thread
    - Test thread depth validation (reject if parent depth >= 3)
    - Test nested response creation
  - [ ] 19.2 Update PrayerRequestRepository with optimized queries
    - Method: findRootPrayers(wallId, pagination) - WHERE parent_id IS NULL
    - Method: findThreadChildren(parentId) - Fetch direct children only
    - Method: findFullThread(rootId) - Use recursive CTE for complete thread
    - Add composite index optimization
  - [ ] 19.3 Update PrayerRequestService threading logic
    - Validate thread depth before creation
    - Return thread_depth and parent_id in responses for frontend nesting
    - Implement "Load more replies" pagination for threads
  - [ ] 19.4 Update API endpoints to support threading
    - GET /prayers returns root prayers only
    - GET /prayers/:id returns prayer with immediate children
    - GET /prayers/:id/thread returns full thread (recursive)
  - [ ] 19.5 Ensure threading tests pass
    - Run ONLY the 2-8 tests written in 19.1

**Acceptance Criteria:**
- Thread depth validation works (max 3)
- Queries optimized with indexes
- The 2-8 tests written in 19.1 pass
- Lazy loading supported

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
