# Spec Requirements: Extend User Info Embedding

## Initial Description
Extend the usage of the User Info Embedding functionality to the church membership, prayer wall members and the posts entities. Also provide similar embedding for entities with a churchId.

## Requirements Discussion

### First Round Questions

**Q1:** Posts service already imports `embedUserInfo` utility (src/posts/service.ts:12). Should I verify if posts already have user embedding implemented, or are you looking for additional user fields to be embedded (like `updatedBy`, `publishedBy`, etc.)?
**Answer:** Please verify that. Also verify that the openapi schema has this reflected if it's already implemented.

**Verification Results:**
- ✅ Posts service DOES have user embedding implemented in `listPosts` method (src/posts/service.ts:134-159)
- ✅ Post schema includes `author: UserInfoSchema.optional()` field (src/posts/schemas.ts:30)
- ✅ Service uses `extractUniqueUserIds` and `embedUserInfo` utilities to embed author info
- ✅ UserInfoSchema is properly imported from '../user-info/schemas'
- ⚠️ OpenAPI schema search did not find explicit documentation of author field (may need to be added or verified)

**Q2:** For **church membership** user embedding, I assume you want the `ChurchMember` objects to include an embedded `user` object alongside the existing `userId` field. Should this apply to the church membership list endpoint (`/churches/:churchId/memberships`) and any other endpoints that return church member arrays?
**Answer:** Yes

**Q3:** For **prayer wall membership** user embedding, I assume you want `PrayerWallMembership` objects to include embedded user info for the member. The membership also has `invited_by` and `banned_by` fields - should we embed user info for those relationships too (e.g., `invitedByUser`, `bannedByUser` objects)?
**Answer:** Yes but we can ignore the invitedBy and bannedBy fields

**Q4:** For **church info embedding**, what church fields should be included in the embedded `ChurchInfo` type? I'm thinking: `id`, `slug`, `name`, `description`, `logoUrl`, `byline` - is that the right set, or should we include additional fields like `coverImageUrl`, `missionStatement`, or location data?
**Answer:** Yes

**Q5:** I assume church info embedding should follow the same Redis caching pattern as user info (15-minute TTL, cache-aside pattern). Is that correct, or should church data have a different cache duration since it changes less frequently?
**Answer:** Yes it should. Its TTL can be longer though

**Q6:** For church info privacy, I assume all churches that have `visibility: 'Public'` and `approvalStatus: 'Approved'` can have their basic info embedded without restrictions. Should we hide any church fields based on the requesting user's membership status?
**Answer:** No

**Q7:** The existing implementation has privacy controls that hide email based on user settings and hide user info entirely for anonymous prayers. Should church membership and prayer wall membership respect similar privacy rules, or is membership information always visible to other members of that church/wall?
**Answer:** Yes

**Q8:** Are there existing features in your codebase with similar patterns we should reference? For example, similar interface elements or service patterns for embedding related entity data, comparable caching strategies for church data, or existing church info retrieval logic we should leverage?
**Answer:** Yes

### Existing Code to Reference

**User Info Embedding Pattern (Already Implemented):**
- `src/user-info/embedding.util.ts` - Generic embedding utilities (`extractUniqueUserIds`, `embedUserInfo`)
- `src/user-info/types.ts` - UserInfo interface definition
- `src/user-info/schemas.ts` - UserInfoSchema for validation
- `src/posts/service.ts:134-159` - Example of user embedding in listPosts method
- `src/posts/schemas.ts:30` - Example of schema with embedded user (`author: UserInfoSchema.optional()`)
- `src/prayer-walls/types/prayer-wall.types.ts:123` - PrayerRequest type already includes `author?: UserInfo`

**Church Data Access:**
- `src/churches/schemas.ts` - Church schema with all field definitions
- `src/churches/repository.ts` - Church repository interface
- `src/churches/postgres-repository.ts` - Church data access implementation
- `src/churches/membership-service.ts` - Church membership service patterns

**Prayer Wall Membership:**
- `src/prayer-walls/types/prayer-wall.types.ts:167-179` - PrayerWallMembership type definition
- `src/prayer-walls/repositories/prayer-wall-membership.repository.ts` - Membership data access

**Caching Infrastructure:**
- `src/cache/cache.repository.ts` - CacheRepository interface
- `src/cache/redis-cache.repository.ts` - Redis implementation
- User info service already uses caching patterns to follow

**Privacy Controls:**
- `src/profiles/service.ts` - `applyFieldVisibility` method for privacy enforcement
- `src/prayer-walls/utils/apply-anonymity.util.ts` - Anonymity handling for prayers

### Visual Assets

**Files Provided:**
No visual files found.

**Visual Insights:**
No visual assets provided.

## Requirements Summary

### Functional Requirements

**1. Verify Posts User Embedding (Already Implemented):**
- ✅ Posts already embed author info via `author` field
- Verify OpenAPI documentation includes author field
- No additional implementation needed for posts

**2. Church Membership User Embedding:**
- Add `user` field to `ChurchMember` objects containing embedded UserInfo
- Keep existing `userId` field for backward compatibility
- Apply to all endpoints returning church member arrays:
  - `/churches/:churchId/memberships` - List church members
  - Any other endpoints returning ChurchMember objects
- Respect privacy settings via existing `applyFieldVisibility` patterns

**3. Prayer Wall Membership User Embedding:**
- Add `user` field to `PrayerWallMembership` objects containing embedded UserInfo
- Keep existing `user_id` field for backward compatibility
- Do NOT embed user info for `invited_by` and `banned_by` fields (out of scope)
- Apply to all endpoints returning prayer wall membership arrays
- Respect privacy settings for member visibility

**4. Church Info Embedding:**
- Create `ChurchInfo` type with fields: `id`, `slug`, `name`, `description`, `logoUrl`, `byline`
- Embed church info in entities that have `churchId` field:
  - Posts (add `church` field alongside `churchId`)
  - Prayer Walls (add `church` field alongside `church_id`)
  - Series (add `church` field alongside `churchId`)
  - Notes (add `church` field alongside `churchId`)
- Keep existing `churchId` fields for backward compatibility
- No privacy restrictions - all approved public churches can be embedded

**5. Caching Strategy:**
- **User Info Caching:**
  - Pattern: `user:profile:{userId}`
  - TTL: 15 minutes (existing)
  - Cache-aside pattern (check cache, fallback to DB, populate cache)

- **Church Info Caching:**
  - Pattern: `church:info:{churchId}`
  - TTL: 30-60 minutes (longer than user info, configurable)
  - Cache-aside pattern
  - Batch fetch support for multiple churches
  - Invalidate on church update/delete operations

**6. Privacy Controls:**
- User info embedding respects existing privacy settings
- Email field hidden based on user privacy preferences
- Anonymous prayers hide user identity completely
- Church info has no privacy restrictions (public approved churches)
- Membership visibility respects privacy rules

### Reusability Opportunities

**Existing Utilities to Leverage:**
- `extractUniqueUserIds<T>()` - Already implemented in src/user-info/embedding.util.ts
- `embedUserInfo<T>()` - Already implemented in src/user-info/embedding.util.ts
- Create similar `extractUniqueChurchIds<T>()` utility
- Create similar `embedChurchInfo<T>()` utility

**Existing Services to Reference:**
- User info service pattern (to be created for church info)
- Profile service's `applyFieldVisibility` for privacy
- Church repository for data access
- Cache repository for Redis operations

**Existing Schema Patterns:**
- UserInfoSchema pattern to create ChurchInfoSchema
- Post schema's `author: UserInfoSchema.optional()` pattern
- ChurchMember schema to extend with user embedding

### Scope Boundaries

**In Scope:**
- Verify and document posts user embedding (already done)
- Add user embedding to ChurchMember responses
- Add user embedding to PrayerWallMembership responses
- Create ChurchInfo type and embedding utilities
- Embed church info in Posts, Prayer Walls, Series, and Notes
- Implement church info caching with longer TTL
- Extend Zod schemas for all affected entities
- Update response types for backward compatibility
- Add tests for new embedding functionality

**Out of Scope:**
- Embedding user info for `invited_by` and `banned_by` fields in prayer wall memberships
- Real-time sync of church data changes
- GraphQL implementation
- Embedding church info in other entities not mentioned (media, comments, etc.)
- New privacy settings UI or fields
- Deeply nested embedding (only one level deep)
- Automatic cache warming strategies
- OpenAPI documentation updates (separate task if needed)

### Technical Considerations

**New Components Required:**

1. **ChurchInfo Type & Schema:**
   - Create `src/church-info/types.ts` with ChurchInfo interface
   - Create `src/church-info/schemas.ts` with ChurchInfoSchema
   - Fields: id, slug, name, description, logoUrl, byline

2. **Church Info Service:**
   - Create `src/church-info/service.ts`
   - Implement `getBatchChurchInfo(churchIds: string[]): Promise<Map<string, ChurchInfo>>`
   - Use ChurchRepository for database access
   - Use CacheRepository for Redis operations
   - Batch fetch multiple churches efficiently

3. **Church Embedding Utilities:**
   - Create `src/church-info/embedding.util.ts`
   - Implement `extractUniqueChurchIds<T>(entities, extractor)`
   - Implement `embedChurchInfo<T>(entities, churchIdExtractor, churchInfoMap, embedder)`

4. **Schema Updates:**
   - Extend `ChurchMember` schema to include `user: UserInfoSchema.optional()`
   - Extend `PrayerWallMembership` type to include `user?: UserInfo`
   - Extend `Post` schema to include `church: ChurchInfoSchema.optional()`
   - Extend `PrayerWall` type to include `church?: ChurchInfo`
   - Extend `Series` schema to include `church: ChurchInfoSchema.optional()`
   - Extend `Note` schema to include `church: ChurchInfoSchema.optional()`

5. **Service Modifications:**
   - Modify church membership service/endpoints to embed user info
   - Modify prayer wall membership service/endpoints to embed user info
   - Modify posts service to embed church info (already has user embedding)
   - Modify prayer walls service to embed church info
   - Modify series service to embed both user and church info
   - Modify notes service to embed both user and church info

6. **Cache Configuration:**
   - Add `CHURCH_INFO_CACHE_TTL` environment variable (default: 3600 seconds / 1 hour)
   - Implement cache invalidation on church update/delete

**Integration Points:**
- User info service (if exists, or create similar pattern for church info)
- Church repository for data access
- Cache repository for Redis operations
- Profile service for privacy enforcement patterns

**Performance Targets:**
- Church info cache hit rate >80% (higher than user info due to longer TTL)
- Response time overhead <50ms per request for embeddings
- Batch fetch to minimize database queries (<5 queries per list endpoint)

## Success Criteria
- Posts user embedding verified and documented
- Church membership responses include embedded user objects
- Prayer wall membership responses include embedded user objects
- Posts, Prayer Walls, Series, and Notes include embedded church objects
- Backward compatibility maintained (existing ID fields preserved)
- Privacy settings correctly filter embedded user data
- Church info caching works with longer TTL (1 hour default)
- Cache hit rate for church info >80%
- All existing tests continue to pass
- New tests verify embedding functionality
- Response time overhead <50ms per request
