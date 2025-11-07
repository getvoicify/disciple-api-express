# Specification: Extend User Info Embedding

## Goal
Extend the existing user info embedding pattern to church memberships and prayer wall memberships, and create a similar church info embedding system for entities with churchId references, eliminating N+1 API calls across the platform.

## User Stories
- As an API consumer, I want church membership responses to include user details so I can display member profiles without separate user fetch calls
- As a mobile app developer, I want prayer wall membership responses to include user info so I can render member lists efficiently
- As a frontend developer, I want entities (posts, prayer walls, series, notes) to include church details so I can display church context without additional API requests
- As an API consumer, I want consistent embedding patterns across all entity types for predictable data structures

## Core Requirements

### Church Membership User Embedding
- Church membership objects include embedded `user` field with UserInfo data alongside existing `userId` field
- Apply to `/churches/:churchId/memberships` endpoint and all other endpoints returning ChurchMember arrays
- Respect user privacy settings via existing `applyFieldVisibility` patterns
- Maintain backward compatibility with existing `userId` field

### Prayer Wall Membership User Embedding
- Prayer wall membership objects include embedded `user` field with UserInfo data alongside existing `user_id` field
- Apply to all endpoints returning PrayerWallMembership arrays
- Respect privacy settings for member visibility
- Do NOT embed user info for `invited_by` and `banned_by` fields (out of scope)

### Church Info Embedding
- Create `ChurchInfo` type with essential fields: `id`, `slug`, `name`, `description`, `logoUrl`, `byline`
- Embed church info in entities with `churchId` references:
  - Posts: add `church` field alongside `churchId`
  - Prayer Walls: add `church` field alongside `church_id`
  - Series: add `church` field alongside `churchId`
  - Notes: add `church` field alongside `churchId`
- No privacy restrictions on church info (all approved public churches can be embedded)
- Maintain backward compatibility with existing `churchId` fields

### Caching Strategy
- **User Info Caching:** Continue using existing 15-minute TTL with `user:profile:{userId}` key pattern
- **Church Info Caching:**
  - New pattern: `church:info:{churchId}`
  - TTL: 1 hour (configurable via `CHURCH_INFO_CACHE_TTL` environment variable)
  - Cache-aside pattern (check cache, fallback to DB, populate cache)
  - Batch fetch support for multiple churches
  - Invalidate on church update/delete operations

### Privacy Controls
- User info embedding respects existing privacy settings (email visibility, anonymous prayers)
- Church info has no privacy restrictions
- Membership visibility respects existing privacy rules

### OpenAPI Documentation
- Update OpenAPI schemas to document embedded `user` and `church` fields in all affected response types
- Ensure `author` field in Post schema is properly documented in OpenAPI
- Document optional nature of embedded fields for backward compatibility

## Visual Design
No visual mockups provided - backend API changes only.

## Reusable Components

### Existing Code to Leverage

**User Info Embedding Pattern (Already Implemented):**
- `src/user-info/embedding.util.ts` - Generic utilities `extractUniqueUserIds` and `embedUserInfo` to reuse for church embedding
- `src/user-info/types.ts` - UserInfo interface pattern to model ChurchInfo type after
- `src/user-info/schemas.ts` - UserInfoSchema pattern for creating ChurchInfoSchema
- `src/posts/service.ts:134-159` - Working example of user embedding in `listPosts` method to follow
- `src/posts/schemas.ts:30` - Schema pattern with `author: UserInfoSchema.optional()` to replicate

**Data Access & Infrastructure:**
- `src/churches/repository.ts` and `src/churches/postgres-repository.ts` - Church data access for batch fetching
- `src/cache/cache.repository.ts` and `src/cache/redis-cache.repository.ts` - Caching infrastructure to use
- `src/profiles/service.ts` - `applyFieldVisibility` method pattern for privacy enforcement
- `src/prayer-walls/utils/apply-anonymity.util.ts` - Anonymity handling pattern for prayers

**Type Definitions:**
- `src/churches/schemas.ts` - Full Church schema with all field definitions
- `src/prayer-walls/types/prayer-wall.types.ts:167-179` - PrayerWallMembership type to extend
- `src/prayer-walls/types/prayer-wall.types.ts:123` - PrayerRequest already includes `author?: UserInfo` pattern

**OpenAPI Schema Patterns:**
- `src/schemas/openapi.schemas.ts` - Existing OpenAPI schema definitions to extend

### New Components Required

**ChurchInfo Type & Schema** (`src/church-info/types.ts`, `src/church-info/schemas.ts`)
- Define ChurchInfo interface with subset of Church fields (id, slug, name, description, logoUrl, byline)
- Create ChurchInfoSchema Zod schema for validation
- Required because we need a lightweight church representation without full Church entity complexity

**Church Info Service** (`src/church-info/service.ts`)
- Implement `getBatchChurchInfo(churchIds: string[]): Promise<Map<string, ChurchInfo>>`
- Batch fetch multiple churches from database using ChurchRepository
- Implement cache-aside logic with Redis via CacheRepository
- Handle missing churches gracefully
- Required because no existing service provides batch church info fetching with caching

**Church Embedding Utilities** (`src/church-info/embedding.util.ts`)
- Implement `extractUniqueChurchIds<T>(entities, extractor)` - extract church IDs from entity arrays
- Implement `embedChurchInfo<T>(entities, churchIdExtractor, churchInfoMap, embedder)` - merge church objects into entities
- Required to mirror user embedding utility pattern for consistent API

**Schema Updates**
- Extend `ChurchMember` schema with `user: UserInfoSchema.optional()`
- Extend `PrayerWallMembership` type with `user?: UserInfo`
- Extend `Post`, `PrayerWall`, `Series`, `Note` schemas with `church: ChurchInfoSchema.optional()`
- Required to maintain type safety and validation for new embedded fields

**Service Modifications**
- Church membership service/endpoints: embed user info in list responses
- Prayer wall membership service/endpoints: embed user info in membership arrays
- Posts, Prayer Walls, Series, Notes services: embed church info using new utilities
- Required to actually populate embedded fields in API responses

**Cache Configuration**
- Add `CHURCH_INFO_CACHE_TTL` environment variable (default: 3600 seconds)
- Extend church update/delete handlers to invalidate `church:info:{churchId}` cache keys
- Required for cache management and performance tuning

**OpenAPI Schema Updates**
- Add embedded field definitions to affected response schemas in `src/schemas/openapi.schemas.ts`
- Document ChurchInfo and UserInfo embedded objects
- Required for complete API documentation

## Technical Approach

### User Embedding for Memberships
- Follow exact pattern from posts service: extract unique user IDs → batch fetch from UserInfoService → embed using utility
- Apply to church membership list endpoint and prayer wall membership endpoints
- Leverage existing privacy controls via `applyFieldVisibility`

### Church Embedding for Entities
- Create parallel structure to user info embedding: ChurchInfo type, service, utilities
- Implement batch fetching from ChurchRepository with cache-aside pattern
- Use longer cache TTL (1 hour vs 15 minutes) since church data changes less frequently
- Modify entity services (posts, prayer walls, series, notes) to call church embedding utilities after fetching entities

### Performance Optimization
- Batch fetch all user/church IDs in single query to minimize database round-trips
- Cache-aside pattern ensures frequently accessed data served from Redis
- Target <50ms overhead per request for embedding operations
- Church cache hit rate target >80% due to longer TTL

### Backward Compatibility
- Keep all existing ID fields (`userId`, `churchId`, `church_id`, etc.)
- Add embedded objects as optional fields (`user?`, `church?`)
- No breaking changes to existing API contracts

## Out of Scope
- Embedding user info for `invited_by` and `banned_by` fields in prayer wall memberships
- Real-time synchronization of church data changes
- GraphQL implementation
- Embedding church info in other entities not mentioned (media uploads, comments, attachments, etc.)
- New privacy settings UI or additional privacy fields
- Deeply nested embedding beyond one level (no embedding user info inside embedded church objects)
- Automatic cache warming or predictive loading strategies

## Success Criteria
- Church membership responses include embedded user objects with privacy-filtered fields
- Prayer wall membership responses include embedded user objects
- Posts, Prayer Walls, Series, and Notes responses include embedded church objects
- OpenAPI documentation accurately reflects all embedded fields in response schemas
- Backward compatibility maintained: all existing ID fields preserved and functional
- Privacy settings correctly filter user email and respect anonymous prayer settings
- Church info cache operates with 1-hour TTL and >80% hit rate
- Response time overhead for embedding <50ms per request
- Database query count remains low (<5 queries per list endpoint via caching)
- All existing tests continue to pass without modification
- New integration tests verify embedding functionality and privacy enforcement
