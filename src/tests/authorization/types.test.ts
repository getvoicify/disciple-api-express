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
