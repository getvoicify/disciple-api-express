import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Posts Database Migration', () => {
  const migrationPath = join(process.cwd(), 'migrations', '005_create_posts_table.sql');

  it('should have posts table migration file', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('should create posts table with required columns', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for table creation
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS posts');

    // Check for required columns
    expect(migrationContent).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(migrationContent).toContain('title VARCHAR(255) NOT NULL');
    expect(migrationContent).toContain('content TEXT NOT NULL');
    expect(migrationContent).toContain('author_id UUID NOT NULL');
    expect(migrationContent).toContain('church_id UUID NOT NULL');
    expect(migrationContent).toContain('status VARCHAR(50) NOT NULL DEFAULT \'draft\'');
    expect(migrationContent).toContain('published_at TIMESTAMP WITH TIME ZONE');
    expect(migrationContent).toContain('image TEXT');
    expect(migrationContent).toContain('tags JSONB DEFAULT \'[]\'::jsonb');
    expect(migrationContent).toContain('categories JSONB DEFAULT \'[]\'::jsonb');
    expect(migrationContent).toContain('scripture_references JSONB DEFAULT \'[]\'::jsonb');
    expect(migrationContent).toContain('series_id UUID');
    expect(migrationContent).toContain('series_name VARCHAR(255)');
    expect(migrationContent).toContain('created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()');
    expect(migrationContent).toContain('updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()');
  });

  it('should create proper indexes for posts table', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for performance indexes
    expect(migrationContent).toContain('CREATE INDEX idx_posts_author_id ON posts (author_id)');
    expect(migrationContent).toContain('CREATE INDEX idx_posts_church_id ON posts (church_id)');
    expect(migrationContent).toContain('CREATE INDEX idx_posts_status ON posts (status)');
    expect(migrationContent).toContain('CREATE INDEX idx_posts_published_at ON posts (published_at DESC)');
    expect(migrationContent).toContain('CREATE INDEX idx_posts_series_id ON posts (series_id)');
    expect(migrationContent).toContain('CREATE INDEX idx_posts_created_at ON posts (created_at DESC)');

    // Check for GIN indexes on JSONB columns
    expect(migrationContent).toContain('CREATE INDEX idx_posts_tags ON posts USING GIN (tags)');
    expect(migrationContent).toContain('CREATE INDEX idx_posts_categories ON posts USING GIN (categories)');
    expect(migrationContent).toContain('CREATE INDEX idx_posts_scripture_references ON posts USING GIN (scripture_references)');
  });

  it('should include updated_at trigger for posts table', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for trigger creation (reusing existing function)
    expect(migrationContent).toContain('CREATE TRIGGER update_posts_updated_at');
    expect(migrationContent).toContain('BEFORE UPDATE');
    expect(migrationContent).toContain('ON posts');
    expect(migrationContent).toContain('FOR EACH ROW');
    expect(migrationContent).toContain('EXECUTE FUNCTION update_updated_at_column()');
  });

  it('should include proper constraints', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for status constraint
    expect(migrationContent).toContain('CHECK (status IN (\'draft\', \'published\'))');

    // Check for foreign key to church_members or churches
    expect(migrationContent).toMatch(/REFERENCES (churches|church_members)/);
  });

  it('should include proper table and column comments', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for documentation comments
    expect(migrationContent).toContain("COMMENT ON TABLE posts IS");
    expect(migrationContent).toContain("COMMENT ON COLUMN posts.status IS");
    expect(migrationContent).toContain("COMMENT ON COLUMN posts.scripture_references IS");
  });
});