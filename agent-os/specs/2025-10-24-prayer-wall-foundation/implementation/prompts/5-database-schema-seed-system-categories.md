We're continuing our implementation of Prayer Wall Foundation by implementing task group number 5:

## Implement this task and its sub-tasks:

### Task Group 5: Database Schema - Seed System Categories
**Phase:** 1
**Dependencies:** Task Group 4
**Estimated Time:** 1 hour

- [ ] 5.0 Seed system prayer categories
  - [ ] 5.1 Write 2-8 focused tests for system categories
    - Test all 5 system categories are seeded
    - Test is_system_category flag is true
    - Test church_id is NULL for system categories
  - [ ] 5.2 Create migration file: `/migrations/013_seed_system_categories.sql`
    - Insert: Healing, Guidance, Thanksgiving, Intercession, Family
    - Set is_system_category = true, church_id = NULL
  - [ ] 5.3 Run migration and verify categories seeded
  - [ ] 5.4 Ensure seed tests pass
    - Run ONLY the 2-8 tests written in 5.1

**Acceptance Criteria:**
- All 5 system categories inserted
- Categories have correct flags
- The 2-8 tests written in 5.1 pass

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
