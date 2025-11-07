# Task Breakdown: Extend User Info Embedding

## Overview
Total Tasks: 4 Task Groups
Estimated Effort: Medium (1 week)

## Task List

### Foundation Layer

#### Task Group 1: Church Info Infrastructure
**Dependencies:** None

- [x] 1.0 Complete church info infrastructure
  - [x] 1.1 Write 2-8 focused tests for church info utilities and service
    - Test `extractUniqueChurchIds` with entity arrays
    - Test `embedChurchInfo` merges church objects correctly
    - Test `ChurchInfoService.getBatchChurchInfo` with cache hit/miss
    - Test batch fetching from ChurchRepository
    - Test cache invalidation on church update/delete
    - Limit to 5-8 critical behaviors only
  - [x] 1.2 Create ChurchInfo type and schema
    - File: `src/church-info/types.ts`
    - Define `ChurchInfo` interface with fields: id, slug, name, description, logoUrl, byline
    - File: `src/church-info/schemas.ts`
    - Create `ChurchInfoSchema` Zod schema following `UserInfoSchema` pattern from `src/user-info/schemas.ts`
  - [x] 1.3 Create church embedding utilities
    - File: `src/church-info/embedding.util.ts`
    - Implement `extractUniqueChurchIds<T>(entities, extractor)` - mirror `extractUniqueUserIds` pattern
    - Implement `embedChurchInfo<T>(entities, churchIdExtractor, churchInfoMap, embedder)` - mirror `embedUserInfo` pattern
    - Follow exact pattern from `src/user-info/embedding.util.ts`
  - [x] 1.4 Create ChurchInfoService with caching
    - File: `src/church-info/service.ts`
    - Implement `getBatchChurchInfo(churchIds: string[]): Promise<Map<string, ChurchInfo>>`
    - Use ChurchRepository for database batch fetching
    - Implement cache-aside pattern with CacheRepository
    - Cache key pattern: `church:info:{churchId}`
    - TTL: 1 hour (configurable via `CHURCH_INFO_CACHE_TTL` env var)
    - Handle missing churches gracefully (return empty for missing IDs)
  - [x] 1.5 Add cache configuration
    - Add `CHURCH_INFO_CACHE_TTL` environment variable (default: 3600)
    - Update church update/delete handlers to invalidate `church:info:{churchId}` cache
  - [x] 1.6 Ensure church info infrastructure tests pass
    - Run ONLY the 5-8 tests written in 1.1
    - Verify cache-aside logic works correctly
    - Do NOT run entire test suite

**Acceptance Criteria:**
- The 5-8 tests written in 1.1 pass ✅
- ChurchInfo type and schema properly defined ✅
- Church embedding utilities work correctly ✅
- ChurchInfoService batch fetches and caches church data ✅
- Cache invalidation works on church updates/deletes ✅

### Entity Schema Updates

#### Task Group 2: Schema Extensions for Embedded Fields
**Dependencies:** Task Group 1

- [x] 2.0 Complete schema extensions
  - [x] 2.1 Write 2-8 focused tests for schema validation
    - Test ChurchMember schema validates with embedded user field
    - Test PrayerWallMembership type accepts user field
    - Test Post schema validates with embedded church field
    - Test backward compatibility (schemas work without embedded fields)
    - Limit to 4-6 schema validation tests only
  - [x] 2.2 Extend ChurchMember schema
    - File: `src/churches/schemas.ts`
    - Add `user: UserInfoSchema.optional()` to ChurchMember schema
    - Follow pattern from `src/posts/schemas.ts:30` (author field)
    - Maintain backward compatibility with existing `userId` field
  - [x] 2.3 Extend PrayerWallMembership type
    - File: `src/prayer-walls/types/prayer-wall.types.ts`
    - Add `user?: UserInfo` to PrayerWallMembership type (line 167-179)
    - Follow pattern from PrayerRequest type (line 123) which already has `author?: UserInfo`
    - Maintain backward compatibility with existing `user_id` field
  - [x] 2.4 Extend entity schemas with church field
    - Update `src/posts/schemas.ts`: Add `church: ChurchInfoSchema.optional()` to Post schema
    - Update `src/prayer-walls/types/prayer-wall.types.ts`: Add `church?: ChurchInfo` to PrayerWall type
    - Update `src/series/schemas.ts`: Add `church: ChurchInfoSchema.optional()` to Series schema (if file exists)
    - Update `src/notes/schemas.ts`: Add `church: ChurchInfoSchema.optional()` to Note schema (if file exists)
    - Maintain backward compatibility with existing `churchId`/`church_id` fields
  - [x] 2.5 Ensure schema extension tests pass
    - Run ONLY the 4-6 tests written in 2.1
    - Verify all schemas validate correctly
    - Do NOT run entire test suite

**Acceptance Criteria:**
- The 7 tests written in 2.1 pass ✅
- ChurchMember schema includes optional user field ✅
- PrayerWallMembership type includes optional user field ✅
- Post, PrayerWall, Series schemas include optional church field ✅ (Note skipped - no churchId)
- Backward compatibility maintained (existing ID fields still work) ✅

### Service Layer Integration

#### Task Group 3: Embed User/Church Info in Services
**Dependencies:** Task Groups 1, 2

- [ ] 3.0 Complete service layer embedding
  - [ ] 3.1 Write 2-8 focused tests for service embedding logic
    - Test church membership service embeds user info correctly
    - Test prayer wall membership service embeds user info correctly
    - Test posts service embeds church info (verify existing + new)
    - Test privacy filtering works for embedded user info
    - Test cache is utilized for batch fetching
    - Limit to 6-8 integration tests only
  - [ ] 3.2 Add user embedding to church membership service
    - File: `src/churches/membership-service.ts` or relevant endpoint
    - Modify list memberships endpoint to embed user info
    - Follow pattern from `src/posts/service.ts:134-159` (listPosts method)
    - Use `extractUniqueUserIds` → `UserInfoService.getBatchUserInfo` → `embedUserInfo`
    - Apply privacy filtering via `applyFieldVisibility` pattern
  - [ ] 3.3 Add user embedding to prayer wall membership service
    - File: `src/prayer-walls/services/prayer-wall.service.ts` or membership repository
    - Modify endpoints returning PrayerWallMembership arrays to embed user info
    - Follow same pattern as church membership (extract → fetch → embed)
    - Apply privacy settings for member visibility
    - Do NOT embed for `invited_by` and `banned_by` fields (out of scope)
  - [ ] 3.4 Add church embedding to posts service
    - File: `src/posts/service.ts`
    - Modify `listPosts` method (already has user embedding at lines 134-159)
    - Add church embedding after user embedding
    - Use `extractUniqueChurchIds` → `ChurchInfoService.getBatchChurchInfo` → `embedChurchInfo`
  - [ ] 3.5 Add church embedding to prayer walls service
    - File: `src/prayer-walls/services/prayer-wall.service.ts`
    - Modify methods returning PrayerWall arrays to embed church info
    - Use same church embedding pattern as posts service
  - [ ] 3.6 Add church embedding to series service
    - File: `src/series/service.ts`
    - Modify list methods to embed church info
    - Use same church embedding pattern
  - [ ] 3.7 Add church embedding to notes service
    - File: `src/notes/service.ts`
    - Modify list methods to embed church info
    - Use same church embedding pattern
  - [ ] 3.8 Ensure service embedding tests pass
    - Run ONLY the 6-8 tests written in 3.1
    - Verify embedded fields populate correctly
    - Verify privacy filtering works
    - Do NOT run entire test suite

**Acceptance Criteria:**
- The 6-8 tests written in 3.1 pass
- Church membership endpoints include embedded user objects
- Prayer wall membership endpoints include embedded user objects
- Posts, Prayer Walls, Series, Notes include embedded church objects
- Privacy settings correctly filter user email
- Caching utilized for batch operations

### Documentation & Testing

#### Task Group 4: OpenAPI Documentation and Test Coverage
**Dependencies:** Task Groups 1-3

- [ ] 4.0 Complete documentation and test coverage
  - [ ] 4.1 Review existing tests from Task Groups 1-3
    - Review 5-8 tests from infrastructure layer (Task 1.1)
    - Review 4-6 tests from schema layer (Task 2.1)
    - Review 6-8 tests from service layer (Task 3.1)
    - Total existing tests: approximately 15-22 tests
  - [ ] 4.2 Update OpenAPI schemas
    - File: `src/schemas/openapi.schemas.ts`
    - Document embedded `user` field in ChurchMember response schemas
    - Document embedded `user` field in PrayerWallMembership response schemas
    - Document embedded `church` field in Post, PrayerWall, Series, Note response schemas
    - Verify Posts' `author` field is properly documented (from requirements: ⚠️ may be missing)
    - Document optional nature of all embedded fields for backward compatibility
  - [ ] 4.3 Analyze test coverage gaps for THIS feature only
    - Identify critical workflows lacking coverage (e.g., end-to-end embedding flows)
    - Focus ONLY on embedding functionality, not entire application
    - Prioritize integration tests over unit tests
  - [ ] 4.4 Write up to 10 additional strategic tests maximum
    - Add maximum 10 new tests to fill critical embedding workflow gaps
    - Test end-to-end flows: fetch entities → verify embedded fields populated
    - Test privacy: verify email filtering, anonymous prayer handling
    - Test performance: verify batch fetching minimizes queries
    - Test cache: verify cache hit/miss scenarios
    - Do NOT write exhaustive coverage for all edge cases
  - [ ] 4.5 Run feature-specific tests only
    - Run ONLY tests related to embedding functionality (tests from 1.1, 2.1, 3.1, and 4.4)
    - Expected total: approximately 25-32 tests maximum
    - Verify all embedding workflows pass
    - Verify backward compatibility (existing ID fields still work)
    - Do NOT run entire application test suite

**Acceptance Criteria:**
- OpenAPI documentation accurately reflects all embedded fields
- Posts' `author` field is documented in OpenAPI
- All feature-specific tests pass (approximately 25-32 tests total)
- No more than 10 additional tests added in gap analysis
- Critical embedding workflows verified end-to-end
- Privacy filtering tested and working
- Cache performance verified
- Backward compatibility confirmed

## Execution Order

Recommended implementation sequence:
1. **Church Info Infrastructure** (Task Group 1) - Build foundation for church embedding
2. **Schema Extensions** (Task Group 2) - Add embedded field definitions to types
3. **Service Layer Integration** (Task Group 3) - Implement actual embedding in services
4. **Documentation & Testing** (Task Group 4) - Document OpenAPI and fill test gaps

## Notes

- **Posts already have user embedding** (verified at `src/posts/service.ts:134-159`) - only need to add church embedding
- **Follow existing patterns**: User embedding pattern in posts service is the reference implementation
- **Privacy is critical**: All user embedding must respect existing privacy controls via `applyFieldVisibility`
- **Backward compatibility**: All existing ID fields (`userId`, `churchId`, etc.) must remain functional
- **Cache performance**: Church info uses 1-hour TTL, targeting >80% cache hit rate
- **Test focus**: Write minimal focused tests during development (2-8 per group), fill critical gaps at end (max 10 additional)
