# Task Breakdown: User Info Embedding

## Overview
Total Task Groups: 5
Estimated Total Tasks: ~45 individual sub-tasks

## Task List

### Database & Schema Layer

#### Task Group 1: Database Schema & Keycloak Sync
**Dependencies:** None

- [ ] 1.0 Complete database schema updates and Keycloak integration
  - [ ] 1.1 Write 2-8 focused tests for database schema and Keycloak sync
    - Limit to 2-8 highly focused tests maximum
    - Test user profile table has required columns (firstName, lastName, displayName, avatarUrl, email)
    - Test Keycloak claims are extracted and stored correctly during profile creation
    - Test migration adds missing columns successfully
    - Skip exhaustive testing of all database operations
    - Use the Claude coderabbit-reviewer subagent to review the 2-8 tests written in 1.1 
  - [ ] 1.2 Inspect user_profiles table schema
    - Verify existing columns: id, user_id, created_at, updated_at
    - Check if firstName, lastName, displayName, avatarUrl, email columns exist
    - Document missing columns for migration
  - [ ] 1.3 Create database migration for missing columns
    - Add first_name VARCHAR(255) if missing
    - Add last_name VARCHAR(255) if missing
    - Add display_name VARCHAR(511) if missing (computed from first_name + last_name)
    - Add avatar_url TEXT if missing (nullable)
    - Add email VARCHAR(255) if missing (nullable)
    - Add index on user_id for efficient lookups
    - Use additive-only approach (no destructive changes)
  - [ ] 1.4 Update profile creation service to sync Keycloak claims
    - Modify `src/profiles/service.ts` `createProfile` method
    - Extract claims from JWT: `given_name`, `family_name`, `email` from `req.user[1].payload`
    - Map claims: `given_name` → `firstName`, `family_name` → `lastName`, `email` → `email`
    - Compute `displayName` from firstName + lastName
    - Store all fields in user profile table during creation
    - Throw custom error extending AppError if Keycloak claims missing
  - [ ] 1.5 Update profile creation endpoint to pass Keycloak claims
    - Modify `src/profiles/routes/profileCreate.endpoint.ts`
    - Extract JWT payload from `req.user[1].payload`
    - Pass Keycloak claims to service's `createProfile` method
    - Use safeExecute for error handling
    - Use errorCodeFactory for custom error types
    - Log profile creation with structured logger
    - Update OpenAPI documentation and schema
  - [ ] 1.6 Run database schema tests
    - Run ONLY the 2-8 tests written in 1.1
    - Verify migration runs successfully
    - Verify Keycloak claims sync correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-8 tests written in 1.1 pass
- Database migration adds all required columns
- Keycloak claims (given_name, family_name, email) sync to user profile table on creation
- No breaking changes to existing profile creation flow
- Profile service throws appropriate custom errors

---

### Core User Info Service Layer

#### Task Group 2: User Info Service with Caching
**Dependencies:** Task Group 1

- [x] 2.0 Complete user info service with batch fetching and caching
  - [x] 2.1 Write 2-8 focused tests for user info service
    - Limit to 2-8 highly focused tests maximum
    - Test batch user info fetching returns correct data for multiple user IDs
    - Test cache hit returns data without database query
    - Test cache miss queries database and populates cache
    - Test privacy filtering via applyFieldVisibility
    - Test missing user profiles handled gracefully
    - Skip exhaustive testing of all edge cases
  - [x] 2.2 Create user info service interface and types
    - Create `src/user-info/types.ts` with UserInfo type (id, firstName, lastName, displayName, avatarUrl, email)
    - Create `src/user-info/service.ts` with UserInfoService interface
    - Define method: `getBatchUserInfo(userIds: string[], requestingUserId: string): Promise<Map<string, UserInfo>>`
    - Follow existing service patterns from `src/profiles/service.ts`
  - [x] 2.3 Implement batch user profile fetching
    - Implement `getBatchUserInfo` method in UserInfoService
    - Extract unique user IDs from input array
    - Query profile repository for all user IDs in single batch query
    - Return Map of userId → UserInfo for efficient lookup
    - Handle missing profiles gracefully (skip rather than throw)
    - Use safeExecute for database operations
    - Log batch fetch operations with structured logger
  - [x] 2.4 Implement cache-aside pattern for user profiles
    - Check Redis cache first for each userId with key pattern `user:profile:{userId}`
    - Collect cache misses for batch database fetch
    - Fetch missing profiles from database via ProfileRepository
    - Store fetched profiles in Redis with 15-minute TTL (use environment variable USER_PROFILE_CACHE_TTL)
    - Merge cached and fetched profiles into final result Map
    - Use existing CacheRepository interface
    - Follow caching patterns from `src/profiles/service.ts`
  - [ ] 2.5 Implement privacy filtering for embedded user data
    - Extend `applyFieldVisibility` method in `src/profiles/service.ts` to handle embedded user objects
    - Create new method `applyFieldVisibilityToEmbedded(userInfo: UserInfo, requestingUserId: string): UserInfo`
    - Filter email field based on privacy settings
    - Return null for anonymous prayer authors (when applicable)
    - Respect existing profile visibility settings
    - Reuse privacy logic from existing profile service
    - NOTE: This will be implemented in Task Group 4 when integrating with entities
  - [x] 2.6 Implement cache invalidation on profile updates
    - Modify `updateProfile` method in `src/profiles/service.ts`
    - After successful profile update, delete cache key: `user:profile:{userId}`
    - Use `cacheRepository.delete()` method
    - Follow existing cache invalidation patterns
    - Log cache invalidation with structured logger
    - NOTE: Already implemented in src/profiles/service.ts line 435
  - [x] 2.7 Add user info service to dependency injection
    - Create factory for UserInfoService
    - Wire dependencies: ProfileRepository, CacheRepository
    - Export from `src/user-info/index.ts`
    - Follow existing DI patterns from profile module
  - [x] 2.8 Run user info service tests
    - Run ONLY the 2-8 tests written in 2.1
    - Verify batch fetching works correctly
    - Verify caching reduces database queries
    - Verify privacy filtering works
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-8 tests written in 2.1 pass
- Batch user info fetching returns correct data for multiple user IDs
- Cache-aside pattern reduces N+1 queries (cache hit returns data instantly)
- Privacy filtering correctly hides email for private profiles
- Cache invalidation clears stale data on profile updates
- Service follows established patterns (safeExecute, structured logging, custom errors)

---

### Entity Schema Updates

#### Task Group 3: Response Schema Extensions
**Dependencies:** Task Group 2

- [x] 3.0 Complete response schema updates for all entities
  - [x] 3.1 Write 2-8 focused tests for schema validation
    - Limit to 2-8 highly focused tests maximum
    - Test devotional response schema validates with embedded author object
    - Test prayer response schema validates with embedded author and responder objects
    - Test note response schema validates with embedded owner object
    - Test series response schema validates with embedded author object
    - Test backward compatibility (schemas accept responses with or without embedded objects)
    - Skip exhaustive validation testing
  - [x] 3.2 Create shared UserInfo schema
    - Create `src/user-info/schemas.ts`
    - Define Zod schema for embedded user object with fields: id, firstName, lastName, displayName, avatarUrl, email (all nullable except id)
    - Export UserInfoSchema for reuse across entity schemas
    - Follow Zod patterns from `src/profiles/schemas.ts`
  - [x] 3.3 Extend devotionals response schema
    - Locate devotionals response schema (in `src/posts/schemas.ts` or equivalent)
    - Add optional `author` field using UserInfoSchema
    - Keep existing `authorId` field for backward compatibility
    - Update TypeScript types to include embedded author
    - Validate schema with sample responses
  - [x] 3.4 Extend prayers response schema
    - Modify `src/prayer-walls/schemas/prayer.schemas.ts`
    - Add optional `author` field using UserInfoSchema
    - Add optional `responder` field using UserInfoSchema (for prayer responses)
    - Keep existing `authorId` and `responderId` fields for backward compatibility
    - Update TypeScript types to include embedded user objects
  - [x] 3.5 Extend notes response schema
    - Modify `src/notes/schemas.ts`
    - Add optional `owner` field using UserInfoSchema
    - Keep existing `ownerId` field for backward compatibility
    - Update TypeScript types to include embedded owner
  - [x] 3.6 Extend series response schema
    - Modify `src/series/schemas.ts` (or equivalent)
    - Add optional `author` field using UserInfoSchema
    - Keep existing `authorId` field for backward compatibility
    - Update TypeScript types to include embedded author
  - [x] 3.7 Run schema validation tests
    - Run ONLY the 2-8 tests written in 3.1
    - Verify all entity schemas validate with embedded user objects
    - Verify backward compatibility (old responses still valid)
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-8 tests written in 3.1 pass
- All entity response schemas include optional embedded user objects
- Schemas validate responses with or without embedded objects (backward compatible)
- TypeScript types reflect updated response structure
- Zod validation enforces correct structure

---

### Entity Service Integration

#### Task Group 4: Embed User Objects in Entity Services
**Dependencies:** Task Groups 2, 3

- [ ] 4.0 Complete user embedding in all entity services
  - [ ] 4.1 Write 2-8 focused tests for entity service embedding
    - Limit to 2-8 highly focused tests maximum
    - Test devotionals list endpoint returns embedded author objects
    - Test prayers list endpoint returns embedded author and responder objects
    - Test notes list endpoint returns embedded owner objects
    - Test series list endpoint returns embedded author objects
    - Test privacy filtering hides email when appropriate
    - Test anonymous prayers hide user info entirely
    - Skip exhaustive integration testing
  - [ ] 4.2 Create user embedding utility helper
    - Create `src/user-info/embedding.util.ts`
    - Implement `embedUserInfo<T>(entities: T[], userIdExtractor: (entity: T) => string[], userInfoMap: Map<string, UserInfo>, embedder: (entity: T, users: Map<string, UserInfo>) => T): T[]`
    - Generic utility to attach user objects to any entity array
    - Handles missing user profiles gracefully (leave field undefined)
    - Reusable across all entity types
  - [ ] 4.3 Modify devotionals service to embed author info
    - Modify `src/posts/service.ts` (or devotionals service equivalent)
    - In list/fetch methods, after retrieving devotionals, extract unique authorIds
    - Call `userInfoService.getBatchUserInfo(authorIds, requestingUserId)`
    - Use embedding utility to merge author objects into devotional responses
    - Ensure backward compatibility (authorId field still present)
    - Use safeExecute and structured logging
  - [ ] 4.4 Modify prayers service to embed author and responder info
    - Modify `src/prayer-walls/services/prayer-request.service.ts`
    - In list/fetch methods, extract unique authorIds and responderIds
    - Call `userInfoService.getBatchUserInfo([...authorIds, ...responderIds], requestingUserId)`
    - Use embedding utility to merge author and responder objects
    - Handle anonymous prayers (skip embedding if prayer is anonymous)
    - Ensure backward compatibility
  - [ ] 4.5 Modify notes service to embed owner info
    - Modify `src/notes/service.ts`
    - In list/fetch methods, extract unique ownerIds
    - Call `userInfoService.getBatchUserInfo(ownerIds, requestingUserId)`
    - Use embedding utility to merge owner objects into note responses
    - Ensure backward compatibility
  - [ ] 4.6 Modify series service to embed author info
    - Modify `src/series/service.ts`
    - In list/fetch methods, extract unique authorIds
    - Call `userInfoService.getBatchUserInfo(authorIds, requestingUserId)`
    - Use embedding utility to merge author objects into series responses
    - Ensure backward compatibility
  - [ ] 4.7 Update entity endpoints to use modified services
    - Verify `src/posts/routes/dailyDevotionals.endpoint.ts` uses updated service
    - Verify prayer endpoints use updated service
    - Verify note endpoints use updated service
    - Verify series endpoints use updated service
    - No endpoint code changes needed if service layer handles embedding
  - [ ] 4.8 Run entity service embedding tests
    - Run ONLY the 2-8 tests written in 4.1
    - Verify all entities return embedded user objects
    - Verify privacy filtering works correctly
    - Verify anonymous prayers hide user info
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-8 tests written in 4.1 pass
- Devotionals responses include embedded `author` objects
- Prayer responses include embedded `author` and `responder` objects (when not anonymous)
- Notes responses include embedded `owner` objects
- Series responses include embedded `author` objects
- Backward compatibility maintained (ID fields still present)
- Privacy settings correctly filter embedded user data
- Anonymous prayers do not expose user info

---

### Testing & Data Migration

#### Task Group 5: Test Coverage, Migration, & Final Validation
**Dependencies:** Task Groups 1-4

- [ ] 5.0 Complete test coverage, data migration, and final validation
  - [ ] 5.1 Review existing tests from Task Groups 1-4
    - Review the 2-8 tests written by database-engineer (Task 1.1)
    - Review the 2-8 tests written by service-engineer (Task 2.1)
    - Review the 2-8 tests written by schema-engineer (Task 3.1)
    - Review the 2-8 tests written by integration-engineer (Task 4.1)
    - Total existing tests: approximately 8-32 tests
  - [ ] 5.2 Analyze test coverage gaps for THIS feature only
    - Identify critical end-to-end workflows that lack test coverage
    - Focus ONLY on gaps related to user info embedding feature
    - Prioritize: cache hit rate validation, performance overhead testing, privacy edge cases
    - Do NOT assess entire application test coverage
  - [ ] 5.3 Write up to 10 additional strategic tests maximum
    - Add maximum of 10 new tests to fill identified critical gaps
    - Test cache hit rate >70% for repeated user profile fetches
    - Test response time overhead <50ms for user embedding
    - Test privacy filtering edge cases (deleted users, missing profiles)
    - Test backward compatibility (old clients still work)
    - Test N+1 query elimination (count database queries)
    - Skip performance benchmarks, load testing, and accessibility tests
  - [ ] 5.4 Create backfill migration script
    - Create `src/migrations/backfill-user-info.ts`
    - Fetch all devotionals, prayers, notes, series in batches (1000 records at a time)
    - For each batch, extract user IDs, fetch user profiles
    - Note: Actual backfill NOT required since embedding happens at API response time, not database storage
    - Script is precautionary for future database-level embedding if needed
    - Use batch processing to avoid database performance impact
  - [ ] 5.5 Update API documentation (OpenAPI/Swagger)
    - Modify `src/schemas/openapi.schemas.ts`
    - Document new embedded user object fields in response schemas
    - Mark fields as optional (backward compatible)
    - Add example responses showing embedded user objects
    - Document privacy filtering behavior
  - [ ] 5.6 Add environment variable for cache TTL
    - Add `USER_PROFILE_CACHE_TTL` to environment configuration
    - Default value: 900 (15 minutes in seconds)
    - Document in README or .env.example
    - Use in UserInfoService for cache expiration
  - [ ] 5.7 Run full feature test suite
    - Run ALL tests related to this spec's feature (tests from 1.1, 2.1, 3.1, 4.1, and 5.3)
    - Expected total: approximately 18-42 tests maximum
    - Verify all critical workflows pass
    - Verify cache hit rates meet success criteria (>70%)
    - Verify response time overhead <50ms
    - Do NOT run the entire application test suite (only feature-specific tests)
  - [ ] 5.8 Verify backward compatibility
    - Test existing API clients still work without modifications
    - Test responses without embedded objects are still valid
    - Test ID fields (authorId, ownerId, etc.) still present in all responses
    - Verify no breaking changes introduced
  - [ ] 5.9 Performance validation
    - Measure database query count for list endpoints (should be <5 queries)
    - Measure cache hit rate (target >70%)
    - Measure response time overhead (target <50ms)
    - Use monitoring/logging to track metrics
  - [ ] 5.10 Final integration testing
    - Test devotionals endpoint with embedded authors
    - Test prayers endpoint with embedded authors and responders
    - Test notes endpoint with embedded owners
    - Test series endpoint with embedded authors
    - Test privacy filtering in real scenarios
    - Test anonymous prayers hide user info
    - Verify all acceptance criteria met

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 18-42 tests total)
- Cache hit rate >70% for user profile data within 15-minute TTL window
- Response time overhead <50ms per request
- Database query count for list endpoints <5 queries
- Backward compatibility verified (existing clients work without changes)
- Privacy settings correctly filter embedded user data in all scenarios
- Anonymous prayers do not expose user information
- API documentation updated with new response structure
- No breaking changes to existing API contracts
- Backfill migration script ready (if future database-level embedding needed)

---

## Execution Order

Recommended implementation sequence:
1. **Database & Schema Layer** (Task Group 1) - Database migrations and Keycloak sync foundation
2. **Core User Info Service Layer** (Task Group 2) - Batch fetching and caching service
3. **Entity Schema Updates** (Task Group 3) - Response schema extensions for backward compatibility
4. **Entity Service Integration** (Task Group 4) - Embed user objects in all entity services
5. **Testing & Data Migration** (Task Group 5) - Gap analysis, migration scripts, and final validation

---

## Key Technical Notes

**Backward Compatibility Strategy:**
- Keep all existing ID fields (authorId, ownerId, responderId) in responses
- Add new embedded user objects (author, owner, responder) as optional fields
- Old API clients ignore new fields and continue using ID fields
- New API clients use embedded objects and skip separate user fetch requests

**Privacy Implementation:**
- Extend `applyFieldVisibility` to handle embedded user objects
- Filter email field based on user privacy settings
- Return null or skip embedding for anonymous prayers
- Respect existing profile visibility controls

**Caching Strategy:**
- Cache key: `user:profile:{userId}`
- TTL: 15 minutes (configurable via environment)
- Cache-aside pattern: check cache → fallback to DB → populate cache
- Invalidation: delete cache on profile update/delete
- Batch fetching: collect cache misses, single DB query for all misses

**Performance Targets:**
- Cache hit rate: >70%
- Response time overhead: <50ms per request
- Database queries: <5 per list endpoint (down from N+1)

**Error Handling:**
- Use `safeExecute` for all async operations
- Service layer throws custom errors extending `AppError`
- Handle missing user profiles gracefully (skip embedding rather than throw)
- Use structured logging (`req.log`) for debugging and observability
