# Spec Requirements: Keycloak Church Membership Claim Sync

## Initial Description

Keycloak user church_membership claim management

I want to be able to sync church membership as it currently exists with the user profile in Keycloak.
To do this, I want to react to changes to the user's church membership - whether they create a church, are being invited to a church
or have joined or leave a church. I want it to also react to when the church ownership changes.

This is going to be useful because I want a lot of the more advanced ACL features to be implemented on the Keycloak side. This
will simplify our code quite a bit.

Below is an example of the claims that are currently being issued for a user. It is important to note that some users
will not have the `church_membership` claim if they do not have associations with a church.

```json
{
  "exp": 1761695877,
  "iat": 1761695577,
  "jti": "onrtro:e53512d2-1597-cf90-80f7-a5cd1c3c7730",
  "iss": "https://keycloak.pottersville.church/realms/Pottersville",
  "aud": "account",
  "sub": "84376fb3-ab38-4a6c-ad55-986ff6f76c1f",
  "typ": "Bearer",
  "azp": "iam",
  "sid": "34f439b1-6b57-43ad-9a24-83726c756ee9",
  "acr": "1",
  "allowed-origins": [
    "/*"
  ],
  "realm_access": {
    "roles": [
      "media:delete",
      "note:create",
      "note:read",
      "note:manage",
      "media:update",
      "default-roles-pottersville",
      "moderator",
      "devotional:delete",
      "devotional:read",
      "post:create",
      "note:update",
      "devotional:manage",
      "media:create",
      "devotional:update",
      "note:delete",
      "offline_access",
      "devotional:create",
      "uma_authorization",
      "user"
    ]
  },
  "resource_access": {
    "account": {
      "roles": [
        "manage-account",
        "manage-account-links",
        "view-profile"
      ]
    }
  },
  "scope": "email profile church_membership",
  "email_verified": true,
  "name": "Thompson Edolo",
  "preferred_username": "testuser@test.com",
  "given_name": "Thompson",
  "family_name": "Edolo",
  "church_membership": [
    {
      "churchId": "test-church",
      "role": "Owner"
    },
    {
      "churchId": "test-church-2",
      "role": "Owner"
    }
  ],
  "email": "testuser@test.com"
}
```

## Requirements Discussion

### First Round Questions

**Q1:** I assume we'll use an **event-driven approach** to sync church membership to Keycloak, similar to the existing Keycloak outbox pattern already in the codebase. This would trigger on church creation, membership changes (invite, join, leave), and ownership transfers. Is that correct, or would you prefer a different synchronization mechanism (e.g., scheduled batch sync, on-demand sync)?

**Answer:** Your assumption is correct and, yes, let's stick to the async approach. We may want to switch from using RxJs to BullMQ for Job queuing and processing. This may require that we have another entrypoint (worker.ts).

**Q2:** I'm thinking the **`church_membership` claim structure** you provided (`{churchId, role}[]`) is the final format we should maintain. Should we support additional roles beyond "Owner" (like "Admin", "Pastor", "Member"), or is the role structure already defined elsewhere in your system that we should reference?

**Answer:** We already have the roles we need and they can be found in the MemberRole schema.

**Q3:** I assume we'll need to **update the Keycloak user attributes** via the Keycloak Admin API whenever church membership changes. Should we handle failure scenarios (e.g., Keycloak API unavailable) by retrying through the outbox pattern, or would you prefer a different error handling strategy?

**Answer:** The retry strategy works fine.

**Q4:** For **users without church membership**, I assume we should either omit the `church_membership` claim entirely or set it to an empty array `[]`. Which approach aligns with your existing JWT validation logic?

**Answer:** An empty array works here.

**Q5:** I'm assuming we'll need to handle **multi-church scenarios** where users belong to multiple churches (as shown in your example with `test-church` and `test-church-2`). Should there be any limits on how many churches a user can belong to, or any priority/ordering logic for the array?

**Answer:** We don't need to limit the users here.

**Q6:** When **church ownership changes** (transfers from one user to another), I assume we need to update BOTH the previous owner (removing Owner role) AND the new owner (adding Owner role). Should the previous owner remain a member with a different role, or be removed entirely?

**Answer:** Yes, the previous owner can remain a member if they want. That choice should be theirs.

**Q7:** For **existing users** already in your system, should we implement a **one-time migration** to sync all current church memberships to Keycloak, or will this feature only apply to new membership changes going forward?

**Answer:** Let's migrate existing users.

**Q8:** What events specifically trigger the sync? I'm assuming:
- User creates a church (becomes Owner)
- User accepts church invitation (becomes Member/role)
- User leaves church (membership removed)
- Church ownership transferred (role change)
- User invited to church (should we sync at invite time, or only after acceptance?)

Is this the complete list, or are there other scenarios?

**Answer:**
- Yes (User creates a church)
- Yes (User accepts church invitation)
- Yes (User leaves church)
- Yes (Church ownership transferred)
- After acceptance (for invitations)

### Existing Code to Reference

**Similar Features Identified:**

Based on the codebase structure, the following existing features should be referenced:

- **Keycloak Integration:**
  - `src/keycloak/admin-client.ts` - Keycloak Admin API client for user attribute management
  - `src/keycloak/outbox.publisher.ts` - Existing outbox pattern for Keycloak event publishing
  - `src/keycloak/generalized-outbox.adapter.ts` - Outbox adapter implementation
  - `src/keycloak/resource-manager.ts` - Resource management patterns
  - `src/keycloak/resource-adapters.ts` - Resource adapter patterns
  - `src/keycloak/types.ts` - Keycloak type definitions
  - `src/keycloak/setup.ts` - Keycloak setup and initialization

- **Church Membership Logic:**
  - `src/churches/schemas.ts` - Contains MemberRole schema defining available roles
  - `src/churches/repository.ts` - Church repository interface
  - `src/churches/postgres-repository.ts` - Church repository implementation
  - `src/churches/membership-service.ts` - Church membership business logic
  - `src/churches/routes/membership/churchMembershipUpdateRole.endpoint.ts` - Membership role update endpoint

## Visual Assets

### Files Provided:
No visual assets provided.

## Requirements Summary

### Functional Requirements

**Core Functionality:**
- Synchronize church membership data from the application database to Keycloak user attributes
- Maintain `church_membership` claim in JWT tokens with structure: `[{churchId: string, role: string}]`
- Support multi-church memberships (no limit on number of churches per user)
- Handle users without church membership (empty array `[]`)

**Triggering Events:**
- User creates a church → User becomes Owner, sync immediately
- User accepts church invitation → User gains member role, sync after acceptance
- User leaves church → Remove church from membership array, sync immediately
- Church ownership transferred → Update both previous and new owner roles, sync immediately
- NOTE: Invitation creation does NOT trigger sync (only acceptance does)

**Data Migration:**
- One-time migration to sync all existing user church memberships to Keycloak
- Migration should run as a background job/script
- Must handle large datasets efficiently

**Job Processing:**
- Migrate from RxJS to BullMQ for reliable job queue processing
- Create separate worker entrypoint (`worker.ts`) for processing sync jobs
- Leverage existing outbox pattern for guaranteed delivery
- Implement retry logic for failed Keycloak API calls

**Roles:**
- Use existing MemberRole schema from `src/churches/schemas.ts`
- Roles are already defined (likely: Owner, Admin, Pastor, Member)
- No new role definitions needed

**Ownership Transfer Behavior:**
- When ownership transfers, update BOTH users in Keycloak
- Previous owner: Owner role removed, but user remains member with their choice of role
- New owner: Owner role added
- Both updates should be atomic within the sync job

### Reusability Opportunities

**Components that exist and should be leveraged:**
- Keycloak Admin Client for API interactions (`src/keycloak/admin-client.ts`)
- Outbox publisher pattern for event-driven architecture (`src/keycloak/outbox.publisher.ts`)
- Generalized outbox adapter for database integration (`src/keycloak/generalized-outbox.adapter.ts`)
- Church repository for querying membership data (`src/churches/postgres-repository.ts`)
- Membership service for business logic (`src/churches/membership-service.ts`)
- MemberRole schema for role validation (`src/churches/schemas.ts`)

**Backend patterns to follow:**
- Event-driven architecture using outbox pattern
- Repository pattern for data access
- Handler factory pattern for dependency injection
- safeExecute utility for error handling
- Structured logging with request correlation

### Scope Boundaries

**In Scope:**
- Event-driven sync of church membership to Keycloak user attributes
- BullMQ job queue setup and worker process
- One-time migration script for existing users
- Update Keycloak user attributes via Admin API
- Retry logic for failed sync operations
- Handling of multi-church memberships
- Ownership transfer sync (both previous and new owner)
- Empty array for users without church membership

**Out of Scope:**
- Sync on invitation creation (only after acceptance)
- UI/frontend changes for managing memberships
- Changes to JWT validation logic (assumes existing logic handles empty arrays)
- Keycloak realm configuration changes (assumes `church_membership` scope already configured)
- Real-time websocket notifications of claim changes
- Rollback mechanism for failed migrations (forward-only)
- ACL implementation on Keycloak side (separate future work)
- Batch/scheduled sync (only event-driven)

### Technical Considerations

**Integration Points:**
- Keycloak Admin API for user attribute updates
- BullMQ for job queue (new dependency)
- Redis for BullMQ job storage (already available)
- PostgreSQL for outbox table and church membership queries
- Existing church membership endpoints to emit events

**Technology Stack:**
- **BullMQ**: Job queue and worker management (replacing RxJS for async processing)
- **Keycloak Admin Client**: Already exists in codebase
- **PostgreSQL**: Outbox table for event persistence
- **Redis**: BullMQ backend storage (already in tech stack)
- **TypeScript**: Type-safe event and job definitions

**Architectural Patterns:**
- Outbox pattern for reliable event publishing
- Worker pattern for background job processing
- Repository pattern for data access
- Event-driven architecture for decoupled sync logic

**Migration Strategy:**
- Create migration script to populate Keycloak with existing memberships
- Should be idempotent (safe to run multiple times)
- Log progress and errors for monitoring
- Run as one-time setup before enabling event-driven sync

**Error Handling:**
- Use safeExecute for all async operations
- Retry failed Keycloak API calls through job retry mechanism
- Log all errors with structured logging
- Dead letter queue for permanently failed jobs

**Performance Considerations:**
- Batch migration script should process in chunks to avoid memory issues
- Job queue prevents overwhelming Keycloak Admin API
- Consider rate limiting for Keycloak API calls
- Monitor job queue depth and processing times

**Testing Requirements:**
- Unit tests for sync job logic
- Integration tests with test Keycloak instance
- Mock Keycloak Admin API for repository tests
- Test all triggering events emit correct sync jobs
- Test migration script with sample data
- Test retry logic for failed API calls

**Deployment Considerations:**
- Worker process requires separate deployment/container
- Environment variables for BullMQ configuration
- Health check endpoint for worker process
- Graceful shutdown for in-progress jobs
- Migration script execution as part of deployment pipeline
