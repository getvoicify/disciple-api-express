We're continuing our implementation of Prayer Wall Foundation by implementing task group number 1:

## Implement this task and its sub-tasks:

### Task Group 1: Database Schema - Prayer Walls Table
**Phase:** 1
**Dependencies:** None
**Estimated Time:** 2 hours

- [ ] 1.0 Create prayer walls table migration
  - [ ] 1.1 Write 2-8 focused tests for prayer wall database operations
    - Test wall creation with valid data
    - Test wall retrieval by church_id
    - Test soft-delete behavior
    - Test unique constraint violations
  - [ ] 1.2 Create migration file: `/migrations/008_create_prayer_walls.sql`
    - Table: `prayer_walls`
    - Fields: id (UUID), church_id (UUID FK), name (VARCHAR 255), description (TEXT), created_by (UUID FK), is_private (BOOLEAN), has_restricted_access (BOOLEAN), schedule (JSONB), video_call_link (VARCHAR 500), status (ENUM), created_at, updated_at, deleted_at
    - Constraints: NOT NULL on required fields, CHECK constraint on status enum
    - Reference existing pattern from `/migrations/002_create_churches_tables.sql`
  - [ ] 1.3 Run migration and verify table creation
    - Run ONLY the newly created migration
    - Verify table structure with `\d prayer_walls`
  - [ ] 1.4 Ensure migration tests pass
    - Run ONLY the 2-8 tests written in 1.1
    - Verify migrations run successfully

**Acceptance Criteria:**
- Migration 008 creates prayer_walls table successfully
- All constraints and defaults work correctly
- The 2-8 tests written in 1.1 pass
- Migration is reversible (down migration works)

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