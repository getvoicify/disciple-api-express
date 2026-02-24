# Production Gap Analysis - Implementation Design

> Design for implementing fixes across 25 production issues identified in the gap analysis.

## Decisions

- Migration `008_role_management_migration.sql` renamed to `018_role_management_migration.sql`
- Issue #2 (owner_id backfill) skipped - no backfill needed
- Issue #25 (plaintext secrets) - replace `secret.yaml` with template, add `.env` to `.gitignore`
- Issue #11 (DB SSL) - `ssl: process.env.DB_SSL !== 'false'` (on by default, opt-out)
- Issue #18 (race condition) - accepted as eventual consistency, document only

## Implementation Streams

### Stream A: Migrations & Schema (issues #1, #8, #22, #24)

1. Rename `008_role_management_migration.sql` → `018_role_management_migration.sql`
2. New migration `019_add_composite_index.sql`: composite index on `church_members(church_id, user_id, status)`
3. Wrap DROP TABLE statements in `018` in a transaction
4. No rollback script added (low priority, accepted risk)

### Stream B: Authorization & Security (issues #4, #5, #6, #10, #13, #20, #21)

1. Whitelist `sortBy`/`sortOrder` in `src/churches/postgres-repository.ts`
2. Add `prayer_wall`, `prayer_request`, `moderation` to `ResourceType` in `src/authorization/types.ts`
3. Define policies for new resource types in `src/authorization/policies.ts`
4. Create resolvers for prayer walls in `src/authorization/resolvers.ts`
5. Wire `authorize()` into prayer wall, prayer, and moderation routes
6. Add `authorize()` to post PATCH/DELETE/publish routes
7. Add `create: ['*']` to church policy
8. Add `AND deleted_at IS NULL` to post, series, note, gallery resolvers
9. Make `resourceId` extraction configurable via `paramName` option
10. Add `authorId` to gallery resolver

### Stream C: Infrastructure & Resilience (issues #7, #9, #11, #12, #14, #16, #17, #25)

1. Add SIGTERM/SIGINT handlers to `src/index.ts` (drain connections, close DB/Redis)
2. Fix health check: return 503 when DB is down (not 200 "degraded")
3. Change `ssl: false` → `ssl: process.env.DB_SSL !== 'false'`
4. Increase pool `max: 5` → `max: parseInt(process.env.DB_POOL_MAX || '20')`
5. Add startup validation for required env vars
6. Add `CORS_ORIGIN` to `k8s/base/configmap.yaml`
7. Add `process.on('unhandledRejection')` and `process.on('uncaughtException')`
8. Replace `k8s/base/secret.yaml` with `secret.yaml.example`, update `.gitignore`

### Stream D: Bug Fixes (issues #3, #15, #19, #23)

1. Fix `church_memberships` → `church_members` and `left_at IS NULL` → `status = 'Active'` in `src/profiles/pg-repository.ts`
2. Replace direct `res.status()` with `next(new AppError())` in `src/authorization/authorize.middleware.ts`
3. Replace `KEYS` with `SCAN` in `src/prayer-walls/services/presence.service.ts`
4. Fix logger JWT index: `req.user?.[0]` → `req.user?.[1]` in `src/logging/logger.factory.ts`

### Stream E: Documentation (issue #18)

Document race condition as accepted eventual consistency risk.

## Sequencing

Streams A-D are independent and can execute in parallel worktrees.
Stream E is trivial and handled inline.
