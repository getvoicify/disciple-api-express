We're continuing our implementation of Prayer Wall Foundation by implementing task group number 2:

## Implement this task and its sub-tasks:

### Task Group 2: Database Schema - Prayer Requests & Threading
**Phase:** 1
**Dependencies:** Task Group 1
**Estimated Time:** 2 hours

- [ ] 2.0 Create prayer requests table with threading support
  - [ ] 2.1 Write 2-8 focused tests for prayer request operations
    - Test prayer creation with anonymity levels
    - Test self-referential threading (parent_id)
    - Test thread depth calculation
    - Test soft-delete with restoration windows
  - [ ] 2.2 Create migration file: `/migrations/009_create_prayer_requests.sql`
    - Table: `prayer_requests`
    - Fields: id (UUID), wall_id (UUID FK), author_id (UUID FK), content (TEXT), anonymity_level (ENUM: identified, anonymous_to_members, fully_anonymous), parent_id (UUID FK self-referential nullable), thread_depth (INTEGER default 0), has_attachment (BOOLEAN), created_at, updated_at, deleted_at, deleted_by (UUID FK nullable)
    - Constraints: CHECK thread_depth BETWEEN 0 AND 3, parent_id references prayer_requests(id)
  - [ ] 2.3 Create prayer_wall_memberships table
    - Table: `prayer_wall_memberships`
    - Fields: id (UUID), wall_id (UUID FK), user_id (UUID FK), joined_at, invited_by (UUID FK nullable), left_at (nullable), is_banned (BOOLEAN default false), banned_at (nullable), banned_by (UUID FK nullable), created_at, updated_at
    - Constraints: UNIQUE(wall_id, user_id, left_at), handles rejoining logic
  - [ ] 2.4 Run migrations and verify table creation
  - [ ] 2.5 Ensure prayer request tests pass
    - Run ONLY the 2-8 tests written in 2.1

**Acceptance Criteria:**
- Migration 009 creates both tables successfully
- Self-referential foreign key for threading works
- Thread depth constraint enforced
- The 2-8 tests written in 2.1 pass

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
