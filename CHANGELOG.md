## [2.5.0](https://github.com/getvoicify/disciple-api-express/compare/v2.4.2...v2.5.0) (2025-11-04)


### ✨ Features

* keycloak sync queue ([#35](https://github.com/getvoicify/disciple-api-express/issues/35)) ([eb9c866](https://github.com/getvoicify/disciple-api-express/commit/eb9c866ce4bbb8556c571f482822d0545740161d))

## [2.4.2](https://github.com/getvoicify/disciple-api-express/compare/v2.4.1...v2.4.2) (2025-11-03)


### 🐛 Bug Fixes

* create church sync ([#34](https://github.com/getvoicify/disciple-api-express/issues/34)) ([000e2fc](https://github.com/getvoicify/disciple-api-express/commit/000e2fc2ebc4516cbe039c8a01f28eecfe282774))

## [2.4.1](https://github.com/getvoicify/disciple-api-express/compare/v2.4.0...v2.4.1) (2025-11-01)


### 🐛 Bug Fixes

* refactor worker handler ([#33](https://github.com/getvoicify/disciple-api-express/issues/33)) ([9230f6f](https://github.com/getvoicify/disciple-api-express/commit/9230f6f4c20b28e9b1b82c21f5046b76fddc0461))

## [2.4.0](https://github.com/getvoicify/disciple-api-express/compare/v2.3.0...v2.4.0) (2025-10-31)


### ✨ Features

* church claim extractor ([#32](https://github.com/getvoicify/disciple-api-express/issues/32)) ([5da83d7](https://github.com/getvoicify/disciple-api-express/commit/5da83d7a6c25246d8bf562504301e87b3d9f7dba))

## [2.3.0](https://github.com/getvoicify/disciple-api-express/compare/v2.2.0...v2.3.0) (2025-10-29)


### ✨ Features

* implement prayer wall ([#31](https://github.com/getvoicify/disciple-api-express/issues/31)) ([210018a](https://github.com/getvoicify/disciple-api-express/commit/210018a529736e00b8a0d46b5f69218bd7985dce))

## [2.2.0](https://github.com/getvoicify/disciple-api-express/compare/v2.1.0...v2.2.0) (2025-10-28)


### ✨ Features

* **k8s:** update encrypted secrets in `sealedsecret.yaml` ([#30](https://github.com/getvoicify/disciple-api-express/issues/30)) ([a809152](https://github.com/getvoicify/disciple-api-express/commit/a80915237dacf063e167ba36dd2c57aca8dbaad4))

## [2.1.0](https://github.com/getvoicify/disciple-api-express/compare/v2.0.1...v2.1.0) (2025-10-24)


### ✨ Features

* reinstall agent os ([#28](https://github.com/getvoicify/disciple-api-express/issues/28)) ([1caa4b2](https://github.com/getvoicify/disciple-api-express/commit/1caa4b296833d7c3599c55a42bd0dde3909b6d47))

## [2.0.1](https://github.com/getvoicify/disciple-api-express/compare/v2.0.0...v2.0.1) (2025-10-24)


### 🐛 Bug Fixes

* remove resource guard for post list ([#27](https://github.com/getvoicify/disciple-api-express/issues/27)) ([a4fc3f3](https://github.com/getvoicify/disciple-api-express/commit/a4fc3f38200110abdaf7c280d6f86ea46fe81b8e))

## [2.0.0](https://github.com/getvoicify/disciple-api-express/compare/v1.24.0...v2.0.0) (2025-10-15)


### ⚠ BREAKING CHANGES

* Cache key format has changed from complex user-based keys
to simplified resource-based keys.

Old format:
- List: {env}:postslist:user-123:456:status=active
- Single: {env}:post:user-456:789

New format:
- List without filters: {env}:post:list
- List with filters: {env}:post:list:{filterHash}
- Single: {env}:post:single:789

Benefits:
- Eliminates userId and authorizedIds from cache keys
- Uses hash for filters instead of concatenating them
- Enables pattern-based cache invalidation
- Simpler and more maintainable
- Consistent with new cache utilities

Implementation:
- Uses generateCacheKey utility from cache-key-generator.util
- Uses hashFilters for filter hashing
- Removes complex buildListKey/buildSingleKey functions
- Graceful handling of empty/undefined IDs
- Comprehensive test coverage (32 tests)

Tests updated to verify:
- New key format for lists and single resources
- Filter hashing behavior
- User context no longer affects cache keys
- IDs array no longer affects cache keys
- Environment prefixing
- Resource name handling
- Edge cases and integration scenarios

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

* docs: update progress tracker for Phase 6 completion

* feat(cache): integrate cache invalidation into PostService

Implements Phase 7 of cache refactoring plan - service layer integration.

Changes:
- Updated PostServiceImpl to accept CacheInvalidationService dependency
- Added cache invalidation calls after all mutation operations:
  - createPost: invalidates list caches
  - updatePost: invalidates resource + list caches
  - deletePost: invalidates resource + list caches
  - publishPost: invalidates resource + list caches
  - unpublishPost: invalidates resource + list caches
- Updated dependency injection in index.ts to create and pass
  CacheInvalidationService instance
- Added comprehensive test coverage for all cache invalidation calls

Technical details:
- Cache invalidation occurs AFTER database operations succeed
- Errors propagate to error handler middleware for proper logging
- All 727 tests passing including 20 post service tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

* feat(cache): integrate cache invalidation into NoteService

Following TDD methodology (RED-GREEN-REFACTOR):

RED Phase:
- Created comprehensive test suite for NoteService with cache invalidation expectations
- Tests verified failing correctly (3 failures on cache invalidation assertions)

GREEN Phase:
- Updated NoteServiceImpl constructor to accept CacheInvalidationService
- Added cache invalidation to createNote (invalidateList)
- Added cache invalidation to updateNote (invalidateResource + invalidateList)
- Added cache invalidation to deleteNote (invalidateResource + invalidateList)
- Updated dependency injection in src/index.ts
- All 736 tests passing

REFACTOR Phase:
- Reviewed with coderabbit-reviewer
- Added explanatory comment for filter transformation test
- Cache error handling already implemented in CacheInvalidationService

Changes:
- src/notes/service.ts: Added CacheInvalidationService dependency and cache invalidation calls
- src/tests/notes/note-service.test.ts: Created test suite with 9 tests
- src/index.ts: Updated NoteService instantiation to inject CacheInvalidationService

Phase 7: Service Layer Integration (NoteService portion) complete.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

* chore: apply lint fixes and update progress documentation

Changes:
- src/cache/cache-invalidation.service.ts: added readonly modifiers, fixed newline
- src/cache/redis-cache.repository.ts: changed batch from let to const
- src/cache/index.ts: organized exports with comments (already done in Phase 8)
- src/middleware/key-generator.middleware.ts: removed unused error variable
- CACHE_REFACTOR_PROGRESS.md: documented completed Phase 7 work

All 736 tests passing ✅

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

* fix(config): exclude scripts directory from TypeScript and ESLint

Issue: CI/CD builds were failing with TS6059 error because scripts/stress-test.ts
was not under rootDir but was being picked up by TypeScript compilation.

Changes:
- tsconfig.json: Added "scripts" to exclude array
- eslint.config.mjs: Added "scripts/**" to ignores array

This fixes the build error while keeping the stress test script functional.
TypeScript and ESLint now properly ignore the scripts directory.

Verified:
- ✅ TypeScript compilation passes (npx tsc --noEmit)
- ✅ Build succeeds (npm run build)
- ✅ ESLint passes with 0 errors (74 pre-existing warnings)
- ✅ All 736 tests passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

### ✨ Features

* improve cache management ([#26](https://github.com/getvoicify/disciple-api-express/issues/26)) ([74e587d](https://github.com/getvoicify/disciple-api-express/commit/74e587d156a67a795878f1c0a27dea98d4c3e987))
* **scripts:** add stress test script for daily devotionals API ([97ddb8a](https://github.com/getvoicify/disciple-api-express/commit/97ddb8ae3908862d36b7b104ec2825270dadeb42))

## [1.24.0](https://github.com/getvoicify/disciple-api-express/compare/v1.23.0...v1.24.0) (2025-10-14)


### ✨ Features

* **k8s:** add pod anti-affinity rules for `disciple-api` deployment ([735d225](https://github.com/getvoicify/disciple-api-express/commit/735d2252496249fea2456279b66bbe91d2d4f9ad))

## [1.23.0](https://github.com/getvoicify/disciple-api-express/compare/v1.22.0...v1.23.0) (2025-10-14)


### ✨ Features

* **logging:** implement structured logging with Pino and comprehensi… ([#25](https://github.com/getvoicify/disciple-api-express/issues/25)) ([f41b18e](https://github.com/getvoicify/disciple-api-express/commit/f41b18ef163acc1fc573243fcefc25a30cab5d03))

## [1.22.0](https://github.com/getvoicify/disciple-api-express/compare/v1.21.1...v1.22.0) (2025-10-13)


### ✨ Features

* **eslint:** add ESLint config and integrate TypeScript rules ([#24](https://github.com/getvoicify/disciple-api-express/issues/24)) ([a952241](https://github.com/getvoicify/disciple-api-express/commit/a952241b3a8b4da3b1b64db79d55c2966425617b))

## [1.21.1](https://github.com/getvoicify/disciple-api-express/compare/v1.21.0...v1.21.1) (2025-10-07)


### 🐛 Bug Fixes

* **posts:** overhaul routes with enhanced validation, error handling and middleware ([#23](https://github.com/getvoicify/disciple-api-express/issues/23)) ([2c3d272](https://github.com/getvoicify/disciple-api-express/commit/2c3d2729e6f7d640bd9d7b997ab79af025b18fb6))

## [1.21.0](https://github.com/getvoicify/disciple-api-express/compare/v1.20.0...v1.21.0) (2025-10-06)


### ✨ Features

* **gallery:** add support for church media galleries with tests and … ([#22](https://github.com/getvoicify/disciple-api-express/issues/22)) ([e175154](https://github.com/getvoicify/disciple-api-express/commit/e175154efe5223ee8af448bec8a6fa83645ecb37))

## [1.20.0](https://github.com/getvoicify/disciple-api-express/compare/v1.19.0...v1.20.0) (2025-10-03)


### ✨ Features

* devotionals implementation ([#21](https://github.com/getvoicify/disciple-api-express/issues/21)) ([d4a740a](https://github.com/getvoicify/disciple-api-express/commit/d4a740a0294f2e95f9cec9acc86f8a7dd0d4f2eb))

## [1.19.0](https://github.com/getvoicify/disciple-api-express/compare/v1.18.0...v1.19.0) (2025-10-01)


### ✨ Features

* church posts ([#20](https://github.com/getvoicify/disciple-api-express/issues/20)) ([dd8a137](https://github.com/getvoicify/disciple-api-express/commit/dd8a13787c922f10448c786142600113a197cc5f))

## [1.18.0](https://github.com/getvoicify/disciple-api-express/compare/v1.17.0...v1.18.0) (2025-09-29)


### ✨ Features

* redis implementation ([#19](https://github.com/getvoicify/disciple-api-express/issues/19)) ([cab0131](https://github.com/getvoicify/disciple-api-express/commit/cab013160f23e9e595964cb3a8454217b7c7c46b))


### 🔧 Chores

* **tsconfig:** add test-specific configuration file for Vitest ([#17](https://github.com/getvoicify/disciple-api-express/issues/17)) ([c76406e](https://github.com/getvoicify/disciple-api-express/commit/c76406e5e477436fe445d5038130ae5213a84877))

## [1.17.0](https://github.com/getvoicify/disciple-api-express/compare/v1.16.1...v1.17.0) (2025-09-27)


### ✨ Features

* openapi docs endpoints ([#16](https://github.com/getvoicify/disciple-api-express/issues/16)) ([8c1ae4a](https://github.com/getvoicify/disciple-api-express/commit/8c1ae4ac5581effb2ffcfdb6fd873adafd5b3cea))

## [1.16.1](https://github.com/getvoicify/disciple-api-express/compare/v1.16.0...v1.16.1) (2025-09-27)


### ♻️ Code Refactoring

* **tests:** remove authentication for media proxy endpoint tests ([#15](https://github.com/getvoicify/disciple-api-express/issues/15)) ([934d723](https://github.com/getvoicify/disciple-api-express/commit/934d7231730875d2d1e81731af699f0999c54625))

## [1.16.0](https://github.com/getvoicify/disciple-api-express/compare/v1.15.0...v1.16.0) (2025-09-25)


### ✨ Features

* media integration ([#14](https://github.com/getvoicify/disciple-api-express/issues/14)) ([14e9c68](https://github.com/getvoicify/disciple-api-express/commit/14e9c68f60b00612edf8c1f8dbdc7e03c93ff172))

## [1.15.0](https://github.com/getvoicify/disciple-api-express/compare/v1.14.0...v1.15.0) (2025-09-24)


### ✨ Features

* keycloak auth sync ([#13](https://github.com/getvoicify/disciple-api-express/issues/13)) ([9f50927](https://github.com/getvoicify/disciple-api-express/commit/9f509274d98a3922e61659b8c6c39fd020f32c2e))

## [1.14.0](https://github.com/getvoicify/disciple-api-express/compare/v1.13.0...v1.14.0) (2025-09-23)


### ✨ Features

* remove worker ([#12](https://github.com/getvoicify/disciple-api-express/issues/12)) ([d01f911](https://github.com/getvoicify/disciple-api-express/commit/d01f91137078782595c79d53f2ef02f5b1e3199b))

## [1.13.0](https://github.com/getvoicify/disciple-api-express/compare/v1.12.0...v1.13.0) (2025-09-23)


### ✨ Features

* **k8s:** extract worker container into separate deployment ([#11](https://github.com/getvoicify/disciple-api-express/issues/11)) ([8efa930](https://github.com/getvoicify/disciple-api-express/commit/8efa9308aae189035de9d84b2608c454b53a5181))

## [1.12.0](https://github.com/getvoicify/disciple-api-express/compare/v1.11.0...v1.12.0) (2025-09-23)


### ✨ Features

* **k8s:** update encrypted secrets in `sealedsecret.yaml` and add `KEYCLOAK_CLIENT_SECRET` ([5f060f9](https://github.com/getvoicify/disciple-api-express/commit/5f060f9ba824762e70d28473a12573c1ff3eb06a))

## [1.11.0](https://github.com/getvoicify/disciple-api-express/compare/v1.10.0...v1.11.0) (2025-09-23)


### ✨ Features

* **k8s:** add `KEYCLOAK_CLIENT_ID` to ConfigMap in base manifest ([db6c9b3](https://github.com/getvoicify/disciple-api-express/commit/db6c9b3b326cafd04c2abed5a09dd6f242f52fba))

## [1.10.0](https://github.com/getvoicify/disciple-api-express/compare/v1.9.0...v1.10.0) (2025-09-23)


### ✨ Features

* outbox pattern ([#10](https://github.com/getvoicify/disciple-api-express/issues/10)) ([60be277](https://github.com/getvoicify/disciple-api-express/commit/60be2776f0800c0d5c711cd8ca48d8a496e6c5fe))

## [1.9.0](https://github.com/getvoicify/disciple-api-express/compare/v1.8.0...v1.9.0) (2025-09-22)


### ✨ Features

* **users:** add `getUserMemberships` endpoint and API route ([#9](https://github.com/getvoicify/disciple-api-express/issues/9)) ([efc1cf6](https://github.com/getvoicify/disciple-api-express/commit/efc1cf692f872f698f11a6ae1f15ecfa9defe97b))

## [1.8.0](https://github.com/getvoicify/disciple-api-express/compare/v1.7.2...v1.8.0) (2025-09-20)


### ✨ Features

* add unit tests framework ([#7](https://github.com/getvoicify/disciple-api-express/issues/7)) ([6508e41](https://github.com/getvoicify/disciple-api-express/commit/6508e413d4f9968de8fd067e8d4a5194c30e6c85))


### 🔧 Chores

* **argocd:** update secret reference for preview environment in `applicationset.yaml` ([f955ffe](https://github.com/getvoicify/disciple-api-express/commit/f955ffe5a779e5f8fcf86142413885a64c315084))

## [1.7.2](https://github.com/getvoicify/disciple-api-express/compare/v1.7.1...v1.7.2) (2025-09-20)


### 🐛 Bug Fixes

* **ci:** remove 'v' prefix from production image tag in deploy workflow ([934910b](https://github.com/getvoicify/disciple-api-express/commit/934910b7e9285742645c98d95ab03288507ea68f))

## [1.7.1](https://github.com/getvoicify/disciple-api-express/compare/v1.7.0...v1.7.1) (2025-09-20)


### ♻️ Code Refactoring

* **ci:** replace release comment with deployment logs in workflow ([d85d9b5](https://github.com/getvoicify/disciple-api-express/commit/d85d9b5332b3d5d988f16cedd2a7defad1a60925))

## [1.7.0](https://github.com/getvoicify/disciple-api-express/compare/v1.6.0...v1.7.0) (2025-09-20)


### ✨ Features

* church management ([#6](https://github.com/getvoicify/disciple-api-express/issues/6)) ([495add2](https://github.com/getvoicify/disciple-api-express/commit/495add20be88f85ce0d2503ed2d3d100b984b5e3))

## [1.6.0](https://github.com/getvoicify/disciple-api-express/compare/v1.5.0...v1.6.0) (2025-09-18)


### ✨ Features

* **argocd:** add bootstrap application and kustomization for disciple-api ([7d34179](https://github.com/getvoicify/disciple-api-express/commit/7d34179f54ceffc70118929b06e7c110d5c23d51))

## [1.5.0](https://github.com/getvoicify/disciple-api-express/compare/v1.4.0...v1.5.0) (2025-09-18)


### ✨ Features

* **config:** add environment-specific `apis` paths in Swagger config and enable `removeComments` in tsconfig ([#5](https://github.com/getvoicify/disciple-api-express/issues/5)) ([54f5433](https://github.com/getvoicify/disciple-api-express/commit/54f54330afb5f521ce0a2d693bff278bc55fcff1))

## [1.4.0](https://github.com/getvoicify/disciple-api-express/compare/v1.3.1...v1.4.0) (2025-09-18)


### ✨ Features

* **k8s:** add Ingress resource and environment-specific patches for `disciple-api` ([4ca7c06](https://github.com/getvoicify/disciple-api-express/commit/4ca7c0665fdb86be6b74c52ec07f8b481e9ecf24))

## [1.3.1](https://github.com/getvoicify/disciple-api-express/compare/v1.3.0...v1.3.1) (2025-09-18)


### ♻️ Code Refactoring

* **ci:** consolidate deploy logic and streamline workflows ([6194feb](https://github.com/getvoicify/disciple-api-express/commit/6194feb8fb7e7a00c0928d8a77f4901fa077faf9))

## [1.3.0](https://github.com/getvoicify/disciple-api-express/compare/v1.2.1...v1.3.0) (2025-09-18)


### ✨ Features

* **ci:** add GitHub prerelease plugin for semantic-release ([1cbf41a](https://github.com/getvoicify/disciple-api-express/commit/1cbf41a072e3df94c7049be30e2e06e274e05075))


### ♻️ Code Refactoring

* **ci:** migrate environment tags from `values.yaml` to `applicationset.yaml` ([9879912](https://github.com/getvoicify/disciple-api-express/commit/98799126acb9694df61680f7e06b3198b315881f))


### 🔧 Chores

* **tsconfig:** exclude `semantic-release-github-prerelease.js` from compilation ([d7ad1d9](https://github.com/getvoicify/disciple-api-express/commit/d7ad1d91bb88efab74387ee2ea00516cc7a08729))

## [1.2.1](https://github.com/getvoicify/disciple-api-express/compare/v1.2.0...v1.2.1) (2025-09-18)


### ♻️ Code Refactoring

* **ci:** migrate environment tags from `values.yaml` to `applicationset.yaml` ([d708c74](https://github.com/getvoicify/disciple-api-express/commit/d708c740b8659f9c57f9f764d364b4bc6bacaab9))

## [1.2.0](https://github.com/getvoicify/disciple-api-express/compare/v1.1.3...v1.2.0) (2025-09-17)


### ✨ Features

* **k8s:** update SealedSecrets and ConfigMap for database configuration ([f028b20](https://github.com/getvoicify/disciple-api-express/commit/f028b2001d884e165f735310a955e99581115c92))

## [1.1.3](https://github.com/getvoicify/disciple-api-express/compare/v1.1.2...v1.1.3) (2025-09-17)


### 🐛 Bug Fixes

* checkout main branch in deploy workflow ([ce926e1](https://github.com/getvoicify/disciple-api-express/commit/ce926e12ca319c48201d15ac18ba95b2310c663d))

## [1.1.2](https://github.com/getvoicify/disciple-api-express/compare/v1.1.1...v1.1.2) (2025-09-17)


### ♻️ Code Refactoring

* **k8s:** replace patchesStrategicMerge with patches in kustomization.yaml ([beea575](https://github.com/getvoicify/disciple-api-express/commit/beea575e63259bdfd67cee62a7200efc2a869a85))


### 👷 CI/CD

* enhance release workflow with Trivy scan and improved registry login ([#4](https://github.com/getvoicify/disciple-api-express/issues/4)) ([1bcb05c](https://github.com/getvoicify/disciple-api-express/commit/1bcb05cff7ffc8c1941858ba023363131615fa0e))

## [1.1.1](https://github.com/getvoicify/disciple-api-express/compare/v1.1.0...v1.1.1) (2025-09-17)


### ♻️ Code Refactoring

* split ApplicationSet for preview and static environments ([#3](https://github.com/getvoicify/disciple-api-express/issues/3)) ([82733eb](https://github.com/getvoicify/disciple-api-express/commit/82733eb0f2b9789f7445de258424cf53266bee72))


### 👷 CI/CD

* update success comment for GitHub releases in semantic-release config ([#2](https://github.com/getvoicify/disciple-api-express/issues/2)) ([1d6653e](https://github.com/getvoicify/disciple-api-express/commit/1d6653e0c1d2c419cf3f60b97ae1dcf40209ae1f))

## [1.1.0](https://github.com/getvoicify/disciple-api-express/compare/v1.0.0...v1.1.0) (2025-09-17)


### ✨ Features

* continuous delivery ([#1](https://github.com/getvoicify/disciple-api-express/issues/1)) ([cce15f6](https://github.com/getvoicify/disciple-api-express/commit/cce15f6fac7b39098a3d14fdf7051b04f7303109))

## 1.0.0 (2025-09-17)


### ✨ Features

* add semantic-release configuration and improved metadata integration ([caa2268](https://github.com/getvoicify/disciple-api-express/commit/caa2268770c9e9b4f4f1e854898cae06032c3b88))


### 👷 CI/CD

* disable test step in release workflow ([e9840f5](https://github.com/getvoicify/disciple-api-express/commit/e9840f5a94a64f494e9f9f3b335498ae43c2e0e7))
