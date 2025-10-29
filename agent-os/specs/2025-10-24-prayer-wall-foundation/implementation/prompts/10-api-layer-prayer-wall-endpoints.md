We're continuing our implementation of Prayer Wall Foundation by implementing task group number 10:

## Implement this task and its sub-tasks:

### Task Group 10: API Layer - Prayer Wall Endpoints
**Phase:** 1
**Dependencies:** Task Group 9
**Estimated Time:** 5 hours

- [ ] 10.0 Create prayer wall REST endpoints
  - [ ] 10.1 Write 2-8 focused tests for prayer wall endpoints
    - Test POST /api/churches/:churchId/prayer-walls (create)
    - Test GET /api/churches/:churchId/prayer-walls (list)
    - Test PATCH /api/churches/:churchId/prayer-walls/:wallId (update)
    - Test POST /api/prayer-walls/:wallId/join
    - Test DELETE /api/prayer-walls/:wallId/leave
  - [ ] 10.2 Create Zod schemas: `/src/prayer-walls/schemas/wall.schemas.ts`
    - Schemas: createWallSchema, updateWallSchema, wallResponseSchema
    - Validation: name (1-255 chars), schedule (valid JSONB), video_call_link (valid URL)
  - [ ] 10.3 Create routes file: `/src/prayer-walls/routes/walls.routes.ts`
    - Route: POST /api/churches/:churchId/prayer-walls - Create wall (pastors only)
    - Route: GET /api/churches/:churchId/prayer-walls - List walls
    - Route: GET /api/churches/:churchId/prayer-walls/:wallId - Get wall details
    - Route: PATCH /api/churches/:churchId/prayer-walls/:wallId - Update wall (creator only)
    - Route: DELETE /api/churches/:churchId/prayer-walls/:wallId - Archive wall (soft delete)
    - Route: POST /api/prayer-walls/:wallId/join - Join wall
    - Route: POST /api/prayer-walls/:wallId/leave - Leave wall
    - Route: POST /api/prayer-walls/:wallId/invite - Invite member (pastors)
    - Route: DELETE /api/prayer-walls/:wallId/members/:userId - Remove member (pastors)
    - Route: POST /api/prayer-walls/:wallId/ban/:userId - Ban user (pastors)
    - Route: GET /api/prayer-walls/:wallId/members - List members with online status
  - [ ] 10.4 Create handler factories following pattern from `/src/notes/routes/`
    - Use EndpointRequest type
    - Extract user: `req.user?.[1]?.['payload']?.['sub']`
    - Use safeExecute for all service calls
    - Use structured logging: `req.log?.info({ context }, 'message')`
  - [ ] 10.5 Register routes in `/src/index.ts`
  - [ ] 10.6 Ensure API endpoint tests pass
    - Run ONLY the 2-8 tests written in 10.1

**Acceptance Criteria:**
- All 11 endpoints implemented
- Zod validation works correctly
- The 2-8 tests written in 10.1 pass
- Endpoints use handler factory pattern

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
