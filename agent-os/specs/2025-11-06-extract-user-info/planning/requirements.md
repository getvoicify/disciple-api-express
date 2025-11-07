# Spec Requirements: Extract User Info

## Initial Description

There are many entities that refer to a user by their id. For instance, the `daily devotionals` endpoint returns a list of daily devotionals with the author referenced by their id as authorId. This pattern continues throughout the application. While this is efficient for the backend, I may not be so for the consumers of these endpoints because this would mean that they'd have to make extra network calls. We'd need to address this issue by also saving the user information within these entities.

We recently implemented the user profile feature and we can leverage this to solve this issue. We may need to make some adjustments to it though as it doesn't store the user's information as is in Keycloak.

## Requirements Discussion

### First Round Questions

**Q1:** I assume you want to embed user info in devotionals (authorId), prayers (authorId, responders), notes (ownerId), and series (authorId). Should we also include any other entities like media uploads, or are these the main ones?

**Answer:** Yes, let's start with these entities.

**Q2:** I'm thinking we should embed a lightweight user object with: `id`, `firstName`, `lastName`, `displayName`, `avatarUrl`, `email` (optional/privacy-controlled). Is that the right set of fields, or should we include more/less?

**Answer:** These suggested fields are correct. We might have to confirm if the Keycloak claims are firstName and lastName.

**Q3:** Should we automatically sync user data from Keycloak into the user profile table when users authenticate (keeping it up-to-date), or should this be a manual/triggered sync process?

**Answer:** Let's sync it when the user creates their profile.

**Q4:** For entities that already exist in the database with only user IDs, should we backfill the user info (migration script), or only enrich new/updated entities going forward?

**Answer:** Yes, we should backfill for such cases.

**Q5:** I assume the response format changes from:
```json
{ "id": 1, "authorId": "user-123", "title": "..." }
```
to:
```json
{ "id": 1, "authorId": "user-123", "author": { "id": "user-123", "displayName": "John Doe", "avatarUrl": "..." }, "title": "..." }
```
Is that correct, or should we replace `authorId` entirely with just the `author` object?

**Answer:** This shouldn't be a breaking change.

**Q6:** Should user info respect privacy settings (e.g., anonymous prayers don't show user info, private profiles hide email)? Or should all embedded user info be publicly visible?

**Answer:** Yes, privacy settings should be respected.

**Q7:** Since user info will be replicated across many entities, should we cache user profile data in Redis to avoid N+1 database queries when fetching the embedded user info?

**Answer:** Yes, I can get with this. I'd just need you to explain it a bit more.

**Caching Strategy Explanation Provided:**

**The Problem:** When you fetch a list of 50 devotionals, each with an `authorId`, you'd need to make 50+ additional database queries to get each author's user profile info. This is called the "N+1 query problem" and severely impacts performance.

**The Solution with Redis Caching:**

1. **First Request:** When we need user info for `userId: "abc123"`, we:
   - Check Redis cache: `GET user:profile:abc123`
   - If **cache hit** (data exists): Return cached user data instantly (no database query)
   - If **cache miss** (no data): Query database, store in Redis with TTL (e.g., 15 minutes), return data

2. **Subsequent Requests:** For the next 15 minutes, any request needing this user's info gets it instantly from Redis without touching the database.

3. **Cache Invalidation:** When a user updates their profile, we:
   - Update the database
   - Delete or update the Redis cache key: `DEL user:profile:abc123`
   - Next request rebuilds the cache with fresh data

**Benefits:**
- Fetching 50 devotionals goes from 51 database queries (1 for devotionals + 50 for users) to just 1-2 queries if users are cached
- Sub-millisecond response times for cached user data
- Dramatically reduced database load

**Q8:** Should this be an additive change (keeping `authorId` + adding `author` object for backward compatibility), or a breaking change (API versioning required)?

**Answer:** This shouldn't be a breaking change (implies additive approach).

### Follow-up Questions

**Follow-up 1:** You mentioned confirming if Keycloak uses `firstName` and `lastName` claims. Should I look at your existing Keycloak integration code to verify the exact claim names, or do you already know they might be different (like `given_name`, `family_name`)?

**Answer:** I know that the claims are `given_name` and `family_name`.

**Follow-up 2:** Are there any existing features in your codebase that already:
- Embed related objects in responses (e.g., series with embedded devotionals)?
- Fetch and cache user profile data?
- Join multiple tables in repository queries?

If yes, please provide file paths or feature names so we can follow the same patterns.

**Answer:** I'm not sure.

**Follow-up 3:** You mentioned respecting privacy settings. Does the current user profile table already have privacy fields (like `profileVisibility`, `showEmail`, etc.), or do we need to add these as part of this feature?

**Answer:** No we don't need to add this. We should just update the `applyFieldVisibility` method to also filter for the user's personal data.

## Existing Code to Reference

**Similar Features Identified:**

- **User Profile System:** Complete profile system exists at `src/profiles/` with the following key files:
  - `src/profiles/service.ts` - Contains the `applyFieldVisibility` method for privacy controls
  - `src/profiles/pg-repository.ts` - Profile data access layer
  - `src/profiles/repository.ts` - Profile repository interface
  - `src/profiles/schemas.ts` - Zod schemas for validation
  - Specification: `agent-os/specs/2025-11-04-user-profile-system/`

- **Privacy Testing:** Existing tests show privacy patterns:
  - `src/tests/profiles/field-visibility.test.ts` - Field visibility testing patterns
  - `src/tests/profiles/church-membership-privacy.test.ts` - Privacy control testing

- **Backend Patterns to Follow:**
  - Repository pattern (all entities use dedicated repository classes)
  - Handler factory pattern with dependency injection
  - safeExecute utility for error handling
  - Request-scoped logging via `req.log`
  - Service layer should throw custom errors that extends AppError or its children

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements

**Core Functionality:**
- Embed lightweight user profile objects in entities that currently only reference user IDs
- Maintain backward compatibility by keeping existing ID fields (additive change)
- Sync user data from Keycloak (claims: `given_name`, `family_name`) into user profile table during profile creation
- Cache user profile data in Redis to prevent N+1 query problems
- Respect privacy settings using existing `applyFieldVisibility` method

**Entities to Enrich:**
1. **Daily Devotionals** - Add `author` object alongside existing `authorId`
2. **Prayers** - Add `author` and `responder` objects alongside existing IDs
3. **Notes** - Add `owner` object alongside existing `ownerId`
4. **Series** - Add `author` object alongside existing `authorId`

**User Fields to Embed:**
- `id` (string) - User's unique identifier
- `firstName` (string) - Mapped from Keycloak `given_name` claim
- `lastName` (string) - Mapped from Keycloak `family_name` claim
- `displayName` (string) - Formatted name for display
- `avatarUrl` (string | null) - User's profile picture URL
- `email` (string | null) - User's email (filtered by privacy settings)

**Data Synchronization:**
- Sync Keycloak user data (given_name, family_name, email, etc.) into user profile table when user creates their profile
- Update user profile table schema if needed to store Keycloak claims
- Backfill user info for existing entities via migration script

**Privacy Controls:**
- Extend `applyFieldVisibility` method to filter embedded user data
- Hide email field based on user privacy settings
- Hide user info entirely for anonymous prayers
- Respect existing profile visibility settings

**Caching Strategy:**
- Implement Redis caching layer for user profile data
- Cache key pattern: `user:profile:{userId}`
- TTL: 15 minutes (configurable)
- Cache invalidation on profile updates
- Batch fetch and cache multiple user profiles to avoid N+1 queries

### Reusability Opportunities

**Components to Reuse:**
- `applyFieldVisibility` method from `src/profiles/service.ts` - Extend for embedded user data privacy
- Profile repository pattern from `src/profiles/pg-repository.ts` - Reference for data access
- Profile schemas from `src/profiles/schemas.ts` - Reference for validation patterns
- Field visibility testing patterns from `src/tests/profiles/field-visibility.test.ts`

**Backend Patterns to Follow:**
- Repository pattern for data access
- Handler factory pattern for endpoint handlers
- `safeExecute` utility for error handling
- Structured logging via `req.log` for request-scoped operations
- Zod schemas for request/response validation

**Existing Infrastructure:**
- Redis cache layer already configured (see `src/cache/`)
- PostgreSQL database with repository pattern
- User profile table already exists

### Scope Boundaries

**In Scope:**
- Embed user profile objects in devotionals, prayers, notes, and series entities
- Sync Keycloak user claims into user profile table during profile creation
- Implement Redis caching for user profile data with cache invalidation
- Extend `applyFieldVisibility` to handle embedded user data privacy
- Backfill migration script for existing entities
- Maintain backward compatibility (additive API changes only)
- Update response schemas and validation
- Comprehensive test coverage (unit, integration, privacy)

**Out of Scope:**
- Real-time sync of Keycloak changes (only sync on profile creation)
- GraphQL implementation (REST API only)
- Embedding user info in other entities not mentioned (media, etc.)
- Complete redesign of user profile table structure
- API versioning (maintaining v1 with additive changes)
- New privacy settings UI (reuse existing privacy controls)
- Embedding deeply nested related objects (just one level: user info)

**Future Enhancements:**
- Automatic Keycloak sync on authentication (currently only on profile creation)
- Embedding user info in additional entities (media uploads, comments, etc.)
- More sophisticated caching strategies (cache warming, predictive loading)
- GraphQL endpoint for flexible field selection

### Technical Considerations

**Integration Points:**
- Keycloak JWT claims extraction (already implemented via JOSE)
- User profile service and repository (already exists)
- Redis cache layer (already configured)
- Devotionals, prayers, notes, series repositories (need modification)
- Response schemas and validation (need updates)

**Keycloak Integration:**
- JWT claims to map: `given_name` → `firstName`, `family_name` → `lastName`, `email` → `email`, `sub` → `id`
- Claims extracted from `req.user[1].payload` (existing pattern)
- Sync occurs during profile creation endpoint but delegated to the user profile service

**Database Considerations:**
- Verify user profile table has columns for: firstName, lastName, displayName, avatarUrl, email
- Add columns if missing as part of migration
- Backfill script needs to fetch user data and update existing entities
- Consider database performance impact of backfill (batch processing)

**Caching Strategy Details:**
- Use existing Redis client from `src/cache/`
- Implement cache-aside pattern (check cache first, fallback to DB)
- Batch profile fetching to populate cache efficiently
- Cache invalidation triggers: profile update, profile delete
- TTL configuration via environment variable

**Performance Goals:**
- Reduce API response time for list endpoints by eliminating client-side N+1 fetches
- Keep database query count low via Redis caching
- Aim for <50ms overhead per request for cache lookups

**Backward Compatibility:**
- Keep existing ID fields (`authorId`, `ownerId`, etc.) in responses
- Add new embedded objects (`author`, `owner`, etc.) as additional fields
- No breaking changes to API contracts
- Existing clients continue to work without modifications

**Similar Code Patterns:**
- Follow user profile repository pattern for consistency
- Use existing `applyFieldVisibility` pattern for privacy
- Follow existing test patterns from profile tests
- Use structured logging for debugging and observability
