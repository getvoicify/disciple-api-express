We're continuing our implementation of Prayer Wall Foundation by implementing task group number 24:

## Implement this task and its sub-tasks:

### Task Group 24: Caching Strategy - Redis Implementation
**Phase:** 5
**Dependencies:** Task Groups 1-23
**Estimated Time:** 3 hours

- [ ] 24.0 Implement comprehensive caching
  - [ ] 24.1 Review existing cache usage across all services
  - [ ] 24.2 Add caching for frequently accessed data
    - Cache: Wall membership checks (5-minute TTL)
    - Cache: User roles (5-minute TTL)
    - Cache: Wall details (1-minute TTL)
    - Cache: Presence data (TTL-based expiration)
    - Cache: Read receipt counts (5-minute TTL)
  - [ ] 24.3 Implement cache invalidation
    - Invalidate membership cache on join/leave/ban
    - Invalidate wall cache on update
    - Invalidate presence cache on disconnect
  - [ ] 24.4 Add cache hit/miss logging
    - Log cache performance: `logger.debug({ key, hit: true }, 'Cache hit')`
  - [ ] 24.5 Test cache performance improvements

**Acceptance Criteria:**
- All identified data cached
- Cache invalidation works correctly
- Cache hit rates logged
- Performance improvements measurable

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
