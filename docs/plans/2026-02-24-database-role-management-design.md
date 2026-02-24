# Database Role Management Migration

**Date**: 2026-02-24
**Status**: Approved

## Goal

Eliminate Keycloak as an authorization system. The database becomes the single source of truth for roles and permissions. Keycloak remains for authentication (JWT issuance) only.

## Authorization Model

**Role-based + ownership.**

- Church roles (`Owner` / `Manager` / `Member`) govern church-scoped resources (posts, series, galleries).
- Resource creators have full control over their own resources.
- Notes are user-scoped — only the owner can access them.
- Church roles are irrelevant for notes.

### Policy Map

```typescript
type Role = 'Owner' | 'Manager' | 'Member';
type Actor = Role | 'author' | '*';

const policies: Record<string, Record<string, Actor[]>> = {
  church:  { update: ['Owner'],                    delete: ['Owner'] },
  post:    { create: ['Owner', 'Manager'],         read: ['*'],      update: ['Owner', 'Manager', 'author'], delete: ['Owner', 'author'] },
  series:  { create: ['Owner', 'Manager'],         read: ['*'],      update: ['Owner', 'Manager', 'author'], delete: ['Owner', 'author'] },
  gallery: { create: ['Owner', 'Manager'],         read: ['*'],      update: ['Owner', 'Manager'],           delete: ['Owner'] },
  note:    { create: ['*'],                        read: ['author'], update: ['author'],                      delete: ['author'] },
};
```

- `'*'` — any authenticated user
- `'author'` — the resource creator/owner
- Role strings — checked against `church_members.role`

## What Gets Added

### New Directory: `src/authorization/`

| File | Purpose |
|------|---------|
| `policies.ts` | Static policy map defining role-action permissions per resource type |
| `authorize.middleware.ts` | Express middleware factory replacing `canAccessMiddleware` |
| `resolvers.ts` | Per-resource-type functions that fetch `author_id` and `church_id` |
| `types.ts` | Shared types: `Role`, `Actor`, `ResourceType`, `Action` |

### Authorization Middleware

Factory function: `authorize({ resource: 'post', action: 'update' })`

**For create actions** (no existing resource):
1. Extract `userId` from JWT
2. Get `churchId` from request body or params
3. Query `church_members` for user's role in that church
4. Check policy: does this role allow the action?

**For read/update/delete actions** (existing resource):
1. Extract `userId` from JWT
2. Get resource ID from params
3. Fetch the resource via resolver to determine `author_id` and `church_id`
4. Query `church_members` for user's role in that church
5. Check policy: does this role OR author status allow the action?

**For note actions** (user-scoped):
1. Extract `userId` from JWT
2. For create: allow any authenticated user
3. For read/update/delete: fetch note, check `owner_id === userId`

### Resource Resolvers

```typescript
const resolvers = {
  post:    (id) => db`SELECT author_id, church_id FROM posts WHERE id = ${id}`,
  series:  (id) => db`SELECT author_id, church_id FROM series WHERE id = ${id}`,
  gallery: (id) => db`SELECT g.church_id FROM galleries g WHERE g.id = ${id}`,
  note:    (id) => db`SELECT owner_id FROM notes WHERE id = ${id} AND deleted_at IS NULL`,
};
```

### Database Migration

```sql
-- 008_role_management_migration.sql

-- Add owner_id to notes
ALTER TABLE notes ADD COLUMN owner_id UUID;
CREATE INDEX idx_notes_owner_id ON notes(owner_id);

-- Drop outbox tables
DROP TABLE IF EXISTS outbox_dead_letter;
DROP TABLE IF EXISTS outbox_events;
```

Pre-production: no backfill. Notes without `owner_id` become inaccessible.

## What Gets Removed

### Deleted Files

| File/Directory | Reason |
|---|---|
| `src/keycloak/admin-client.ts` | No more Keycloak resource CRUD |
| `src/keycloak/resource-manager.ts` | No more Keycloak permission management |
| `src/keycloak/outbox.publisher.ts` | No more syncing resources to Keycloak |
| `src/keycloak/resource-adapters.ts` | No more resource type factories |
| `src/keycloak/generalized-outbox.adapter.ts` | No more event enqueueing |
| `src/keycloak/setup.ts` | No more Keycloak adapter init |
| `src/keycloak/types.ts` | No more Keycloak-specific types |
| `src/middleware/get-authorized-ids.middleware/` | Replaced by `authorize` middleware |
| `src/outbox/` (entire directory) | Only used for Keycloak sync |

### Changes to Existing Files

- **Repositories** (`PostgresNoteRepository`, `PostgresMediaRepository`, `PostgresPostRepository`): Remove `keycloakAdapter` constructor param and all `adapter.enqueueResourceCreate()` / `enqueueResourceDelete()` calls.
- **`src/index.ts`**: Remove `setupKeycloakAdapter()`, outbox polling `setInterval`, adapter injection into repositories.
- **Route files**: Replace `canAccessMiddleware(...)` with `authorize(...)`.
- **List endpoints**: Replace `req['ids']` filtering with ownership/membership-based queries.
  - `noteList`: filter `WHERE owner_id = $userId`
  - `postList`: filter by church membership or `churchId` param
  - `devotionalList`: same as posts

### Removed Environment Variables

- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET`

Remove from `.env`, `k8s/base/secret.yaml`, `k8s/base/sealedsecret.yaml`, `k8s/base/configmap.yaml`.

## What Stays Unchanged

- JWT validation middleware (`src/utils/validate-token.middleware.ts`) — still validates Keycloak-issued tokens
- Token extraction service (`src/utils/token.service.ts`)
- `IAM_ENDPOINT` and `IAM_REALM` env vars — still needed for JWKS
- `church_members` table and its `role`/`status` columns
- All business logic in services
- All Zod validation schemas

## Rollout

Single release. Pre-production — no migration script, no backfill, no phased rollout.

1. Run migration (add `owner_id` to notes, drop outbox tables)
2. Deploy new authorization middleware + remove Keycloak authorization code
3. Remove `KEYCLOAK_CLIENT_ID` / `KEYCLOAK_CLIENT_SECRET` from env/secrets
