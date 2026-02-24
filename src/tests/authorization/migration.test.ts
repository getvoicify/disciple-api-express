import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Migration 018 - Role Management', () => {
  const migrationPath = resolve(__dirname, '../../../migrations/018_role_management_migration.sql');

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
