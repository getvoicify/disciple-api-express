# Database Role Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Keycloak authorization with local database role-based + ownership authorization, making the database the single source of truth for permissions.

**Architecture:** New `src/authorization/` module with a static policy map, an Express middleware factory, and per-resource resolvers. The middleware queries `church_members` for role checks and resource tables for ownership checks. All Keycloak authorization code (admin client, resource manager, outbox adapter, UMA middleware) gets deleted. Keycloak stays for JWT authentication only.

**Tech Stack:** Express 5, TypeScript 5, PostgreSQL (postgres library), Zod, Vitest

**Design doc:** `docs/plans/2026-02-24-database-role-management-design.md`

---

### Task 1: Authorization Types

**Files:**
- Create: `src/authorization/types.ts`
- Test: `src/tests/authorization/types.test.ts`

**Step 1: Write the failing test**

```typescript
// src/tests/authorization/types.test.ts
import { describe, it, expect } from 'vitest';
import type { Role, Actor, ResourceType, Action, AuthorizationContext } from '../../authorization/types';

describe('Authorization Types', () => {
  it('should allow valid Role values', () => {
    const roles: Role[] = ['Owner', 'Manager', 'Member'];
    expect(roles).toHaveLength(3);
  });

  it('should allow valid Actor values', () => {
    const actors: Actor[] = ['Owner', 'Manager', 'Member', 'author', '*'];
    expect(actors).toHaveLength(5);
  });

  it('should allow valid ResourceType values', () => {
    const types: ResourceType[] = ['church', 'post', 'series', 'gallery', 'note'];
    expect(types).toHaveLength(5);
  });

  it('should allow valid Action values', () => {
    const actions: Action[] = ['create', 'read', 'update', 'delete'];
    expect(actions).toHaveLength(4);
  });

  it('should define AuthorizationContext shape', () => {
    const ctx: AuthorizationContext = {
      userId: 'user-123',
      resourceType: 'post',
      action: 'update',
    };
    expect(ctx.userId).toBe('user-123');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/authorization/types.test.ts`
Expected: FAIL — cannot find module `../../authorization/types`

**Step 3: Write minimal implementation**

```typescript
// src/authorization/types.ts
export type Role = 'Owner' | 'Manager' | 'Member';
export type Actor = Role | 'author' | '*';
export type ResourceType = 'church' | 'post' | 'series' | 'gallery' | 'note';
export type Action = 'create' | 'read' | 'update' | 'delete';

export interface AuthorizationContext {
  userId: string;
  resourceType: ResourceType;
  action: Action;
  resourceId?: string;
  churchId?: string;
}

export interface ResourceInfo {
  authorId?: string;
  churchId?: string;
  ownerId?: string;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/authorization/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/authorization/types.ts src/tests/authorization/types.test.ts
git commit -m "feat(authorization): add authorization type definitions"
```

---

### Task 2: Policy Map

**Files:**
- Create: `src/authorization/policies.ts`
- Test: `src/tests/authorization/policies.test.ts`

**Step 1: Write the failing test**

```typescript
// src/tests/authorization/policies.test.ts
import { describe, it, expect } from 'vitest';
import { policies, isActionAllowed } from '../../authorization/policies';
import type { Role } from '../../authorization/types';

describe('Authorization Policies', () => {
  describe('policies map', () => {
    it('should define policies for all resource types', () => {
      expect(policies).toHaveProperty('church');
      expect(policies).toHaveProperty('post');
      expect(policies).toHaveProperty('series');
      expect(policies).toHaveProperty('gallery');
      expect(policies).toHaveProperty('note');
    });
  });

  describe('isActionAllowed', () => {
    // Church policies
    it('should allow Owner to update church', () => {
      expect(isActionAllowed('church', 'update', 'Owner', false)).toBe(true);
    });

    it('should deny Manager from updating church', () => {
      expect(isActionAllowed('church', 'update', 'Manager', false)).toBe(false);
    });

    it('should allow Owner to delete church', () => {
      expect(isActionAllowed('church', 'delete', 'Owner', false)).toBe(true);
    });

    it('should deny Member from deleting church', () => {
      expect(isActionAllowed('church', 'delete', 'Member', false)).toBe(false);
    });

    // Post policies
    it('should allow Owner to create post', () => {
      expect(isActionAllowed('post', 'create', 'Owner', false)).toBe(true);
    });

    it('should allow Manager to create post', () => {
      expect(isActionAllowed('post', 'create', 'Manager', false)).toBe(true);
    });

    it('should deny Member from creating post', () => {
      expect(isActionAllowed('post', 'create', 'Member', false)).toBe(false);
    });

    it('should allow any authenticated user to read post', () => {
      expect(isActionAllowed('post', 'read', undefined, false)).toBe(true);
    });

    it('should allow author to update their own post', () => {
      expect(isActionAllowed('post', 'update', 'Member', true)).toBe(true);
    });

    it('should deny non-author Member from updating post', () => {
      expect(isActionAllowed('post', 'update', 'Member', false)).toBe(false);
    });

    it('should allow Manager to update any post', () => {
      expect(isActionAllowed('post', 'update', 'Manager', false)).toBe(true);
    });

    it('should allow author to delete their own post', () => {
      expect(isActionAllowed('post', 'delete', undefined, true)).toBe(true);
    });

    it('should allow Owner to delete any post', () => {
      expect(isActionAllowed('post', 'delete', 'Owner', false)).toBe(true);
    });

    // Note policies — owner-only
    it('should allow any authenticated user to create note', () => {
      expect(isActionAllowed('note', 'create', undefined, false)).toBe(true);
    });

    it('should allow author to read their own note', () => {
      expect(isActionAllowed('note', 'read', undefined, true)).toBe(true);
    });

    it('should deny non-author from reading note', () => {
      expect(isActionAllowed('note', 'read', undefined, false)).toBe(false);
    });

    it('should allow author to update their own note', () => {
      expect(isActionAllowed('note', 'update', undefined, true)).toBe(true);
    });

    it('should deny non-author from updating note', () => {
      expect(isActionAllowed('note', 'update', undefined, false)).toBe(false);
    });

    // Gallery policies
    it('should allow Owner to delete gallery items', () => {
      expect(isActionAllowed('gallery', 'delete', 'Owner', false)).toBe(true);
    });

    it('should deny Manager from deleting gallery items', () => {
      expect(isActionAllowed('gallery', 'delete', 'Manager', false)).toBe(false);
    });

    // Unknown resource/action
    it('should deny action for unknown resource type', () => {
      expect(isActionAllowed('unknown' as any, 'read', undefined, false)).toBe(false);
    });

    it('should deny unknown action for known resource', () => {
      expect(isActionAllowed('post', 'unknown' as any, undefined, false)).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/authorization/policies.test.ts`
Expected: FAIL — cannot find module `../../authorization/policies`

**Step 3: Write minimal implementation**

```typescript
// src/authorization/policies.ts
import type { Actor, ResourceType, Action, Role } from './types';

export const policies: Record<string, Record<string, Actor[]>> = {
  church:  { update: ['Owner'],                    delete: ['Owner'] },
  post:    { create: ['Owner', 'Manager'],         read: ['*'],      update: ['Owner', 'Manager', 'author'], delete: ['Owner', 'author'] },
  series:  { create: ['Owner', 'Manager'],         read: ['*'],      update: ['Owner', 'Manager', 'author'], delete: ['Owner', 'author'] },
  gallery: { create: ['Owner', 'Manager'],         read: ['*'],      update: ['Owner', 'Manager'],           delete: ['Owner'] },
  note:    { create: ['*'],                        read: ['author'], update: ['author'],                      delete: ['author'] },
};

export function isActionAllowed(
  resourceType: ResourceType,
  action: Action,
  role: Role | undefined,
  isAuthor: boolean,
): boolean {
  const resourcePolicies = policies[resourceType];
  if (!resourcePolicies) return false;

  const allowedActors = resourcePolicies[action];
  if (!allowedActors) return false;

  // Wildcard — any authenticated user
  if (allowedActors.includes('*')) return true;

  // Author/owner check
  if (isAuthor && allowedActors.includes('author')) return true;

  // Role check
  if (role && allowedActors.includes(role)) return true;

  return false;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/authorization/policies.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/authorization/policies.ts src/tests/authorization/policies.test.ts
git commit -m "feat(authorization): add policy map and isActionAllowed function"
```

---

### Task 3: Resource Resolvers

**Files:**
- Create: `src/authorization/resolvers.ts`
- Test: `src/tests/authorization/resolvers.test.ts`

**Context:** Resolvers are functions that, given a resource ID, return the `authorId`/`ownerId` and `churchId` for that resource. The authorize middleware calls the appropriate resolver to determine ownership.

**Step 1: Write the failing test**

```typescript
// src/tests/authorization/resolvers.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createResolvers } from '../../authorization/resolvers';
import type { RawDb } from '../../utils/database';

describe('Resource Resolvers', () => {
  const mockDb = vi.fn() as unknown as RawDb;

  it('should create resolvers for all resource types', () => {
    const resolvers = createResolvers(mockDb);
    expect(resolvers).toHaveProperty('post');
    expect(resolvers).toHaveProperty('series');
    expect(resolvers).toHaveProperty('gallery');
    expect(resolvers).toHaveProperty('note');
    expect(resolvers).toHaveProperty('church');
  });

  it('should return ResourceInfo from post resolver', async () => {
    const row = { author_id: 'user-1', church_id: 'church-1' };
    const db = Object.assign(
      vi.fn().mockResolvedValue([row]),
      { unsafe: vi.fn(), begin: vi.fn() }
    ) as unknown as RawDb;
    const resolvers = createResolvers(db);
    const info = await resolvers.post('post-id-1');
    expect(info).toEqual({ authorId: 'user-1', churchId: 'church-1' });
  });

  it('should return null from resolver when resource not found', async () => {
    const db = Object.assign(
      vi.fn().mockResolvedValue([]),
      { unsafe: vi.fn(), begin: vi.fn() }
    ) as unknown as RawDb;
    const resolvers = createResolvers(db);
    const info = await resolvers.post('nonexistent');
    expect(info).toBeNull();
  });

  it('should return ResourceInfo from note resolver with ownerId', async () => {
    const row = { owner_id: 'user-2' };
    const db = Object.assign(
      vi.fn().mockResolvedValue([row]),
      { unsafe: vi.fn(), begin: vi.fn() }
    ) as unknown as RawDb;
    const resolvers = createResolvers(db);
    const info = await resolvers.note('note-id-1');
    expect(info).toEqual({ ownerId: 'user-2' });
  });

  it('should return ResourceInfo from church resolver', async () => {
    const row = { created_by: 'user-3' };
    const db = Object.assign(
      vi.fn().mockResolvedValue([row]),
      { unsafe: vi.fn(), begin: vi.fn() }
    ) as unknown as RawDb;
    const resolvers = createResolvers(db);
    const info = await resolvers.church('church-id-1');
    expect(info).toEqual({ authorId: 'user-3', churchId: 'church-id-1' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/authorization/resolvers.test.ts`
Expected: FAIL — cannot find module `../../authorization/resolvers`

**Step 3: Write minimal implementation**

```typescript
// src/authorization/resolvers.ts
import type { RawDb } from '../utils/database';
import type { ResourceInfo, ResourceType } from './types';

export type ResourceResolver = (id: string) => Promise<ResourceInfo | null>;

export function createResolvers(db: RawDb): Record<ResourceType, ResourceResolver> {
  return {
    post: async (id: string) => {
      const result = await db`SELECT author_id, church_id FROM posts WHERE id = ${id}`;
      if (result.length === 0) return null;
      return { authorId: result[0].author_id, churchId: result[0].church_id };
    },

    series: async (id: string) => {
      const result = await db`SELECT author_id, church_id FROM series WHERE id = ${id}`;
      if (result.length === 0) return null;
      return { authorId: result[0].author_id, churchId: result[0].church_id };
    },

    gallery: async (id: string) => {
      const result = await db`SELECT church_id FROM galleries WHERE id = ${id}`;
      if (result.length === 0) return null;
      return { churchId: result[0].church_id };
    },

    note: async (id: string) => {
      const result = await db`SELECT owner_id FROM notes WHERE id = ${id}`;
      if (result.length === 0) return null;
      return { ownerId: result[0].owner_id };
    },

    church: async (id: string) => {
      const result = await db`SELECT created_by FROM churches WHERE id = ${id} AND deleted_at IS NULL`;
      if (result.length === 0) return null;
      return { authorId: result[0].created_by, churchId: id };
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/authorization/resolvers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/authorization/resolvers.ts src/tests/authorization/resolvers.test.ts
git commit -m "feat(authorization): add resource resolvers for ownership lookups"
```

---

### Task 4: Authorization Middleware

**Files:**
- Create: `src/authorization/authorize.middleware.ts`
- Test: `src/tests/authorization/authorize.middleware.test.ts`

**Context:** This is the core middleware that replaces `canAccessMiddleware`. It's a factory function that takes `{ resource, action }` options and returns Express middleware. It uses the policy map and resolvers to make authorization decisions.

Important references:
- User ID extraction pattern: `req['user']?.[1].payload?.sub` (from `src/types/endpoint-handler.ts`)
- Middleware type: `(req: Request, res: Response, next: NextFunction) => void | Promise<void>` (from `src/utils/middleware.ts`)
- Error classes: `ForbiddenError` (403), `UnauthorizedError` (401) from `src/utils/errors.ts`
- Use `safeExecute` for all async operations per `CLAUDE.md`
- Use structured `logger` for logging, never `console.*`

**Step 1: Write the failing test**

```typescript
// src/tests/authorization/authorize.middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthorizeMiddleware } from '../../authorization/authorize.middleware';
import type { ResourceResolver } from '../../authorization/resolvers';
import type { ResourceType } from '../../authorization/types';

function createMockReq(userId?: string, params: Record<string, string> = {}, body: Record<string, string> = {}) {
  return {
    user: userId ? [undefined, { payload: { sub: userId } }] : undefined,
    params,
    body,
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('Authorize Middleware', () => {
  const mockResolvers: Record<ResourceType, ResourceResolver> = {
    post: vi.fn(),
    series: vi.fn(),
    gallery: vi.fn(),
    note: vi.fn(),
    church: vi.fn(),
  };
  const mockMemberLookup = vi.fn();
  let authorize: ReturnType<typeof createAuthorizeMiddleware>;

  beforeEach(() => {
    vi.clearAllMocks();
    authorize = createAuthorizeMiddleware(mockResolvers, mockMemberLookup);
  });

  it('should return 401 when user is not authenticated', async () => {
    const req = createMockReq(undefined);
    const res = createMockRes();
    const next = vi.fn();

    const middleware = authorize({ resource: 'post', action: 'create' });
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow create when user has correct church role', async () => {
    const req = createMockReq('user-1', {}, { churchId: 'church-1' });
    const res = createMockRes();
    const next = vi.fn();
    mockMemberLookup.mockResolvedValue('Owner');

    const middleware = authorize({ resource: 'post', action: 'create' });
    await middleware(req, res, next);

    expect(mockMemberLookup).toHaveBeenCalledWith('church-1', 'user-1');
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 when user lacks role for create', async () => {
    const req = createMockReq('user-1', {}, { churchId: 'church-1' });
    const res = createMockRes();
    const next = vi.fn();
    mockMemberLookup.mockResolvedValue('Member');

    const middleware = authorize({ resource: 'post', action: 'create' });
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow update when user is the author', async () => {
    const req = createMockReq('user-1', { id: 'post-1' });
    const res = createMockRes();
    const next = vi.fn();
    (mockResolvers.post as any).mockResolvedValue({ authorId: 'user-1', churchId: 'church-1' });
    mockMemberLookup.mockResolvedValue('Member');

    const middleware = authorize({ resource: 'post', action: 'update' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow update when user is Manager (non-author)', async () => {
    const req = createMockReq('user-2', { id: 'post-1' });
    const res = createMockRes();
    const next = vi.fn();
    (mockResolvers.post as any).mockResolvedValue({ authorId: 'user-1', churchId: 'church-1' });
    mockMemberLookup.mockResolvedValue('Manager');

    const middleware = authorize({ resource: 'post', action: 'update' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 404 when resource not found', async () => {
    const req = createMockReq('user-1', { id: 'nonexistent' });
    const res = createMockRes();
    const next = vi.fn();
    (mockResolvers.post as any).mockResolvedValue(null);

    const middleware = authorize({ resource: 'post', action: 'update' });
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  // Note: owner-only
  it('should allow note owner to read their note', async () => {
    const req = createMockReq('user-1', { noteId: 'note-1' });
    const res = createMockRes();
    const next = vi.fn();
    (mockResolvers.note as any).mockResolvedValue({ ownerId: 'user-1' });

    const middleware = authorize({ resource: 'note', action: 'read' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should deny non-owner from reading note', async () => {
    const req = createMockReq('user-2', { noteId: 'note-1' });
    const res = createMockRes();
    const next = vi.fn();
    (mockResolvers.note as any).mockResolvedValue({ ownerId: 'user-1' });

    const middleware = authorize({ resource: 'note', action: 'read' });
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow note create for any authenticated user', async () => {
    const req = createMockReq('user-1');
    const res = createMockRes();
    const next = vi.fn();

    const middleware = authorize({ resource: 'note', action: 'create' });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should use churchId from params when present', async () => {
    const req = createMockReq('user-1', { churchId: 'church-1' }, {});
    const res = createMockRes();
    const next = vi.fn();
    mockMemberLookup.mockResolvedValue('Owner');

    const middleware = authorize({ resource: 'post', action: 'create' });
    await middleware(req, res, next);

    expect(mockMemberLookup).toHaveBeenCalledWith('church-1', 'user-1');
    expect(next).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/authorization/authorize.middleware.test.ts`
Expected: FAIL — cannot find module

**Step 3: Write minimal implementation**

```typescript
// src/authorization/authorize.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import type { ResourceType, Action, Role } from './types';
import type { ResourceResolver } from './resolvers';
import { isActionAllowed } from './policies';
import { safeExecute } from '../utils/handle-async';
import { logger } from '../logging';

export interface AuthorizeOptions {
  resource: ResourceType;
  action: Action;
}

type MemberRoleLookup = (churchId: string, userId: string) => Promise<Role | null>;

export function createAuthorizeMiddleware(
  resolvers: Record<ResourceType, ResourceResolver>,
  memberRoleLookup: MemberRoleLookup,
) {
  return (options: AuthorizeOptions) => {
    const { resource, action } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const userId = (req as any)['user']?.[1]?.payload?.sub as string | undefined;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required', success: false });
        return;
      }

      // For create actions, check role against the target church
      if (action === 'create') {
        // Notes: any authenticated user can create
        if (isActionAllowed(resource, action, undefined, false)) {
          next();
          return;
        }

        // Church-scoped resources need a churchId
        const churchId = req.params?.churchId || req.body?.churchId;
        if (!churchId) {
          res.status(400).json({ error: 'Church context required', success: false });
          return;
        }

        const [roleErr, role] = await safeExecute(memberRoleLookup(churchId, userId));
        if (roleErr) {
          logger.error({ error: roleErr, userId, churchId }, 'Failed to look up member role');
          res.status(500).json({ error: 'Authorization check failed', success: false });
          return;
        }

        if (isActionAllowed(resource, action, role ?? undefined, false)) {
          next();
          return;
        }

        res.status(403).json({ error: 'Forbidden', success: false });
        return;
      }

      // For read/update/delete, resolve the resource first
      const resourceId = req.params?.id || req.params?.noteId || req.params?.churchId;
      if (!resourceId) {
        res.status(400).json({ error: 'Resource identifier required', success: false });
        return;
      }

      const resolver = resolvers[resource];
      const [resolveErr, resourceInfo] = await safeExecute(resolver(resourceId));

      if (resolveErr) {
        logger.error({ error: resolveErr, resourceId, resource }, 'Failed to resolve resource');
        res.status(500).json({ error: 'Authorization check failed', success: false });
        return;
      }

      if (!resourceInfo) {
        res.status(404).json({ error: `${resource} not found`, success: false });
        return;
      }

      // Determine if user is the author/owner
      const isAuthor = resourceInfo.authorId === userId || resourceInfo.ownerId === userId;

      // Look up church role if resource is church-scoped
      let role: Role | undefined;
      const churchId = resourceInfo.churchId;
      if (churchId) {
        const [roleErr, memberRole] = await safeExecute(memberRoleLookup(churchId, userId));
        if (roleErr) {
          logger.error({ error: roleErr, userId, churchId }, 'Failed to look up member role');
          res.status(500).json({ error: 'Authorization check failed', success: false });
          return;
        }
        role = memberRole ?? undefined;
      }

      if (isActionAllowed(resource, action, role, isAuthor)) {
        next();
        return;
      }

      (req as any).log?.warn({ userId, resource, action, resourceId }, 'Authorization denied');
      res.status(403).json({ error: 'Forbidden', success: false });
    };
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/authorization/authorize.middleware.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/authorization/authorize.middleware.ts src/tests/authorization/authorize.middleware.test.ts
git commit -m "feat(authorization): add authorize middleware factory"
```

---

### Task 5: Authorization Module Index

**Files:**
- Create: `src/authorization/index.ts`

**Step 1: Create the barrel export**

```typescript
// src/authorization/index.ts
export { createAuthorizeMiddleware } from './authorize.middleware';
export type { AuthorizeOptions } from './authorize.middleware';
export { createResolvers } from './resolvers';
export { policies, isActionAllowed } from './policies';
export type { Role, Actor, ResourceType, Action, AuthorizationContext, ResourceInfo } from './types';
```

**Step 2: Run all authorization tests to verify nothing broke**

Run: `npx vitest run src/tests/authorization/`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/authorization/index.ts
git commit -m "feat(authorization): add barrel export for authorization module"
```

---

### Task 6: Database Migration — Add `owner_id` to Notes, Drop Outbox Tables

**Files:**
- Create: `migrations/008_role_management_migration.sql`
- Test: `src/tests/authorization/migration.test.ts`

**Step 1: Write the failing test**

Test verifies that the migration file exists and has the expected SQL statements:

```typescript
// src/tests/authorization/migration.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Migration 008 - Role Management', () => {
  const migrationPath = resolve(__dirname, '../../../migrations/008_role_management_migration.sql');

  it('should contain ALTER TABLE for notes owner_id', () => {
    const sql = readFileSync(migrationPath, 'utf-8');
    expect(sql).toContain('ALTER TABLE notes ADD COLUMN owner_id UUID');
  });

  it('should contain index on notes owner_id', () => {
    const sql = readFileSync(migrationPath, 'utf-8');
    expect(sql).toContain('CREATE INDEX');
    expect(sql).toContain('owner_id');
  });

  it('should drop outbox_dead_letter table', () => {
    const sql = readFileSync(migrationPath, 'utf-8');
    expect(sql).toContain('DROP TABLE IF EXISTS outbox_dead_letter');
  });

  it('should drop outbox_events table', () => {
    const sql = readFileSync(migrationPath, 'utf-8');
    expect(sql).toContain('DROP TABLE IF EXISTS outbox_events');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/authorization/migration.test.ts`
Expected: FAIL — file not found

**Step 3: Write the migration**

```sql
-- migrations/008_role_management_migration.sql
-- Migration: Move authorization from Keycloak to database
-- This migration adds owner_id to notes and removes Keycloak outbox tables

-- Add owner_id column to notes table for ownership-based authorization
ALTER TABLE notes ADD COLUMN owner_id UUID;
CREATE INDEX idx_notes_owner_id ON notes(owner_id);

-- Drop outbox tables — no longer needed without Keycloak resource sync
DROP TABLE IF EXISTS outbox_dead_letter;
DROP TABLE IF EXISTS outbox_events;
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/authorization/migration.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add migrations/008_role_management_migration.sql src/tests/authorization/migration.test.ts
git commit -m "feat(migration): add owner_id to notes, drop outbox tables"
```

---

### Task 7: Wire Up Authorization in `src/index.ts`

**Files:**
- Modify: `src/index.ts`

**Context:** Remove Keycloak setup, outbox polling, and adapter injection. Wire up the new authorization module instead. This is a modify-only task — no new files.

**Step 1: Modify `src/index.ts`**

Remove these imports (lines 5, 33-34):
- `import {concatMap, defer, interval, Subject, takeUntil, tap} from 'rxjs';`
- `import {setupKeycloakAdapter} from "./keycloak/setup";`
- `import {type KeycloakAdminConfig} from "./keycloak/admin-client";`

Add new imports:
```typescript
import { createAuthorizeMiddleware } from './authorization';
import { createResolvers } from './authorization/resolvers';
```

Remove keycloak config block (lines 57-64):
```typescript
// DELETE: const keycloakConfig = { ... };
// DELETE: const {adapter: keycloakAdapter, outbox} = setupKeycloakAdapter(db, keycloakConfig);
```

Add authorization setup after db creation:
```typescript
const resolvers = createResolvers(db);
const memberRoleLookup = async (churchId: string, userId: string) => {
  const result = await db`
    SELECT role FROM church_members
    WHERE church_id = ${churchId} AND user_id = ${userId} AND status = 'Active'
  `;
  return result.length > 0 ? result[0].role : null;
};
const authorize = createAuthorizeMiddleware(resolvers, memberRoleLookup);
```

Update repository instantiations — remove keycloakAdapter param:
- Line 65: `new PostgresNoteRepository(db, keycloakAdapter)` → `new PostgresNoteRepository(db)`
- Line 74: `new PostgresMediaRepository(db, keycloakAdapter)` → `new PostgresMediaRepository(db)`
- Line 90: `new PostgresPostRepository(db, keycloakAdapter)` → `new PostgresPostRepository(db)`

Pass `authorize` to routers that need it (update router calls at lines 258-263):
```typescript
app.use('/api/notes', notesRouter(noteService, authorize));
app.use('/api/posts', postsRouter(postService, seriesService, authorize));
app.use('/api/devotional', devotionalRouter(seriesService, authorize));
```

Remove outbox polling block (lines 272-292):
```typescript
// DELETE: const sigEndSub = new Subject<void>();
// DELETE: interval(1000 * 15).pipe( ... ).subscribe();
// DELETE: const clearIntervalFn = ...
// DELETE: process.on('SIGINT', clearIntervalFn);
// DELETE: process.on('SIGTERM', clearIntervalFn);
```

Also remove the `rxjs` import since it's no longer used.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Compilation errors for repositories still expecting keycloakAdapter — these are fixed in the next task

**Step 3: Commit (even with compile errors — they're fixed next)**

Do NOT commit yet. Continue to Task 8 first, then commit together.

---

### Task 8: Remove Keycloak Adapter from Repositories

**Files:**
- Modify: `src/notes/pg-repository.ts`
- Modify: `src/posts/pg-repository.ts`
- Modify: `src/media/pg-repository.ts`

**Step 1: Update `src/notes/pg-repository.ts`**

Remove line 4 (keycloak import):
```typescript
// DELETE: import {type GeneralizedKeycloakOutboxAdapter} from "../keycloak/generalized-outbox.adapter";
```

Remove `keycloakAdapter` from constructor (lines 8-11):
```typescript
// BEFORE:
constructor(
  private readonly db: RawDb,
  private readonly keycloakAdapter: GeneralizedKeycloakOutboxAdapter,
) {}

// AFTER:
constructor(
  private readonly db: RawDb,
) {}
```

Remove `ResourceType` static field (line 7):
```typescript
// DELETE: private static ResourceType = 'notes' as const;
```

In `create` method — remove keycloak enqueue call (line 30):
```typescript
// DELETE: await this.keycloakAdapter.enqueueResourceCreate(note, PostgresNoteRepository.ResourceType, ownerId);
```

Update INSERT to include `owner_id` (lines 19-28):
```typescript
const result = await tx`
  INSERT INTO notes (id, title, content, date,
                     scripture_references, images,
                     owner_id, created_at, updated_at)
  VALUES (${id}, ${input.title}, ${input.content}, ${now},
          ${JSON.stringify(input.scriptureReferences || [])},
          ${JSON.stringify(input.images || [])},
          ${ownerId}, ${now}, ${now})
  RETURNING *
`;
```

In `delete` method — remove keycloak enqueue call (lines 88-89):
```typescript
// DELETE: await this.keycloakAdapter.enqueueResourceDelete(id, PostgresNoteRepository.ResourceType);
```

The delete method can also be simplified since the transaction is no longer needed for the keycloak call:
```typescript
async delete(id: string): Promise<boolean> {
  const result = await this.db`DELETE FROM notes WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}
```

Update `mapRowToNote` to include `ownerId` (line 192-206):
```typescript
private mapRowToNote(row: any): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    date: row.date instanceof Date ? row.date : new Date(row.date),
    scriptureReferences: typeof row.scripture_references === 'string'
      ? JSON.parse(row.scripture_references)
      : row.scripture_references || [],
    images: typeof row.images === 'string'
      ? JSON.parse(row.images)
      : row.images || [],
    ownerId: row.owner_id,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt || row.created_at),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt || row.updated_at)
  };
}
```

**Step 2: Update `src/notes/schemas.ts`**

Add `ownerId` to the Note schema (after line 17):
```typescript
export const Note = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  content: z.string(),
  date: z.date(),
  scriptureReferences: z.array(ScriptureReference),
  images: z.array(z.string()).optional(),
  ownerId: z.string().uuid().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});
```

Replace `authorizedIds` in NoteFilters with `ownerId`:
```typescript
export const NoteFilters = z.object({
  ownerId: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  scripture: z.object({
    book: z.string().optional(),
    chapter: z.number().int().positive().optional(),
    verse: z.number().int().positive().optional()
  }).optional(),
});
```

**Step 3: Update `src/posts/pg-repository.ts`**

Same pattern — remove keycloak import (line 4), remove from constructor (lines 8-11), remove `ResourceType` (line 7), remove `enqueueResourceCreate` from `create` (line 35), remove `enqueueResourceDelete` from `delete` (line 113), simplify `delete` method.

Also remove `authorizedIds` filter logic from `findAll` (lines 145-155). The authorization is now handled by middleware, not by filtering query results.

**Step 4: Update `src/media/pg-repository.ts`**

Same pattern — remove keycloak import (line 4), remove from constructor (lines 8-11), remove `ResourceType` (line 7), remove `enqueueResourceCreate` from `create` (line 27), remove `enqueueResourceDelete` from `delete` (line 92), simplify `delete` method.

Remove `authorizedIds` filter logic from `findAll` (lines 124-134).

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: May still have errors in route files — fixed in next task

**Step 6: Commit together with Task 7**

```bash
git add src/index.ts src/notes/pg-repository.ts src/notes/schemas.ts src/posts/pg-repository.ts src/media/pg-repository.ts
git commit -m "refactor: remove Keycloak adapter from repositories, wire up authorization module"
```

---

### Task 9: Update Route Files to Use `authorize` Middleware

**Files:**
- Modify: `src/notes/routes/routes.ts`
- Modify: `src/posts/routes/routes.ts`
- Modify: `src/series/routes/routes.ts`

**Step 1: Update `src/notes/routes/routes.ts`**

Replace `canAccessMiddleware` import with `authorize` parameter. The router function now receives the authorize factory.

```typescript
// src/notes/routes/routes.ts
import { Router } from 'express';
import { InputSchema as ListFilterSchema, noteListEndpoint } from './noteList.endpoint';
import { validate } from '../../utils/validate.middleware';
import type { NoteService } from '../service';
import { noteCreateEndpoint } from './noteCreate.endpoint';
import { CreateNoteInput, UpdateNoteInput } from '../schemas';
import { noteFetchEndpoint, NoteFetchParamsInput } from './noteFetch.endpoint';
import { noteUpdateEndpoint, NoteUpdateParamsInput } from './noteUpdate.endpoint';
import { noteDeleteEndpoint, NoteDeleteParamsInput } from './noteDelete.endpoint';
import { jwtVerify } from 'jose';
import { validateToken } from '../../utils/validate-token.middleware';
import { createCacheRepository } from '../../cache';
import { cacheResponseMiddleware } from '../../middleware/cache-response.middleware/cache-response.middleware';
import { keyGenerator } from '../../middleware/key-generator.middleware';
import { extractFiltersMiddleware } from '../../middleware/extract-filters.middleware';
import type { AuthorizeOptions } from '../../authorization';

export const notesRouter = (service: NoteService, authorize?: (options: AuthorizeOptions) => any) => {
  const router = Router();
  const cacheRepo = createCacheRepository();
  const { IAM_ENDPOINT, IAM_REALM } = process.env;
  const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

  router.get('/:noteId', [
    tokenVerifier(),
    validate(NoteFetchParamsInput, 'params'),
    ...(authorize ? [authorize({ resource: 'note', action: 'read' })] : []),
  ], noteFetchEndpoint(service));

  router.put('/:noteId', [
    tokenVerifier(),
    validate(NoteUpdateParamsInput, 'params'),
    validate(UpdateNoteInput, 'body'),
    ...(authorize ? [authorize({ resource: 'note', action: 'update' })] : []),
  ], noteUpdateEndpoint(service));

  router.delete('/:noteId', [
    tokenVerifier(),
    validate(NoteDeleteParamsInput, 'params'),
    ...(authorize ? [authorize({ resource: 'note', action: 'delete' })] : []),
  ], noteDeleteEndpoint(service));

  router.get('/', [
    tokenVerifier(),
    validate(ListFilterSchema, 'query'),
    extractFiltersMiddleware(ListFilterSchema, 'query'),
    keyGenerator('note', true),
    cacheResponseMiddleware(cacheRepo),
  ], noteListEndpoint(service, cacheRepo));

  router.post('/', [
    tokenVerifier(),
    validate(CreateNoteInput),
  ], noteCreateEndpoint(service));

  return router;
};
```

Key changes:
- Removed `canAccessMiddleware` import
- Added `authorize` parameter to router function
- Note list no longer uses `canAccessMiddleware` — filtering happens by `ownerId` in the endpoint
- Note create no longer needs authorization middleware (any authenticated user can create)
- Note fetch/update/delete now use `authorize` for ownership checks

**Step 2: Update `src/notes/routes/noteList.endpoint.ts`**

Replace `authorizedIds` with `ownerId`-based filtering (lines 105-159):

Change the filter construction to use `ownerId` from the JWT instead of `req['ids']`:

```typescript
// Replace line 109:
// const authorizedIds = req['ids'] ?? [];
const userId = (req as any)['user']?.[1]?.payload?.sub || '';

// Replace lines 111-118:
const filters: NoteFilters = {
  ownerId: userId,
  title,
  content,
  startDate,
  endDate,
};
```

**Step 3: Update `src/notes/pg-repository.ts` `findAll` method**

Replace `authorizedIds` filter with `ownerId` filter (lines 107-190):

In the filter conditions block, replace:
```typescript
// DELETE the authorizedIds block (lines 121-132)

// ADD ownerId filter:
if (filters.ownerId) {
  conditions.push(`owner_id = $${values.length + 1}`);
  values.push(filters.ownerId);
}
```

**Step 4: Update `src/posts/routes/routes.ts`**

Remove `canAccessMiddleware` import (line 8). Add `authorize` parameter. Replace `canAccessMiddleware` in post create (lines 75-78):

```typescript
export const postsRouter = (service: PostService, seriesService: SeriesService, authorize?: (options: AuthorizeOptions) => any) => {
  // ... existing setup ...

  // Post create — replace canAccessMiddleware
  router.post('/', [
    tokenVerifier(),
    validate(CreatePostInput),
    ...(authorize ? [authorize({ resource: 'post', action: 'create' })] : []),
  ], postCreateEndpoint(service));

  return router;
};
```

**Step 5: Update `src/series/routes/routes.ts`**

Remove `canAccessMiddleware` import (line 5). Add `authorize` parameter. Replace `canAccessMiddleware` in devotional create (lines 22-26):

```typescript
export const devotionalRouter = (service: SeriesService, authorize?: (options: AuthorizeOptions) => any) => {
  // ... existing setup ...

  router.post('/', [
    tokenVerifier(),
    validate(CreateSeriesInput),
    ...(authorize ? [authorize({ resource: 'series', action: 'create' })] : []),
  ], devotionalCreateEndpoint(service));

  return router;
};
```

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS (or remaining issues from post filter schemas — check and fix)

**Step 7: Commit**

```bash
git add src/notes/routes/routes.ts src/notes/routes/noteList.endpoint.ts src/notes/pg-repository.ts src/posts/routes/routes.ts src/series/routes/routes.ts
git commit -m "refactor: replace canAccessMiddleware with authorize in all route files"
```

---

### Task 10: Remove `authorizedIds` from Post and Church Schemas/Repositories

**Files:**
- Modify: `src/posts/schemas.ts` — remove `authorizedIds` from `PostFilters`
- Modify: `src/posts/pg-repository.ts` — remove `authorizedIds` filter logic from `findAll`
- Modify: `src/churches/schemas.ts` — remove `authorizedIds` from `ChurchFilters` (line 105)
- Modify: `src/churches/postgres-repository.ts` — remove `authorizedIds` filter logic from `findAll` (lines 179-187)
- Modify: `src/media/pg-repository.ts` — remove `authorizedIds` filter logic (already done in Task 8 if not)

**Step 1: Remove `authorizedIds` from schemas**

In each schema file, remove the `authorizedIds` field from the filter schemas.

**Step 2: Remove `authorizedIds` filter blocks from repository `findAll` methods**

In each repository, remove the `if (filters.authorizedIds)` conditional blocks.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/posts/schemas.ts src/posts/pg-repository.ts src/churches/schemas.ts src/churches/postgres-repository.ts src/media/pg-repository.ts
git commit -m "refactor: remove authorizedIds from schemas and repositories"
```

---

### Task 11: Delete Keycloak and Outbox Files

**Files:**
- Delete: `src/keycloak/admin-client.ts`
- Delete: `src/keycloak/resource-manager.ts`
- Delete: `src/keycloak/outbox.publisher.ts`
- Delete: `src/keycloak/resource-adapters.ts`
- Delete: `src/keycloak/generalized-outbox.adapter.ts`
- Delete: `src/keycloak/setup.ts`
- Delete: `src/keycloak/types.ts`
- Delete: `src/middleware/get-authorized-ids.middleware/` (directory)
- Delete: `src/outbox/` (directory)
- Modify: `src/utils/errors.ts` — remove `KeycloakAuthError` class (lines 130-135)

**Step 1: Delete files**

```bash
rm -rf src/keycloak/
rm -rf src/middleware/get-authorized-ids.middleware/
rm -rf src/outbox/
```

**Step 2: Remove `KeycloakAuthError` from `src/utils/errors.ts`**

Delete lines 130-135:
```typescript
// DELETE:
export class KeycloakAuthError extends AppError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode);
    this.name = 'KeycloakAuthError';
  }
}
```

**Step 3: Delete outbox tests**

```bash
rm -rf src/tests/outbox/
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS — no remaining references to deleted files

If there are remaining references, fix them (likely in `src/utils/error-code.factory.ts` or other files that import `KeycloakAuthError`).

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete Keycloak authorization and outbox modules"
```

---

### Task 12: Run All Tests, Fix Failures

**Files:**
- Potentially modify: any test files that reference keycloak adapter mocks

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: Some existing tests may fail due to removed keycloak adapter constructor params

**Step 2: Fix test failures**

Common fixes:
- Tests that mock `PostgresNoteRepository`, `PostgresPostRepository`, or `PostgresMediaRepository` need their constructor mocks updated (remove keycloakAdapter argument)
- Tests referencing `canAccessMiddleware` need to be updated or removed
- Tests importing from `src/keycloak/` or `src/outbox/` need to be deleted

**Step 3: Run tests again**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "test: fix tests after Keycloak authorization removal"
```

---

### Task 13: Clean Up Environment Variables

**Files:**
- Modify: `.env` — remove `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`
- Modify: `k8s/base/configmap.yaml` — remove Keycloak client vars if present
- Modify: `docker-compose.yml` — remove Keycloak client env vars if passed to containers

**Step 1: Remove from `.env`**

Remove lines containing `KEYCLOAK_CLIENT_ID` and `KEYCLOAK_CLIENT_SECRET`.

Keep `IAM_ENDPOINT` and `IAM_REALM` — still needed for JWT validation.

**Step 2: Check and update k8s configs**

Search for `KEYCLOAK_CLIENT` in k8s files and remove references.

**Step 3: Commit**

```bash
git add .env k8s/ docker-compose.yml
git commit -m "chore: remove Keycloak client credentials from environment config"
```

---

### Task 14: Final Verification

**Step 1: Full TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: PASS with zero errors

**Step 2: Full test suite**

Run: `npx vitest run`
Expected: ALL PASS

**Step 3: Verify no remaining Keycloak authorization references**

Run: `grep -r "keycloakAdapter\|canAccessMiddleware\|enqueueResource\|outbox\.processDue\|KEYCLOAK_CLIENT" src/ --include="*.ts" -l`
Expected: No files returned

**Step 4: Verify authorization module is complete**

Check all files exist:
- `src/authorization/types.ts`
- `src/authorization/policies.ts`
- `src/authorization/resolvers.ts`
- `src/authorization/authorize.middleware.ts`
- `src/authorization/index.ts`

**Step 5: Final commit if any remaining fixes**

```bash
git add -A
git commit -m "chore: final cleanup for role management migration"
```
