We're continuing our implementation of Prayer Wall Foundation by implementing task group number 4:

## Implement this task and its sub-tasks:

### Task Group 4: Database Schema - Indexes & Performance
**Phase:** 1
**Dependencies:** Task Group 3
**Estimated Time:** 1.5 hours

- [ ] 4.0 Create database indexes for performance
  - [ ] 4.1 Write 2-8 focused tests for index performance
    - Test query performance on indexed columns
    - Test composite index usage in EXPLAIN plans
    - Test pagination query performance
  - [ ] 4.2 Create migration file: `/migrations/012_add_indexes.sql`
    - Index: prayer_walls(church_id)
    - Index: prayer_walls(created_by)
    - Index: prayer_walls(deleted_at)
    - Index: prayer_requests(wall_id, created_at) - composite for pagination
    - Index: prayer_requests(author_id)
    - Index: prayer_requests(parent_id)
    - Index: prayer_requests(deleted_at)
    - Index: prayer_wall_memberships(user_id, wall_id) - composite for membership checks
    - Index: prayer_wall_memberships(wall_id)
    - Index: flagged_content(prayer_request_id)
    - Index: prayer_read_receipts(prayer_request_id, user_id) - composite
  - [ ] 4.3 Run migration and verify indexes created
    - Use EXPLAIN ANALYZE to verify index usage
  - [ ] 4.4 Ensure index tests pass
    - Run ONLY the 2-8 tests written in 4.1

**Acceptance Criteria:**
- All indexes created successfully
- Query plans show index usage
- The 2-8 tests written in 4.1 pass
- Migration is reversible

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
