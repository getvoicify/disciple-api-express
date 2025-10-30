# Task Breakdown: Keycloak Church Membership Claim Sync

## Overview
Total Task Groups: 6
Estimated Timeline: 2-3 weeks

## Task List

### Infrastructure Setup

#### Task Group 1: BullMQ Job Queue Infrastructure
**Dependencies:** None

- [x] 1.0 Complete BullMQ infrastructure setup
  - [x] 1.1 Write 2-8 focused tests for BullMQ queue operations
    - Test job enqueue and processing
    - Test retry logic with exponential backoff
    - Test dead letter queue for failed jobs
    - Test graceful shutdown of worker
  - [x] 1.2 Install and configure BullMQ
    - Add `bullmq` npm package to dependencies
    - Configure Redis connection for BullMQ
    - Set up environment variables for BullMQ configuration
  - [x] 1.3 Create worker entrypoint (`worker.ts`)
    - Separate entrypoint from main `index.ts`
    - Initialize BullMQ worker with Redis connection
    - Set up graceful shutdown handlers (SIGTERM, SIGINT)
    - Configure structured logging for worker process
  - [x] 1.4 Define job types and queue configuration
    - Create type definitions for church membership sync jobs
    - Configure retry strategy: 5 attempts, 1s initial delay, exponential backoff
    - Set up dead letter queue for permanently failed jobs
    - Define job payload schemas using Zod
  - [x] 1.5 Ensure BullMQ infrastructure tests pass
    - Run ONLY the 2-8 tests written in 1.1
    - Verify jobs can be enqueued and processed
    - Verify retry logic works correctly

**Acceptance Criteria:**
- BullMQ package installed and configured
- Worker entrypoint (`worker.ts`) created and functional
- Job types and retry logic defined
- Tests pass for job processing and retry behavior
- Worker handles graceful shutdown

**Implementation Notes:**
- Worker entrypoint was initially missing and added on 2025-10-29
- Centralized handler registry factory created to ensure handlers are registered at runtime
- See `implementations/1-worker-entrypoint-implementation.md` for supplemental details

---

### Keycloak Integration

#### Task Group 2: Keycloak User Attributes Management
**Dependencies:** None (can run in parallel with Task Group 1)

- [x] 2.0 Complete Keycloak user attributes integration
  - [x] 2.1 Write 2-8 focused tests for Keycloak user attribute operations
    - Test getting user attributes from Keycloak
    - Test updating user attributes in Keycloak
    - Test attribute format transformation (array to JSON string)
    - Test error handling for API failures
    - Mock Keycloak Admin API responses
  - [x] 2.2 Extend KeycloakAdminClient with user attribute methods
    - Add `getUserAttributes(userId: string)` method
    - Add `updateUserAttributes(userId: string, attributes: Record<string, string>)` method
    - Reuse existing token management and safeExecute patterns from `src/keycloak/admin-client.ts`
    - Handle Keycloak API errors gracefully
  - [x] 2.3 Create church membership attribute transformer
    - Transform `{churchId, role}[]` to JSON string for Keycloak
    - Parse JSON string from Keycloak back to typed array
    - Handle empty arrays correctly
    - Validate role values against MemberRole schema
  - [x] 2.4 Add structured logging for Keycloak operations
    - Log all user attribute get/update operations
    - Include userId, churchId, and operation type in logs
    - Use correlation IDs for request tracing
  - [x] 2.5 Ensure Keycloak integration tests pass
    - Run ONLY the 2-8 tests written in 2.1
    - Verify user attributes can be read and updated
    - Verify error handling works correctly

**Acceptance Criteria:**
- KeycloakAdminClient extended with user attribute methods
- Attribute transformer handles all data formats correctly
- Tests pass with mocked Keycloak API
- Structured logging in place for all operations

---

### Church Membership Service

#### Task Group 3: Church Membership Query Service
**Dependencies:** None (can run in parallel with Task Groups 1-2)

- [x] 3.0 Complete church membership query service
  - [x] 3.1 Write 2-8 focused tests for membership query service
    - Test querying all memberships for a user
    - Test handling users with no memberships
    - Test handling users with multiple churches
    - Test role mapping from database to output format
  - [x] 3.2 Create church membership query service
    - Create `getUserChurchMemberships(userId: string)` method
    - Return array of `{churchId: string, role: string}` objects
    - Use existing `src/churches/postgres-repository.ts` for database queries
    - Handle users with no memberships (return empty array)
  - [x] 3.3 Add database query optimization
    - Ensure appropriate indexes exist for membership queries
    - Optimize query to fetch all user memberships in single query
    - Use safeExecute for error handling
  - [x] 3.4 Ensure membership query service tests pass
    - Run ONLY the 2-8 tests written in 3.1
    - Verify correct membership arrays returned
    - Verify empty arrays for users without memberships

**Acceptance Criteria:**
- Service correctly queries all user church memberships
- Handles edge cases (no memberships, multiple churches)
- Tests pass for all query scenarios
- Database queries are optimized

---

### Event-Driven Sync

#### Task Group 4: Church Membership Sync Job Processor
**Dependencies:** Task Groups 1, 2, 3

- [x] 4.0 Complete sync job processor
  - [x] 4.1 Write 2-8 focused tests for sync job processor
    - Test processing church creation event (user becomes Owner)
    - Test processing membership join event
    - Test processing membership leave event
    - Test processing ownership transfer (updates both users)
    - Test retry behavior on Keycloak API failure
    - Mock both church membership service and Keycloak Admin API
  - [x] 4.2 Create church membership sync job processor
    - Implement job handler that processes BullMQ jobs
    - Query current user memberships using service from Task Group 3
    - Update Keycloak user attributes using methods from Task Group 2
    - Handle both single-user and multi-user updates (ownership transfer)
    - Use safeExecute for error handling
  - [x] 4.3 Define church membership event types
    - Create event type: `church:membership:owner-created`
    - Create event type: `church:membership:member-joined`
    - Create event type: `church:membership:member-left`
    - Create event type: `church:membership:ownership-transferred`
    - Define payload schemas for each event type using Zod
  - [x] 4.4 Implement outbox adapter for church membership events
    - Follow pattern from `src/keycloak/generalized-outbox.adapter.ts`
    - Map church membership events to sync job payloads
    - Enqueue BullMQ jobs for each outbox event
    - Handle event deduplication using existing outbox logic
  - [x] 4.5 Integrate outbox publisher with BullMQ worker
    - Connect outbox processing to BullMQ job queue
    - Poll outbox for pending church membership events
    - Enqueue jobs and mark outbox events as processed
    - Handle errors and dead letter queue
  - [x] 4.6 Ensure sync job processor tests pass
    - Run ONLY the 2-8 tests written in 4.1
    - Verify all event types processed correctly
    - Verify ownership transfer updates both users

**Acceptance Criteria:**
- Job processor handles all event types correctly
- Ownership transfers update both previous and new owner
- Retry logic works for transient failures
- Outbox events correctly enqueued as BullMQ jobs
- Tests pass for all sync scenarios

---

### Event Emission

#### Task Group 5: Emit Events from Church Membership Endpoints
**Dependencies:** Task Group 4

- [x] 5.0 Complete event emission from endpoints
  - [x] 5.1 Write 2-8 focused tests for event emission
    - Test church creation emits owner-created event
    - Test invitation acceptance emits member-joined event
    - Test leave church emits member-left event
    - Test ownership transfer emits ownership-transferred event
    - Verify event payloads contain correct data
    - Mock outbox store to verify event persistence
  - [x] 5.2 Add event emission to church creation endpoint
    - Locate church creation endpoint in `src/churches/routes/`
    - Emit `church:membership:owner-created` event after successful church creation
    - Include userId and churchId in event payload
    - Use existing outbox pattern for event persistence
  - [x] 5.3 Add event emission to invitation acceptance endpoint
    - Locate invitation acceptance endpoint in `src/churches/routes/`
    - Emit `church:membership:member-joined` event after successful acceptance
    - Include userId, churchId, and role in event payload
    - Do NOT emit event on invitation creation
  - [x] 5.4 Add event emission to leave church endpoint
    - Locate leave church endpoint in `src/churches/routes/`
    - Emit `church:membership:member-left` event after successful leave
    - Include userId and churchId in event payload
  - [x] 5.5 Add event emission to ownership transfer endpoint
    - Locate ownership transfer endpoint in `src/churches/routes/`
    - Emit `church:membership:ownership-transferred` event after successful transfer
    - Include previousOwnerId, newOwnerId, and churchId in payload
    - Ensure event triggers updates for BOTH users
    - NOTE: No ownership transfer endpoint exists in current codebase
  - [x] 5.6 Ensure event emission tests pass
    - Run ONLY the 2-8 tests written in 5.1
    - Verify all endpoints emit correct events
    - Verify event payloads are correct

**Acceptance Criteria:**
- All church membership endpoints emit appropriate events
- Event payloads contain all required data
- Ownership transfer event includes both user IDs (when endpoint exists)
- Tests pass for all event emission scenarios
- Events persist to outbox table correctly

**Implementation Notes:**
- No ownership transfer endpoint exists in current codebase
- Event emission infrastructure ready for when endpoint is added
- See `implementations/5-event-emission-implementation.md` for details

---

### Data Migration

#### Task Group 6: Migration Script for Existing Church Memberships
**Dependencies:** Task Groups 2, 3

- [ ] 6.0 Complete migration script
  - [ ] 6.1 Write 2-8 focused tests for migration script
    - Test migration with sample user data
    - Test batch processing logic
    - Test idempotency (safe to run multiple times)
    - Test progress logging
    - Test error handling for individual user failures
    - Mock Keycloak Admin API
  - [ ] 6.2 Create migration script file
    - Create `src/scripts/migrate-church-memberships.ts`
    - Set up standalone script execution (not part of API or worker)
    - Initialize database connection and Keycloak client
    - Configure structured logging
  - [ ] 6.3 Implement batch processing logic
    - Query all users with church memberships from database
    - Group memberships by userId
    - Process in batches of 100 users
    - For each user: query memberships, update Keycloak attributes
    - Use services from Task Groups 2 and 3
  - [ ] 6.4 Add progress tracking and logging
    - Log progress every 100 users processed
    - Log total users processed at completion
    - Log errors for individual user failures (don't stop migration)
    - Track success/failure counts
  - [ ] 6.5 Implement idempotency
    - Check existing Keycloak attributes before updating
    - Only update if attributes differ from database state
    - Allow script to be safely run multiple times
  - [ ] 6.6 Ensure migration script tests pass
    - Run ONLY the 2-8 tests written in 6.1
    - Verify batch processing works correctly
    - Verify idempotency works as expected

**Acceptance Criteria:**
- Migration script processes all users successfully
- Batch processing handles large datasets efficiently
- Script is idempotent and safe to re-run
- Progress logging provides visibility
- Individual user failures don't stop entire migration
- Tests pass for migration logic

---

### Testing & Verification

#### Task Group 7: Integration Testing and End-to-End Verification
**Dependencies:** Task Groups 1-6

- [ ] 7.0 Complete integration testing and verification
  - [ ] 7.1 Review existing tests from Task Groups 1-6
    - Review all 2-8 test sets written by previous task groups
    - Approximate total: 12-48 existing tests across all groups
    - Identify any critical integration gaps
  - [ ] 7.2 Analyze test coverage gaps for church membership sync feature
    - Focus on end-to-end workflows (endpoint → event → worker → Keycloak)
    - Identify gaps in error handling and retry scenarios
    - Check coverage for ownership transfer atomic updates
    - Do NOT assess entire application test coverage
  - [ ] 7.3 Write up to 10 additional strategic integration tests
    - Test full end-to-end flow: church creation → event → worker → Keycloak update
    - Test full end-to-end flow: invitation acceptance → event → worker → Keycloak update
    - Test full end-to-end flow: ownership transfer → event → worker → both users updated
    - Test retry behavior with simulated Keycloak API failures
    - Test worker graceful shutdown with in-flight jobs
    - Test dead letter queue for permanently failed jobs
    - Test migration script end-to-end with test database
    - Maximum 10 additional tests to fill critical gaps
  - [ ] 7.4 Run feature-specific test suite
    - Run ONLY tests related to church membership sync feature
    - Expected total: approximately 22-58 tests maximum
    - Do NOT run entire application test suite
    - Verify all critical workflows pass
  - [ ] 7.5 Manual verification with test Keycloak instance
    - Deploy worker and API to test environment
    - Create test church and verify Owner role in JWT
    - Accept invitation and verify Member role in JWT
    - Transfer ownership and verify both users updated in JWT
    - Leave church and verify membership removed from JWT
    - Run migration script and verify existing users synced

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 22-58 tests total)
- End-to-end workflows verified from endpoint to Keycloak
- Retry and error handling tested
- Manual verification completed with test Keycloak instance
- Worker graceful shutdown verified
- Migration script verified with real data

---

## Execution Order

Recommended implementation sequence:

**Phase 1: Foundation (Parallel execution recommended)**
1. Task Group 1: BullMQ Job Queue Infrastructure - COMPLETED
2. Task Group 2: Keycloak User Attributes Management - COMPLETED
3. Task Group 3: Church Membership Query Service - COMPLETED

**Phase 2: Core Sync Logic (Sequential execution)**
4. Task Group 4: Church Membership Sync Job Processor - COMPLETED

**Phase 3: Event Integration (Sequential execution)**
5. Task Group 5: Emit Events from Church Membership Endpoints - COMPLETED

**Phase 4: Migration & Testing (Sequential execution)**
6. Task Group 6: Migration Script for Existing Church Memberships
7. Task Group 7: Integration Testing and End-to-End Verification

---

## Key Implementation Notes

### Testing Philosophy
- Each task group writes 2-8 focused tests covering critical behaviors
- Tests run incrementally (only newly written tests per group)
- Final integration testing adds maximum 10 strategic tests
- Total test count stays reasonable: approximately 22-58 tests

### Parallel Execution Opportunities
- Task Groups 1, 2, and 3 can be developed in parallel by different team members
- No dependencies between these foundational components

### Critical Dependencies
- Task Group 4 requires completion of 1, 2, and 3
- Task Group 5 requires completion of 4
- Task Groups 6 and 7 require completion of 2 and 3
- Final verification (7.5) requires completion of all previous groups

### Deployment Considerations
- Worker process (`worker.ts`) requires separate deployment/container from API
- Environment variables needed for BullMQ and Keycloak configuration
- Migration script should run once before enabling event-driven sync
- Consider running migration during low-traffic window

### Success Metrics
- All church membership changes reflected in Keycloak within 30 seconds
- Zero data loss during Keycloak API outages (outbox guarantees delivery)
- Dead letter queue captures <1% of sync jobs
- Migration completes successfully for all existing users
