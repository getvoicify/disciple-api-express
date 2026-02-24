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
