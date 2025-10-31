# Specification: Keycloak Church Membership Claim Sync

## Goal
Automatically synchronize church membership data from the application database to Keycloak user attributes, enabling advanced ACL features on the Keycloak side and simplifying application authorization logic.

## User Stories
- As a church member, I want my church affiliations automatically reflected in my JWT tokens so that I have seamless access to church-specific resources
- As a church owner, I want membership changes (joins, leaves, ownership transfers) to immediately update in Keycloak so that access control is always current
- As a system administrator, I want existing church memberships migrated to Keycloak so that all users have consistent claims regardless of when they joined
- As a developer, I want reliable event-driven sync with retry logic so that temporary Keycloak API failures don't result in inconsistent state

## Core Requirements

### Church Membership Sync Events
- Sync membership to Keycloak when user creates a church (becomes Owner)
- Sync membership when user accepts church invitation (gains member role)
- Sync membership removal when user leaves a church
- Sync role updates when church ownership is transferred (update both previous and new owner)
- Do NOT sync when invitation is created (only after acceptance)

### JWT Claims Structure
- Maintain `church_membership` claim as array: `[{churchId: string, role: string}]`
- Support multi-church memberships with no limit on array size
- Use empty array `[]` for users without church affiliations
- Roles from existing MemberRole schema: `Owner`, `Manager`, `Member`

### Job Queue and Processing
- Replace RxJS with BullMQ for job queue management
- Create separate worker entrypoint (`worker.ts`) for processing sync jobs
- Use Redis for BullMQ job storage (already in tech stack)
- Implement retry logic with exponential backoff for failed Keycloak API calls
- Support dead letter queue for permanently failed jobs

### Data Migration
- One-time migration script to sync all existing church memberships to Keycloak
- Process in batches to handle large datasets efficiently
- Idempotent design (safe to run multiple times)
- Log progress and errors for monitoring

### Ownership Transfer Behavior
- Update BOTH users atomically when ownership transfers
- Previous owner: Remove Owner role, retain membership with their chosen role
- New owner: Add Owner role to their membership
- Both updates processed within single sync job

## Visual Design
No UI changes required - this is a backend synchronization feature.

## Reusable Components

### Existing Code to Leverage

**Keycloak Integration:**
- `src/keycloak/admin-client.ts` - Admin API client with token management and safeExecute patterns
- `src/keycloak/types.ts` - Type definitions for Keycloak resources
- `src/keycloak/setup.ts` - Keycloak initialization patterns

**Outbox Pattern:**
- `src/outbox/index.ts` - Outbox implementation with retry policies and event deduplication
- `src/outbox/postgres-store.ts` - PostgreSQL outbox store for event persistence
- `src/keycloak/outbox.publisher.ts` - Publisher pattern for processing Keycloak events
- `src/keycloak/generalized-outbox.adapter.ts` - Event adapter implementation

**Church Domain:**
- `src/churches/schemas.ts` - MemberRole enum (`Owner`, `Manager`, `Member`)
- `src/churches/repository.ts` - Church repository interface
- `src/churches/postgres-repository.ts` - Church repository implementation for querying memberships
- `src/churches/membership-service.ts` - Business logic for membership operations

**Utilities:**
- `src/utils/handle-async.ts` - safeExecute utility for error handling
- `src/logging` - Structured logging with correlation IDs

### New Components Required

**BullMQ Infrastructure:**
- Worker entrypoint (`worker.ts`) - New file to process background jobs separately from API server
- BullMQ queue setup and configuration - Existing outbox doesn't use BullMQ, need migration
- Job definitions for church membership sync events
- Worker process with graceful shutdown handling

**Church Membership Sync:**
- New event types for church membership changes (create, join, leave, transfer)
- Church membership sync job processor to call Keycloak Admin API
- Service to retrieve all user church memberships for a given userId
- Migration script to backfill existing church memberships to Keycloak

**Keycloak User Attributes:**
- New methods in admin-client to update user attributes (not just resources)
- Logic to transform church membership array to Keycloak attribute format
- Attribute key: `church_membership` with JSON-serialized array value

**Why New Code Needed:**
- Current Keycloak integration focuses on resource management (prayer walls), not user attributes
- BullMQ replaces RxJS approach for more robust job processing with separate worker
- Church membership domain events don't currently exist in the outbox system
- Migration script is one-time operation specific to this feature

## Technical Approach

### Architecture Overview
- Event-driven sync using outbox pattern for guaranteed delivery
- Church membership changes emit events to outbox table
- BullMQ worker polls outbox and processes sync jobs
- Keycloak Admin API updates user attributes with membership array

### BullMQ Migration
- Install `bullmq` npm package and configure Redis connection
- Create `worker.ts` entrypoint separate from main `index.ts`
- Define job types for church membership sync events
- Implement worker process that reads outbox events and enqueues BullMQ jobs
- Configure retry strategy with exponential backoff (5 attempts, 1s initial delay)

### Keycloak Admin API Integration
- Extend `KeycloakAdminClient` with methods to get/update user attributes
- User attribute key: `church_membership`
- Value: JSON.stringify(array of `{churchId, role}` objects)
- Use existing `safeExecute` and token management patterns

### Event Emission Points
- Church creation endpoint: emit `church:membership:owner-created` event
- Invitation acceptance endpoint: emit `church:membership:member-joined` event
- Leave church endpoint: emit `church:membership:member-left` event
- Ownership transfer endpoint: emit `church:membership:ownership-transferred` event with both userIds

### Migration Script
- Standalone script (not part of API or worker)
- Query all church memberships from database
- Group by userId to build membership arrays
- Call Keycloak Admin API to set `church_membership` attribute for each user
- Process in batches of 100 users to manage memory and API rate limits
- Log progress every 100 users and errors to structured logger

### Data Flow
1. Church membership change occurs via API endpoint
2. Endpoint emits domain event to outbox table using existing pattern
3. BullMQ worker polls outbox for pending events
4. Worker enqueues BullMQ job for each outbox event
5. Job processor queries current user memberships from database
6. Job processor calls Keycloak Admin API to update user attributes
7. On success: mark outbox event as processed
8. On failure: retry with exponential backoff (BullMQ handles this)
9. After max retries: move to dead letter queue for manual investigation

### Error Handling
- Use `safeExecute` for all async operations (database, Keycloak API)
- Log all errors with structured logging and correlation IDs
- Graceful errors (user not found in Keycloak) should log warning but not retry
- Transient errors (network timeout, Keycloak unavailable) should retry via BullMQ
- Dead letter queue captures permanently failed jobs for ops investigation

### Testing Strategy
- Unit tests for sync job logic with mocked Keycloak Admin API
- Integration tests using test Keycloak instance
- Test all triggering events emit correct outbox events
- Test migration script with sample membership data
- Test retry logic by simulating Keycloak API failures
- Test ownership transfer updates both users atomically
- Test empty array for users without memberships

## Out of Scope
- Sync on invitation creation (only after acceptance)
- UI/frontend changes for managing memberships
- Changes to JWT validation logic (assumes existing logic handles empty arrays)
- Keycloak realm configuration changes (assumes `church_membership` scope exists)
- Real-time WebSocket notifications of claim changes
- Rollback mechanism for failed migrations (forward-only approach)
- ACL implementation on Keycloak side (future work after claims are synced)
- Batch/scheduled sync (only event-driven real-time sync)
- Permission management for church resources (separate from user attributes)

## Success Criteria
- All church membership changes reflected in Keycloak user attributes within 30 seconds
- Migration script successfully syncs 100% of existing church memberships
- JWT tokens contain accurate `church_membership` claim matching database state
- Failed sync attempts retry automatically with exponential backoff
- Zero data loss even during Keycloak API outages (outbox guarantees delivery)
- Worker process handles graceful shutdown without dropping in-flight jobs
- Dead letter queue captures <1% of sync jobs (only permanent failures)
- Structured logs provide clear audit trail of all sync operations
