We're continuing our implementation of Prayer Wall Foundation by implementing task group number 23:

## Implement this task and its sub-tasks:

### Task Group 23: Category Management - API Endpoints
**Phase:** 4
**Dependencies:** Task Group 22
**Estimated Time:** 2 hours

- [ ] 23.0 Create prayer category endpoints
  - [ ] 23.1 Write 2-8 focused tests for categories
    - Test GET /categories (list system + custom)
    - Test POST /categories (create custom, admin-only)
    - Test category assignment to prayers
    - Test category filtering
  - [ ] 23.2 Create routes file: `/src/prayer-walls/routes/categories.routes.ts`
    - Route: GET /api/churches/:churchId/prayer-categories - List categories (system + custom)
    - Route: POST /api/churches/:churchId/prayer-categories - Create custom category (admins)
  - [ ] 23.3 Create handler factories
    - Use EndpointRequest type
    - Use safeExecute
    - Use structured logging
  - [ ] 23.4 Register routes in `/src/index.ts`
  - [ ] 23.5 Ensure category tests pass
    - Run ONLY the 2-8 tests written in 23.1

**Acceptance Criteria:**
- Category endpoints work correctly
- Admin-only permission enforced
- The 2-8 tests written in 23.1 pass
- System categories always available

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
