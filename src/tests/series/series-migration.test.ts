import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Series Database Migration', () => {
  const migrationPath = join(process.cwd(), 'migrations', '006_create_series_table.sql');

  it('should have series table migration file', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('should create series table with required columns', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for table creation
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS series');

    // Check for required columns
    expect(migrationContent).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(migrationContent).toContain('title VARCHAR(255) NOT NULL');
    expect(migrationContent).toContain('description TEXT NOT NULL');
    expect(migrationContent).toContain('image TEXT');
    expect(migrationContent).toContain('author_id UUID NOT NULL');
    expect(migrationContent).toContain('church_id UUID NOT NULL');
    expect(migrationContent).toContain('status VARCHAR(50) NOT NULL DEFAULT \'draft\'');
    expect(migrationContent).toContain('published_at TIMESTAMP WITH TIME ZONE');
    expect(migrationContent).toContain('created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()');
    expect(migrationContent).toContain('updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()');
  });

  it('should create proper indexes for series table', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for performance indexes
    expect(migrationContent).toContain('CREATE INDEX idx_series_author_id ON series (author_id)');
    expect(migrationContent).toContain('CREATE INDEX idx_series_church_id ON series (church_id)');
    expect(migrationContent).toContain('CREATE INDEX idx_series_status ON series (status)');
    expect(migrationContent).toContain('CREATE INDEX idx_series_published_at ON series (published_at DESC)');
    expect(migrationContent).toContain('CREATE INDEX idx_series_created_at ON series (created_at DESC)');
  });

  it('should include updated_at trigger for series table', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for trigger creation (reusing existing function)
    expect(migrationContent).toContain('CREATE TRIGGER update_series_updated_at');
    expect(migrationContent).toContain('BEFORE UPDATE');
    expect(migrationContent).toContain('ON series');
    expect(migrationContent).toContain('FOR EACH ROW');
    expect(migrationContent).toContain('EXECUTE FUNCTION update_updated_at_column()');
  });

  it('should include proper constraints', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for status constraint
    expect(migrationContent).toContain('CHECK (status IN (\'draft\', \'published\'))');

    // Check for foreign key to churches
    expect(migrationContent).toContain('REFERENCES churches');
  });

  it('should add foreign key to posts table', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check that posts.series_id references series.id
    expect(migrationContent).toContain('ALTER TABLE posts');
    expect(migrationContent).toContain('ADD CONSTRAINT fk_posts_series');
    expect(migrationContent).toContain('FOREIGN KEY (series_id)');
    expect(migrationContent).toContain('REFERENCES series(id)');
    expect(migrationContent).toContain('ON DELETE SET NULL');
  });

  it('should include proper table and column comments', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for documentation comments
    expect(migrationContent).toContain("COMMENT ON TABLE series IS");
    expect(migrationContent).toContain("COMMENT ON COLUMN series.status IS");
    expect(migrationContent).toContain("COMMENT ON COLUMN series.description IS");
  });
});