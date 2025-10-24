We're continuing our implementation of Prayer Wall Foundation by implementing task group number 12:

## Implement this task and its sub-tasks:

### Task Group 12: API Layer - Prayer Request Endpoints
**Phase:** 1
**Dependencies:** Task Group 11
**Estimated Time:** 5 hours

- [ ] 12.0 Create prayer request REST endpoints
  - [ ] 12.1 Write 2-8 focused tests for prayer endpoints
    - Test POST /api/prayer-walls/:wallId/prayers (create)
    - Test GET /api/prayer-walls/:wallId/prayers (list with pagination)
    - Test PATCH /api/prayer-walls/:wallId/prayers/:prayerId (edit)
    - Test DELETE /api/prayer-walls/:wallId/prayers/:prayerId (soft-delete)
    - Test POST /api/prayer-walls/:wallId/prayers/:prayerId/responses (threading)
  - [ ] 12.2 Create Zod schemas: `/src/prayer-walls/schemas/prayer.schemas.ts`
    - Schemas: createPrayerSchema, updatePrayerSchema, prayerResponseSchema
    - Validation: content (required, max length), anonymity_level (enum), category_ids (array of UUIDs)
  - [ ] 12.3 Create routes file: `/src/prayer-walls/routes/prayers.routes.ts`
    - Route: GET /api/prayer-walls/:wallId/prayers - List prayers (paginated, 20 per page)
    - Route: POST /api/prayer-walls/:wallId/prayers - Submit prayer
    - Route: GET /api/prayer-walls/:wallId/prayers/:prayerId - Get prayer with thread
    - Route: PATCH /api/prayer-walls/:wallId/prayers/:prayerId - Edit prayer (5 min window)
    - Route: DELETE /api/prayer-walls/:wallId/prayers/:prayerId - Soft-delete prayer
    - Route: POST /api/prayer-walls/:wallId/prayers/:prayerId/restore - Restore deleted prayer
    - Route: POST /api/prayer-walls/:wallId/prayers/:prayerId/responses - Add response (threading)
    - Route: POST /api/prayer-walls/:wallId/prayers/upload - Upload file attachment
    - Route: GET /api/prayer-walls/:wallId/prayers/attachments/:attachmentId - Get signed URL
  - [ ] 12.4 Create handler factories
    - Use EndpointRequest type
    - Use safeExecute for all service calls
    - Use structured logging
  - [ ] 12.5 Register routes in `/src/index.ts`
  - [ ] 12.6 Ensure API endpoint tests pass
    - Run ONLY the 2-8 tests written in 12.1

**Acceptance Criteria:**
- All 9 endpoints implemented
- Pagination uses cursor-based approach
- The 2-8 tests written in 12.1 pass
- Threading validation enforced

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
