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
