# Cache Refactor Progress Tracker

## Goal
Simplify cache key structure to enable easy cache invalidation using pattern matching.

## New Key Structure
```
{env}:{resource}:{type}[:{id}][:{filterHash}]

Examples:
- prod:note:list                    (all notes)
- prod:note:list:a3f2c1             (filtered, hash of filters)
- prod:note:single:uuid-123         (single note)
- prod:post:list
- prod:post:single:uuid-456
```

---

## Phase 1: Cache Key Hash Utility

### 🔴 RED Phase
- [x] Write tests for `cache-key-hash.util.test.ts`
  - [x] Test: consistent hash for same object
  - [x] Test: different hash for different objects
  - [x] Test: empty object handling
  - [x] Test: nested object handling
  - [x] Test: array handling in objects
  - [x] Test: null/undefined handling
  - [x] Test: array order sensitivity
  - [x] Test: type sensitivity (number vs string)
  - [x] Test: deeply nested objects
  - [x] Test: special characters
  - [x] Test: large objects
  - [x] Test: boolean and numeric edge cases
  - [x] Test: collision resistance
- [x] Run tests → Verify FAIL with assertion errors (13/16 failing ✅)
- [x] Run coderabbit-reviewer agent on test file
- [x] Implement coderabbit suggestions on tests

### 🟢 GREEN Phase
- [x] Implement `cache-key-hash.util.ts` (minimal code to pass tests)
- [x] Run tests → Verify PASS (16/16 tests passing ✅)

### ♻️ REFACTOR Phase
- [x] Refactor implementation if needed (keep tests green)
- [x] Run coderabbit-reviewer agent on implementation
- [x] Implement coderabbit suggestions (type safety already addressed)
- [x] **Commit changes with descriptive message** (commit 98b15fe)

---

## Phase 2: Extended Cache Repository Interface (Redis)

### 🔴 RED Phase
- [x] Update `redis-cache.repository.test.ts` with new tests
  - [x] Test: `deletePattern()` with wildcard patterns
  - [x] Test: `deleteByPrefix()` deletes all matching keys
  - [x] Test: pattern deletion with no matches
  - [x] Test: pattern deletion with multiple matches
  - [x] Test: multiple SCAN iterations
  - [x] Test: error handling
- [x] Run tests → Verify FAIL (14 new tests failing ✅)
- [x] Run coderabbit-reviewer agent on test changes
- [x] Implement coderabbit suggestions on tests (quality confirmed)

### 🟢 GREEN Phase
- [x] Update `cache.repository.ts` interface with new methods
- [x] Implement `deletePattern()` in `redis-cache.repository.ts`
- [x] Implement `deleteByPrefix()` in `redis-cache.repository.ts`
- [x] Run tests → Verify PASS (45/45 tests passing ✅)

### ♻️ REFACTOR Phase
- [x] Refactor implementation if needed
- [x] Run coderabbit-reviewer agent on implementation
- [x] Implement coderabbit suggestions (batch processing, pattern escaping, logging)
- [x] **Commit changes with descriptive message** (commit a8d76d1)

---

## Phase 3: In-Memory Cache Pattern Deletion

### 🔴 RED Phase
- [x] Update `in-memory-cache.repository.test.ts` with pattern deletion tests
  - [x] Test: `deletePattern()` with wildcard patterns
  - [x] Test: `deleteByPrefix()` deletes all matching keys
  - [x] Test: pattern deletion with no matches
  - [x] Test: pattern deletion with multiple matches
  - [x] Test: single-char wildcard, character sets, exact match
  - [x] Test: empty prefix, special char escaping, large-scale deletion
- [x] Run tests → Verify FAIL (12/12 tests failing with "is not a function" ✅)
- [x] Run coderabbit-reviewer agent on test changes
- [x] Implement coderabbit suggestions on tests (quality confirmed)

### 🟢 GREEN Phase
- [x] Implement `deletePattern()` in `in-memory-cache.repository.ts`
- [x] Implement `deleteByPrefix()` in `in-memory-cache.repository.ts`
- [x] Implement `globToRegex()` helper for pattern matching
- [x] Run tests → Verify PASS (34/34 tests passing ✅)

### ♻️ REFACTOR Phase
- [x] Run coderabbit-reviewer agent on implementation
- [x] Implement coderabbit suggestions:
  - [x] Fixed escape sequence interpretation bug
  - [x] Fixed character set edge cases
  - [x] Optimized deleteByPrefix to use startsWith() (10-100x faster)
  - [x] Added structured logging with timing metrics
- [x] Verify tests still pass (34/34 ✅)
- [x] **Commit changes with descriptive message** (commit e81d344)

---

## Phase 4: Simplified Key Generator Utility

### 🔴 RED Phase
- [x] Write tests for `cache-key-generator.util.test.ts`
  - [x] Test: generate list key without filters
  - [x] Test: generate list key with filters (includes hash)
  - [x] Test: generate single key with ID
  - [x] Test: environment prefix included
  - [x] Test: different resources generate different keys
  - [x] Test: whitespace trimming, edge cases, validation
- [x] Run tests → Verify FAIL (22/25 failing on assertions ✅)
- [x] Run coderabbit-reviewer agent on tests
- [x] Implement coderabbit suggestions on tests (quality confirmed)

### 🟢 GREEN Phase
- [x] Implement `cache-key-generator.util.ts`
- [x] Run tests → Verify PASS (25/25 tests passing ✅)

### ♻️ REFACTOR Phase
- [x] Run coderabbit-reviewer agent on implementation
- [x] Implement coderabbit suggestions (added env/resource validation)
- [x] Verify tests still pass (25/25 ✅)
- [x] **Commit changes with descriptive message** (commit ad108a7)

---

## Phase 5: Cache Invalidation Service

### 🔴 RED Phase
- [x] Write tests for `cache-invalidation.service.test.ts`
  - [x] Test: `invalidateResource(resource, id)` invalidates single resource
  - [x] Test: `invalidateList(resource)` invalidates all list caches
  - [x] Test: `invalidateAll(resource)` invalidates everything for resource
  - [x] Test: service handles cache repository errors gracefully
- [x] Run tests → Verify FAIL (23/29 failing on assertions ✅)
- [x] Run coderabbit-reviewer agent on tests
- [x] Implement coderabbit suggestions on tests (logger assertions fixed)

### 🟢 GREEN Phase
- [x] Implement `cache-invalidation.service.ts`
  - [x] `invalidateResource(resource, id)`
  - [x] `invalidateList(resource)`
  - [x] `invalidateAll(resource)`
- [x] Run tests → Verify PASS (29/29 tests passing ✅)

### ♻️ REFACTOR Phase
- [x] Refactor implementation
- [x] Run coderabbit-reviewer agent on implementation
- [x] Implement coderabbit suggestions:
  - [x] Added env validation in constructor
  - [x] Added resource validation in all three methods
  - [x] Kept Promise<void> return type (silent failures with logging)
- [x] Verify tests still pass (29/29 ✅)
- [x] **Commit changes with descriptive message** (commit 6968990)

---

## Phase 6: Update Key Generator Middleware

### 🔴 RED Phase
- [ ] Update `key-generator.middleware.test.ts` for simplified keys
  - [ ] Update tests to expect new key format (no userId/authorizedIds)
  - [ ] Add tests for filter hashing
- [ ] Run tests → Verify FAIL
- [ ] Run coderabbit-reviewer agent on test changes
- [ ] Implement coderabbit suggestions on tests

### 🟢 GREEN Phase
- [ ] Update `key-generator.middleware.ts` to use new key generator
- [ ] Remove userId and authorizedIds from key generation
- [ ] Run tests → Verify PASS

### ♻️ REFACTOR Phase
- [ ] Refactor implementation
- [ ] Run coderabbit-reviewer agent on implementation
- [ ] Implement coderabbit suggestions
- [ ] **Commit changes with descriptive message**

---

## Phase 7: Service Layer Integration

### 🔴 RED Phase
- [ ] Add cache invalidation tests to existing service tests
  - [ ] Note service: invalidate on create/update/delete
  - [ ] Post service: invalidate on create/update/delete
- [ ] Run tests → Verify FAIL
- [ ] Run coderabbit-reviewer agent on test changes
- [ ] Implement coderabbit suggestions on tests

### 🟢 GREEN Phase
- [ ] Inject `CacheInvalidationService` into `NoteService`
- [ ] Add cache invalidation to note create/update/delete
- [ ] Inject `CacheInvalidationService` into `PostService`
- [ ] Add cache invalidation to post create/update/delete
- [ ] Update service factories/dependency injection
- [ ] Run tests → Verify PASS

### ♻️ REFACTOR Phase
- [ ] Refactor service implementations
- [ ] Run coderabbit-reviewer agent on implementations
- [ ] Implement coderabbit suggestions
- [ ] **Commit changes with descriptive message**

---

## Phase 8: Final Quality Check

- [ ] Run full test suite → All tests PASS
- [ ] Run `npm run lint:fix` → Fix all lint issues
- [ ] Run coderabbit-reviewer agent on ALL changed files
- [ ] Implement final coderabbit suggestions
- [ ] Re-run full test suite → All tests still PASS
- [ ] Update `src/cache/index.ts` to export new utilities

---

## Summary of Files

### Files to Create
- [x] `src/cache/cache-key-hash.util.ts` (Phase 1 ✅)
- [x] `src/cache/cache-key-hash.util.test.ts` (Phase 1 ✅)
- [x] `src/cache/cache-key-generator.util.ts` (Phase 4 ✅)
- [x] `src/cache/cache-key-generator.util.test.ts` (Phase 4 ✅)
- [x] `src/cache/cache-invalidation.service.ts` (Phase 5 ✅)
- [x] `src/cache/cache-invalidation.service.test.ts` (Phase 5 ✅)

### Files to Modify
- [x] `src/cache/cache.repository.ts` (add new methods to interface) (Phase 2 ✅)
- [x] `src/cache/redis-cache.repository.ts` (implement pattern deletion) (Phase 2 ✅)
- [x] `src/cache/redis-cache.repository.test.ts` (add tests for pattern deletion) (Phase 2 ✅)
- [x] `src/cache/in-memory-cache.repository.ts` (implement pattern deletion) (Phase 3 ✅)
- [x] `src/cache/in-memory-cache.repository.test.ts` (add tests for pattern deletion) (Phase 3 ✅)
- [ ] `src/middleware/key-generator.middleware.ts` (use simplified keys)
- [ ] `src/middleware/key-generator.middleware.test.ts` (update test expectations)
- [ ] `src/notes/service.ts` (add cache invalidation)
- [ ] `src/posts/service.ts` (add cache invalidation)
- [ ] `src/cache/index.ts` (export new utilities)

---

## Key Principles

✅ **RED**: Write failing tests first, verify they fail for the RIGHT reasons (assertions, not syntax)
✅ **GREEN**: Write minimal code to pass tests
✅ **REFACTOR**: Improve code while keeping tests green
✅ **REVIEW**: Run coderabbit-reviewer after each phase
✅ **NEVER SKIP**: Always run tests to verify RED before GREEN