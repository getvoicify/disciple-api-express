# Specification: User Info Embedding

## Goal
Eliminate client-side N+1 network calls by embedding lightweight user profile objects in API responses for entities that reference users by ID only (devotionals, prayers, notes, series).

## User Stories
- As an API consumer, I want devotional responses to include author information so that I don't need separate API calls to fetch user details
- As a mobile app developer, I want prayer responses to include author and responder details so that I can display user info without multiple requests
- As a frontend developer, I want note responses to include owner information so that I can show who created each note without additional fetches
- As an API consumer, I want series responses to include author details so that I can attribute content creators efficiently

## Core Requirements

**Embed User Objects in Responses:**
- Daily devotionals include `author` object alongside `authorId`
- Prayer requests include `author` object alongside `authorId`
- Prayer responses include `responder` object alongside `responderId`
- Notes include `owner` object alongside `ownerId`
- Series include `author` object alongside `authorId`

**User Object Structure:**
Each embedded user object contains:
- `id` - User's unique identifier
- `firstName` - From Keycloak `given_name` claim
- `lastName` - From Keycloak `family_name` claim
- `displayName` - Formatted display name
- `avatarUrl` - Profile picture URL (nullable)
- `email` - Email address (nullable, privacy-controlled)

**Backward Compatibility:**
- Keep existing ID fields (`authorId`, `ownerId`, etc.) in all responses
- Add new embedded objects (`author`, `owner`, etc.) as additional fields
- No breaking changes to existing API contracts
- Existing clients continue to work without modifications

**Privacy Controls:**
- Apply `applyFieldVisibility` method to filter embedded user data
- Hide email field based on user privacy settings
- Hide user info entirely for anonymous prayers
- Respect existing profile visibility settings

**Keycloak Data Synchronization:**
- Sync Keycloak claims (`given_name`, `family_name`, `email`) into user profile table when user creates their profile
- Update profile creation endpoint/service to extract and store Keycloak claims
- Verify user profile table has required columns (firstName, lastName, displayName, avatarUrl, email)
- Create database migration to add missing columns if needed

**Redis Caching Strategy:**
- Cache user profile data with key pattern: `user:profile:{userId}`
- Set TTL to 15 minutes (configurable via environment)
- Implement cache-aside pattern (check cache first, fallback to database)
- Batch fetch multiple user profiles to populate cache efficiently
- Invalidate cache on profile update and profile delete operations
- Reduce N+1 query problem by caching frequently accessed user data

**Data Backfill:**
- Create migration script to backfill user info for existing entities
- Use batch processing to avoid database performance impact
- Fetch user profile data and update devotionals, prayers, notes, series records
- Handle missing user profiles gracefully

## Visual Design
No visual mockups provided - backend API changes only.

## Reusable Components

### Existing Code to Leverage

**User Profile System:**
- `src/profiles/service.ts` - `applyFieldVisibility` method for privacy enforcement (extend for embedded user data)
- `src/profiles/pg-repository.ts` - Profile data access patterns to reference
- `src/profiles/repository.ts` - Repository interface to follow
- `src/profiles/schemas.ts` - Zod schemas for validation patterns

**Caching Infrastructure:**
- `src/cache/cache.repository.ts` - `CacheRepository` interface with `write()`, `read()`, `delete()`, `deletePattern()` methods
- `src/cache/redis-cache.repository.ts` - Redis implementation already configured
- Profile service already uses caching with `CACHE_TTL` pattern to follow

**Entity Services & Repositories:**
- `src/posts/routes/dailyDevotionals.endpoint.ts` - Daily devotionals endpoint to modify
- `src/prayer-walls/services/prayer-request.service.ts` - Prayer request service to modify
- `src/prayer-walls/schemas/prayer.schemas.ts` - Prayer schemas to extend
- `src/notes/service.ts` - Notes service to modify
- `src/series/service.ts` - Series service to modify

**Testing Patterns:**
- `src/tests/profiles/field-visibility.test.ts` - Field visibility testing pattern
- `src/tests/profiles/church-membership-privacy.test.ts` - Privacy control testing pattern

**Established Patterns:**
- Repository pattern for data access (all entities use dedicated repository classes)
- Handler factory pattern with dependency injection
- `safeExecute` utility for error handling
- Request-scoped logging via `req.log`
- Service layer throws custom errors extending `AppError`
- Zod schemas for request/response validation

### New Components Required

**User Info Service:**
- Create new utility service for fetching and caching user profile data
- Implements batch fetching to load multiple user profiles efficiently
- Handles cache-aside logic (check cache, fallback to DB, populate cache)
- Returns privacy-filtered user objects via `applyFieldVisibility`
- Required because existing profile service doesn't support batch operations or embedding logic

**User Embedding Helper:**
- Create utility function to attach user objects to entity responses
- Takes array of entities with user IDs, fetches user data, merges into responses
- Handles missing user profiles gracefully (e.g., deleted users)
- Required because this embedding pattern doesn't exist yet across multiple entity types

**Database Migration:**
- Add firstName, lastName columns to user profile table if missing
- Backfill migration to populate user info in existing entity tables
- Required because Keycloak claim sync and embedding are new requirements

**Response Schema Updates:**
- Extend Zod schemas for devotionals, prayers, notes, series to include embedded user objects
- Add optional user object fields to response types
- Required to maintain type safety and validation for new response structure

## Technical Approach

**Keycloak Claims Sync:**
- Extract claims from JWT at `req.user[1].payload` during profile creation
- Map `given_name` → `firstName`, `family_name` → `lastName`, `email` → `email`, `sub` → `id`
- Delegate Keycloak data extraction and storage to user profile service (modify `createProfile` method)
- Update `profileCreate.endpoint.ts` to pass Keycloak claims to service

**User Info Service Implementation:**
- Create `src/user-info/service.ts` with batch fetch and caching logic
- Use existing `ProfileRepository` for database access
- Use existing `CacheRepository` for Redis operations
- Implement `getBatchUserInfo(userIds: string[], requestingUserId: string): Promise<Map<string, UserInfo>>`
- Apply privacy filtering via existing `applyFieldVisibility` method

**Entity Service Modifications:**
- Modify devotionals, prayers, notes, series services to call user info service
- After fetching entities, extract unique user IDs
- Batch fetch user info for all IDs
- Merge user objects into entity responses before returning

**Cache Invalidation:**
- Extend profile update and delete handlers to invalidate cache
- Use `cacheRepository.delete('user:profile:' + userId)` pattern
- Follow existing cache invalidation patterns from profile service

**Performance Optimization:**
- Set cache TTL to 15 minutes to balance freshness and database load
- Use batch fetching to minimize database round-trips
- Target <50ms overhead per request for cache lookups
- Monitor cache hit rates and adjust TTL if needed

**Database Schema:**
- Verify `user_profiles` table has: `first_name`, `last_name`, `display_name`, `avatar_url`, `email`
- Create migration to add missing columns with appropriate data types
- Add indexes on user_id for efficient lookups

## Out of Scope
- Real-time sync of Keycloak changes (only sync on profile creation, not on every authentication)
- GraphQL implementation (REST API changes only)
- Embedding user info in other entities not mentioned (media uploads, comments, attachments, etc.)
- Complete redesign of user profile table structure (additive changes only)
- API versioning (maintaining v1 with additive changes for backward compatibility)
- New privacy settings UI or privacy setting fields (reuse existing controls)
- Embedding deeply nested related objects (just one level - user info only)
- Automatic cache warming or predictive loading strategies

## Success Criteria
- API responses for devotionals, prayers, notes, series include embedded user objects
- Client-side network calls reduced by eliminating need for separate user fetch requests
- Existing API contracts remain unbroken (existing clients work without changes)
- Privacy settings correctly filter embedded user data (email hidden when private, anonymous prayers hide user)
- Cache hit rate >70% for user profile data within 15-minute TTL window
- Database query count for list endpoints remains low (<5 queries) via Redis caching
- Response time overhead for user embedding <50ms per request
- All existing tests continue to pass
- New privacy and caching tests verify correct behavior
- Database migration successfully backfills existing entities
