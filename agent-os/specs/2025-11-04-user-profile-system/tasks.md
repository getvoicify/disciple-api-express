# Task Breakdown: User Profile System

## Overview
Total Tasks: 4 Task Groups
Estimated Effort: 2 weeks (Large)

## Task List

### Database & Repository Layer

#### Task Group 1: User Profiles Database and Repository
**Dependencies:** None

- [x] 1.0 Complete database and repository layer
  - [x] 1.1 Write 5-8 focused tests for ProfileRepository
    - Test profile CRUD operations (create, findById, update)
    - Test privacy filtering (respect privacy_mode when fetching profiles)
    - Test statistics aggregation queries (notes count, prayers count, devotionals count)
    - Test cached metrics storage and retrieval
    - Test Keycloak user ID foreign key relationship
    - Verify the test using the coderabbit-reviewer agent and fix any critical issue
  - [x] 1.2 Create database migration for user_profiles table
    - Table: `user_profiles` with UUID `user_id` as primary key (references Keycloak user)
    - Fields: `bio` (TEXT), `testimony` (TEXT), `profile_photo_media_id` (UUID FK to media)
    - Fields: `privacy_mode` (ENUM: 'public', 'church_only', 'private', default 'church_only')
    - Fields: `field_visibility_settings` (JSONB), `cached_metrics` (JSONB)
    - Fields: `notification_preferences` (JSONB), `preferred_devotional_time` (TIME)
    - Timestamps: `created_at`, `updated_at` with auto-update trigger
    - Indexes: primary key on `user_id`, index on `privacy_mode`
    - Follow pattern from: `migrations/001_create_notes_table.sql`
  - [x] 1.3 Create ProfileRepository interface
    - Methods: `create(profile)`, `findById(userId, requestingUserId)`, `update(userId, data)`
    - Methods: `getStatistics(userId)`, `getCachedMetrics(userId)`, `updateCachedMetrics(userId, metrics)`
    - Privacy filtering parameter in `findById` to enforce access control
    - Follow pattern from: `src/notes/repository.ts`
  - [x] 1.4 Implement PostgresProfileRepository
    - CRUD operations with safeExecute error handling
    - Privacy enforcement: filter based on privacy_mode and requesting user's role
    - Aggregation queries for statistics (notes count, prayers count, devotionals count)
    - Keycloak integration: validate user_id exists in Keycloak
    - Follow pattern from: `src/notes/pg-repository.ts`
    - Verify the implementation using the coderabbit-reviewer agent and fix any critical issue
  - [x] 1.5 Ensure database layer tests pass
    - Run ONLY the 5-8 tests written in 1.1
    - Verify migration runs successfully
    - Verify privacy filtering works correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 5-8 tests written in 1.1 pass
- Migration creates user_profiles table with correct schema
- ProfileRepository enforces privacy settings
- Statistics aggregation queries return accurate counts
- Cached metrics can be stored and retrieved

### Service Layer

#### Task Group 2: Profile Service and Business Logic
**Dependencies:** Task Group 1

- [ ] 2.0 Complete service layer
  - [ ] 2.1 Write 5-8 focused tests for ProfileService
    - Test createProfile with Keycloak sync (auto-populate from Keycloak data)
    - Test updateProfile with cache invalidation
    - Test getProfile with privacy enforcement
    - Test getStatistics with metrics calculation and caching
    - Test getDashboard data aggregation from multiple sources
    - Verify the test using the coderabbit-reviewer agent and fix any critical issue
  - [ ] 2.2 Create Zod validation schemas
    - `CreateProfileSchema`: bio, testimony, profile_photo_media_id, privacy_mode, field_visibility_settings
    - `UpdateProfileSchema`: partial updates for all profile fields
    - `PrivacyModeEnum`: 'public', 'church_only', 'private'
    - `FieldVisibilitySchema`: JSONB structure for per-field visibility
    - Follow pattern from: `src/notes/schemas.ts`
  - [ ] 2.3 Implement ProfileService
    - Method: `createProfile(userId, data)` - Create profile with Keycloak sync
    - Method: `updateProfile(userId, data)` - Update profile and invalidate cache
    - Method: `getProfile(userId, requestingUserId)` - Fetch profile with privacy enforcement
    - Method: `getStatistics(userId)` - Calculate/fetch statistics with caching
    - Method: `getDashboard(userId)` - Aggregate recent notes, prayers, devotionals
    - Keycloak integration: Use KeycloakAdminClient to fetch/sync user attributes
    - Redis caching: Cache profile data and statistics with 5-minute TTL
    - Follow pattern from: `src/notes/service.ts`
    - Verify the implementation using the coderabbit-reviewer agent and fix any critical issue
  - [ ] 2.4 Implement dashboard aggregation logic
    - Query recent notes (last 10) from notes table
    - Query active prayer requests and memberships from prayer_wall_memberships
    - Query devotional series progress from posts/series tables
    - Calculate spiritual health score or engagement summary
    - Combine data into unified dashboard response
  - [ ] 2.5 Ensure service layer tests pass
    - Run ONLY the 5-8 tests written in 2.1
    - Verify Keycloak sync works with mock admin client
    - Verify cache invalidation on profile update
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 5-8 tests written in 2.1 pass
- ProfileService properly syncs with Keycloak
- Statistics are calculated correctly and cached
- Dashboard aggregates data from all sources (notes, prayers, devotionals)
- Redis cache improves performance for repeated requests

### API Endpoints

#### Task Group 3: Profile API Endpoints
**Dependencies:** Task Group 2

- [ ] 3.0 Complete API endpoints
  - [ ] 3.1 Write 6-8 focused tests for profile endpoints
    - Test POST /profiles (profile creation with Keycloak auto-population)
    - Test PUT /profiles/:userId (own profile update only, authorization check)
    - Test GET /profiles/:userId (privacy enforcement based on requesting user)
    - Test GET /profiles/:userId/dashboard (dashboard data aggregation)
    - Test GET /profiles/:userId/statistics (statistics retrieval)
    - Test profile photo upload integration with media system
    - Verify the test using the coderabbit-reviewer agent and fix any critical issue
  - [ ] 3.2 Create profileCreate.endpoint.ts (POST /profiles)
    - Auto-populate from Keycloak on first access
    - Validate request body with CreateProfileSchema
    - Use existing media upload for profile photo (reference media_id)
    - Return created profile with 201 status
    - Follow pattern from: `src/notes/routes/noteCreate.endpoint.ts`
  - [ ] 3.3 Create profileUpdate.endpoint.ts (PUT /profiles/:userId)
    - Authorization: only allow users to update their own profile
    - Validate request body with UpdateProfileSchema
    - Invalidate Redis cache on successful update
    - Return updated profile with 200 status
    - Follow pattern from: `src/notes/routes/noteUpdate.endpoint.ts`
  - [ ] 3.4 Create profileFetch.endpoint.ts (GET /profiles/:userId)
    - Extract requesting user from JWT: `req.user[1].payload.sub`
    - Enforce privacy settings based on privacy_mode
    - Pastors bypass privacy restrictions for church members
    - Return profile with 200 status or 403 if access denied
    - Follow pattern from: `src/notes/routes/noteFetch.endpoint.ts`
  - [ ] 3.5 Create dashboardFetch.endpoint.ts (GET /profiles/:userId/dashboard)
    - Authorization: users can only view their own dashboard
    - Return aggregated dashboard data (notes, prayers, devotionals)
    - Include spiritual health score/engagement summary
    - Return dashboard with 200 status
  - [ ] 3.6 Create profileStatistics.endpoint.ts (GET /profiles/:userId/statistics)
    - Enforce privacy settings (respect field_visibility_settings)
    - Return cached statistics or calculate if cache expired
    - Include: notes count, prayers count, devotionals count, days active
    - Return statistics with 200 status
  - [ ] 3.7 Set up routes and register endpoints
    - Create `src/profiles/routes/routes.ts`
    - Register all profile endpoints with Express router
    - Add JWT authentication middleware to all routes
    - Follow pattern from: `src/notes/routes/routes.ts`
  - [ ] 3.8 Ensure API endpoint tests pass
    - Run ONLY the 6-8 tests written in 3.1
    - Verify authentication and authorization work correctly
    - Verify privacy enforcement at API level
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 6-8 tests written in 3.1 pass
- All CRUD operations work via API
- Privacy settings properly enforced at API level
- Profile photo upload integrates with existing media system
- Dashboard and statistics endpoints return accurate data
- Keycloak user data syncs correctly on profile creation

### Testing & Integration

#### Task Group 4: Test Review & End-to-End Integration
**Dependencies:** Task Groups 1-3

- [ ] 4.0 Review existing tests and verify end-to-end integration
  - [ ] 4.1 Review tests from Task Groups 1-3
    - Review the 5-8 tests written for ProfileRepository (Task 1.1)
    - Review the 5-8 tests written for ProfileService (Task 2.1)
    - Review the 6-8 tests written for profile endpoints (Task 3.1)
    - Total existing tests: approximately 16-24 tests
  - [ ] 4.2 Analyze test coverage gaps for User Profile System only
    - Identify critical user workflows lacking coverage
    - Focus on privacy control edge cases (pastors viewing private profiles, field-level visibility)
    - Identify Keycloak integration scenarios not yet tested
    - Focus on dashboard aggregation accuracy
    - Do NOT assess entire application test coverage
  - [ ] 4.3 Write up to 10 additional strategic tests maximum
    - Add tests for privacy enforcement edge cases (e.g., pastor viewing member profile across churches)
    - Add test for Keycloak sync on profile creation with real KeycloakAdminClient mock
    - Add test for cache invalidation flow (update profile → cache cleared → fresh fetch)
    - Add test for dashboard aggregation accuracy (verify counts match source tables)
    - Add test for field-level visibility (hide specific fields based on field_visibility_settings)
    - Add test for profile photo upload integration with media system
    - Add test for statistics caching and refresh logic
    - Focus on integration points between profile, notes, prayers, devotionals
    - Do NOT write comprehensive coverage for all scenarios
  - [ ] 4.4 Run feature-specific tests only
    - Run ONLY tests related to User Profile System (tests from 1.1, 2.1, 3.1, and 4.3)
    - Expected total: approximately 26-34 tests maximum
    - Verify all critical workflows pass (create profile, update profile, fetch with privacy, dashboard aggregation)
    - Do NOT run the entire application test suite
  - [ ] 4.5 Verify success criteria from spec
    - Profile page loads within 500ms for cached data (measure with performance test)
    - Dashboard aggregates data accurately from all sources (verify counts)
    - Privacy settings properly restrict profile visibility (test all privacy modes)
    - Statistics match actual counts from source tables (compare aggregated vs real data)
    - Profile photo upload succeeds using existing media system (integration test)
    - Keycloak user data syncs correctly on profile creation (verify firstName, lastName, email)
    - Pastors can view all church member profiles for pastoral care (authorization test)

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 26-34 tests total)
- Critical user workflows for User Profile System are covered
- No more than 10 additional tests added when filling in testing gaps
- Privacy controls work correctly in all scenarios
- Dashboard aggregation is accurate
- Keycloak integration syncs data properly
- Performance meets success criteria (500ms for cached data)

## Execution Order

Recommended implementation sequence:
1. **Database & Repository Layer** (Task Group 1) - Foundation for data storage and retrieval
2. **Service Layer** (Task Group 2) - Business logic, Keycloak integration, caching
3. **API Endpoints** (Task Group 3) - HTTP interface for profile operations
4. **Testing & Integration** (Task Group 4) - Verify end-to-end functionality and fill gaps

## Notes

**Key Integration Points:**
- Keycloak: Use `src/keycloak/admin-client.ts` to fetch user attributes (firstName, lastName, email)
- Media: Reuse `src/media/routes/mediaUpload.endpoint.ts` for profile photo uploads
- Notes: Query `notes` table for recent notes and notes count
- Prayers: Query `prayer_requests` and `prayer_wall_memberships` for prayer activity
- Devotionals: Query `posts` and `series` tables for devotional progress

**Performance Considerations:**
- Use Redis caching for profile data and statistics (5-minute TTL)
- Store cached_metrics in database JSONB field to avoid expensive aggregations
- Index user_id in all aggregation queries for fast lookups
- Lazy-load dashboard components if needed

**Privacy Enforcement:**
- Enforce at repository level: filter profiles based on privacy_mode
- Enforce at API level: check requesting user's role and relationship
- Pastors bypass privacy restrictions for church members
- Field-level visibility applied after fetching profile data

**Testing Strategy:**
- Limit initial tests to 2-8 per task group for focused TDD
- Fill gaps with maximum 10 additional tests in Task Group 4
- Focus on integration points and privacy controls
- Use mock KeycloakAdminClient for Keycloak integration tests
- Verify statistics accuracy by comparing to source tables
