We're continuing our implementation of Prayer Wall Foundation by implementing task group number 18:

## Implement this task and its sub-tasks:

### Task Group 18: Anonymity Enforcement - Service Layer Logic
**Phase:** 3
**Dependencies:** Task Group 17
**Estimated Time:** 4 hours

- [ ] 18.0 Implement comprehensive anonymity enforcement
  - [ ] 18.1 Write 2-8 focused tests for anonymity enforcement
    - Test fully identified: Name and profile visible
    - Test anonymous to members: Members see "Anonymous Member", pastors see identity
    - Test fully anonymous: Everyone sees "Anonymous"
    - Test private wall override: Always identified
    - Test WebSocket event anonymity
  - [ ] 18.2 Create utility: `/src/prayer-walls/utils/anonymity.util.ts`
    - Function: getAuthorInfo(prayer, requestingUser, wall) - Returns author info based on anonymity level, requesting user role, and wall type
    - Function: enforceAnonymityInEvent(event, requestingUsers) - Conditionally redact author info in WebSocket events
  - [ ] 18.3 Update PrayerRequestService to use anonymity utility
    - Apply anonymity enforcement in getPrayer, listPrayers
    - Apply anonymity enforcement in WebSocket event handlers
  - [ ] 18.4 Update API responses to respect anonymity
    - Test all prayer endpoints return correct author info
    - Test WebSocket events respect anonymity
  - [ ] 18.5 Add anonymity preference endpoints
    - Route: GET /api/users/me/anonymity-preferences
    - Route: PATCH /api/users/me/anonymity-preferences/:wallId
  - [ ] 18.6 Ensure anonymity tests pass
    - Run ONLY the 2-8 tests written in 18.1

**Acceptance Criteria:**
- All 3 anonymity levels enforced correctly
- Private walls always show identity
- The 2-8 tests written in 18.1 pass
- WebSocket events respect anonymity

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
