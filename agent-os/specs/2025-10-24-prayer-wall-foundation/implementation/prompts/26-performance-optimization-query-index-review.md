We're continuing our implementation of Prayer Wall Foundation by implementing task group number 26:

## Implement this task and its sub-tasks:

### Task Group 26: Performance Optimization - Query & Index Review
**Phase:** 5
**Dependencies:** Task Group 25
**Estimated Time:** 3 hours

- [ ] 26.0 Optimize database performance
  - [ ] 26.1 Review all database queries with EXPLAIN ANALYZE
    - Verify indexes used in common queries
    - Identify slow queries (> 100ms)
  - [ ] 26.2 Optimize slow queries
    - Add missing indexes
    - Rewrite inefficient queries
    - Add composite indexes where needed
  - [ ] 26.3 Verify pagination performance
    - Test cursor-based pagination with large datasets
    - Ensure OFFSET not used
  - [ ] 26.4 Test threading query performance
    - Recursive CTE performance with deep threads
    - Lazy loading vs full thread fetch
  - [ ] 26.5 Document query optimization decisions

**Acceptance Criteria:**
- All queries use indexes (verified with EXPLAIN)
- No queries slower than 200ms (95th percentile)
- Pagination performs well with large datasets
- Threading queries optimized

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
