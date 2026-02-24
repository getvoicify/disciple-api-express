# Production Gap Analysis

> Generated 2026-02-24 after migrating role management from Keycloak to database-driven authorization.

---

## CRITICAL (Will Break in Production)

### 1. Duplicate Migration Number `008`

**Files:** `migrations/008_create_prayer_walls.sql` and `migrations/008_role_management_migration.sql`

Two files share the same sequence number. Migration runners will fail or produce non-deterministic ordering.

**Fix:** Renumber `008_role_management_migration.sql` to `018_role_management_migration.sql`.

---

### 2. Notes `owner_id` Never Backfilled

**File:** `migrations/008_role_management_migration.sql:5`

Migration adds `owner_id` column but doesn't populate it for existing rows. All pre-migration notes have `owner_id = NULL`. The authorize middleware checks `resourceInfo.ownerId === userId` which evaluates to `false` for every existing note.

**Impact:** All pre-migration notes become inaccessible (403 Forbidden).

**Fix:** Add backfill query: `UPDATE notes SET owner_id = <source_column> WHERE owner_id IS NULL;` — requires identifying how note ownership was tracked previously.

---

### 3. `church_memberships` Table Doesn't Exist

**File:** `src/profiles/pg-repository.ts:85`

Queries `church_memberships` (with an 's'), but the actual table created in `migrations/002_create_churches_tables.sql` is `church_members`. Also references a `left_at` column that doesn't exist on the table.

**Impact:** Any profile view with `privacy_mode='church_only'` between different users will error with `relation "church_memberships" does not exist`.

**Fix:** Change `church_memberships` to `church_members`, replace `left_at IS NULL` with `status = 'Active'`.

---

### 4. SQL Injection in Church Search

**File:** `src/churches/postgres-repository.ts:206-212`

```typescript
const sortBy = filters?.sortBy || 'created_at';
const sortOrder = filters?.sortOrder || 'desc';
const query = `... ORDER BY ${sortBy} ${sortOrder} ...`;
const result = await this.db.unsafe(query, [...values, pageSize, offset]);
```

`sortBy` and `sortOrder` are interpolated directly into SQL via `db.unsafe()` without validation.

**Impact:** An attacker can inject arbitrary SQL (e.g., `sortBy = "created_at); DROP TABLE churches; --"`).

**Fix:** Whitelist allowed values:
```typescript
const ALLOWED_SORT_FIELDS = ['created_at', 'name', 'slug', 'approval_status'];
const ALLOWED_SORT_ORDERS = ['asc', 'desc'];
const sortBy = ALLOWED_SORT_FIELDS.includes(filters?.sortBy) ? filters.sortBy : 'created_at';
const sortOrder = ALLOWED_SORT_ORDERS.includes(filters?.sortOrder?.toLowerCase()) ? filters.sortOrder.toLowerCase() : 'desc';
```

---

### 5. Prayer Walls Have No Authorization Middleware

**Files:** `src/prayer-walls/routes/walls.routes.ts`, `src/prayer-walls/routes/prayers.routes.ts`, `src/prayer-walls/routes/moderation.routes.ts`

Prayer walls, prayers, and moderation routes only use `tokenVerifier()`. The `authorize()` middleware is never applied. These resource types are completely absent from `src/authorization/policies.ts`.

**Impact:** Any authenticated user can create/update/delete prayer walls, prayers, and perform moderation actions.

**Fix:** Add `prayer_wall`, `prayer_request`, and `moderation` to `ResourceType` in `types.ts`, define policies, create resolvers, and wire `authorize()` into the route files.

---

### 6. Post Update/Delete Missing Authorization

**File:** `src/posts/routes/routes.ts:51-68`

`PATCH /:id` (update), `DELETE /:id` (delete), and `PATCH /:id/publish` (publish/unpublish) on posts routes don't use the `authorize()` middleware despite the post resource being defined in policies.

**Impact:** Any authenticated user can update, delete, or publish/unpublish any post.

**Fix:** Add `authorize({ resource: 'post', action: 'update' })` and `authorize({ resource: 'post', action: 'delete' })` to the respective route middleware arrays.

---

## HIGH (Serious Issues)

### 7. No Graceful Shutdown for HTTP Server

**File:** `src/index.ts:341-343`

The main API server has no SIGTERM/SIGINT handlers. The worker (`src/worker.ts`) has them, the API server doesn't. Kubernetes will SIGTERM the pod and force-kill after the grace period without draining connections.

**Fix:** Add signal handlers that close the HTTP server, drain connections, and close database/Redis pools.

---

### 8. Missing Composite Index on `church_members`

**File:** `migrations/002_create_churches_tables.sql`

The authorization middleware queries `WHERE church_id = ? AND user_id = ? AND status = 'Active'` on every protected request. Only single-column indexes exist (`idx_church_members_church_id`, `idx_church_members_user_id`, `idx_church_members_status`).

**Impact:** Performance degrades linearly with table size. This query runs on every protected endpoint.

**Fix:** Add migration:
```sql
CREATE INDEX idx_church_members_church_user_status
ON church_members(church_id, user_id, status);
```

---

### 9. Health Check Returns 200 When Database Is Down

**File:** `src/index.ts:256-258`

```typescript
} else if (isDbHealthy || isCacheHealthy) {
    status = 'degraded';
    statusCode = 200;  // NOT 503
}
```

Kubernetes liveness probe treats 200 as healthy — pod won't restart if database fails. App continues serving errors indefinitely.

**Fix:** Return 503 when database is down. Only use 200 for fully healthy or cache-only degradation if that's acceptable.

---

### 10. No `create` Policy for Churches

**File:** `src/authorization/policies.ts:4`

```typescript
church: { update: ['Owner'], delete: ['Owner'] },
```

No `create` action defined. Church creation authorization behavior is undefined — middleware will either deny all creation or behave unpredictably.

**Fix:** Add `create: ['*']` (if any authenticated user can create) or `create: ['Admin']` (if restricted).

---

### 11. Database SSL Disabled

**File:** `src/utils/database.ts:27`

`ssl: false` is hardcoded. Database is on external IP `95.217.19.4`. All traffic between API and database is unencrypted in transit.

**Fix:** Change to `ssl: process.env.DB_SSL !== 'false'` or `ssl: 'require'` for production.

---

### 12. Connection Pool Size = 5

**File:** `src/utils/database.ts:25`

`max: 5` is extremely small. With the authorization middleware adding a DB query to every request, plus the main handler query, 5 connections will exhaust under moderate load.

**Fix:** Increase to `max: 20` minimum. Consider making configurable via env var.

---

### 13. Resolvers Don't Respect Soft Deletes

**File:** `src/authorization/resolvers.ts`

Post, series, note, and gallery resolvers don't filter `WHERE deleted_at IS NULL`. Only the church resolver does. A soft-deleted resource can still pass authorization checks and be modified.

**Fix:** Add `AND deleted_at IS NULL` to all resolver queries.

---

## MEDIUM (Should Fix Before Merge)

### 14. No Startup Validation for Required Env Vars

**File:** `src/index.ts`

`PORT`, `IAM_ENDPOINT`, `IAM_REALM`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — none are validated at startup. Undefined values cause silent runtime failures (e.g., server tries to listen on `undefined` port).

**Fix:** Add validation block at startup that throws if required vars are missing.

---

### 15. Authorization Middleware Bypasses Error Handler

**File:** `src/authorization/authorize.middleware.ts`

Sends `res.status(500).json()` directly instead of calling `next(error)`. Inconsistent with the centralized `error-handler.middleware.ts` pattern. Errors aren't logged consistently.

**Fix:** Replace direct responses with `next(new AppError(...))`.

---

### 16. CORS Defaults to Wildcard

**File:** `src/websocket/socket.server.ts:65`

```typescript
origin: process.env.CORS_ORIGIN || '*',
```

`CORS_ORIGIN` is not set in k8s configmap. WebSocket accepts connections from any origin.

**Fix:** Add `CORS_ORIGIN` to `k8s/base/configmap.yaml` with the production domain.

---

### 17. No Unhandled Rejection/Exception Handlers

**File:** `src/index.ts`

Main process has no `process.on('unhandledRejection')` or `process.on('uncaughtException')`. Async errors outside safeExecute will crash the process silently without logging.

**Fix:** Add global error handlers that log and exit gracefully.

---

### 18. Race Condition on Membership Changes

**File:** `src/authorization/authorize.middleware.ts`

Authorization queries role at request start, but membership can change before the operation completes. No transactional boundary wraps the auth check + data write.

**Impact:** A user removed from a church mid-request can still complete their operation.

**Mitigation:** Accept as eventual consistency for now, but document the risk. Consider row-level locking for destructive operations.

---

### 19. `Redis.keys()` Used in PresenceService

**File:** `src/prayer-walls/services/presence.service.ts:186-189`

Uses the blocking `KEYS` command instead of `SCAN`. In production with many keys, this blocks the Redis event loop.

**Fix:** Replace with `SCAN` using cursor-based iteration.

---

### 20. resourceId Extraction Is Brittle

**File:** `src/authorization/authorize.middleware.ts:62`

```typescript
const resourceId = req.params?.id || req.params?.noteId || req.params?.churchId;
```

Hardcodes expected parameter names. Won't work for `wallId`, `postId`, `galleryId`, etc.

**Fix:** Accept a `paramName` option in the middleware config, or have each route specify which param holds the resource ID.

---

## LOW (Cleanup)

### 21. Gallery Resolver Has No `authorId`

**File:** `src/authorization/resolvers.ts:68`

Gallery resolver only returns `churchId`, not `authorId`. Gallery creators can't edit their own galleries via the author check path.

---

### 22. Migration Has No Rollback Script

**File:** `migrations/008_role_management_migration.sql`

No DOWN migration. If the release needs to be rolled back, the schema change (added `owner_id` column, dropped outbox tables) cannot be undone automatically.

---

### 23. Logger Extracts User from Wrong JWT Index

**File:** `src/logging/logger.factory.ts:117`

Extracts from `user[0]` but per the codebase convention (documented in CLAUDE.md), the authenticated user payload is at `user[1]`.

---

### 24. Outbox Table DROP Not in Transaction

**File:** `migrations/008_role_management_migration.sql:8-10`

`DROP TABLE IF EXISTS` statements aren't wrapped in a transaction. Partial failure leaves schema in inconsistent state.

---

### 25. Plaintext Secrets Committed

**Files:** `.env`, `k8s/base/secret.yaml`

Database passwords, R2 API tokens, and Redis passwords are committed in plaintext. Should use SealedSecrets exclusively.

---

## Recommended Priority Order

1. Renumber migration 008 to 018, add `owner_id` backfill
2. Fix `church_memberships` to `church_members` table name in profiles repo
3. Whitelist `sortBy`/`sortOrder` in church search (SQL injection)
4. Add `authorize()` middleware to prayer walls, prayers, moderation, post update/delete, gallery, church update/delete routes
5. Add composite index on `church_members(church_id, user_id, status)`
6. Add graceful shutdown to main HTTP server
7. Fix health check to return 503 when database is down
8. Enable database SSL
9. Increase connection pool size
10. Add startup env var validation
