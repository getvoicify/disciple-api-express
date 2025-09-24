import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Media Database Migration', () => {
  const migrationPath = join(process.cwd(), 'migrations', '004_create_media_table.sql');

  it('should have media table migration file', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('should create media table with required columns', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for table creation
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS media');

    // Check for required columns
    expect(migrationContent).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(migrationContent).toContain('filename VARCHAR(255) NOT NULL');
    expect(migrationContent).toContain('original_filename VARCHAR(255) NOT NULL');
    expect(migrationContent).toContain('mime_type VARCHAR(100) NOT NULL');
    expect(migrationContent).toContain('file_size BIGINT NOT NULL');
    expect(migrationContent).toContain('r2_url TEXT NOT NULL');
    expect(migrationContent).toContain('r2_key TEXT NOT NULL UNIQUE');
    expect(migrationContent).toContain('uploaded_by UUID NOT NULL');
    expect(migrationContent).toContain('created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()');
    expect(migrationContent).toContain('updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()');
  });

  it('should create proper indexes for media table', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for performance indexes
    expect(migrationContent).toContain('CREATE INDEX idx_media_uploaded_by ON media (uploaded_by)');
    expect(migrationContent).toContain('CREATE INDEX idx_media_created_at ON media (created_at DESC)');
    expect(migrationContent).toContain('CREATE INDEX idx_media_mime_type ON media (mime_type)');
    expect(migrationContent).toContain('CREATE UNIQUE INDEX idx_media_r2_key ON media (r2_key)');
  });

  it('should include updated_at trigger for media table', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for trigger creation (reusing existing function)
    expect(migrationContent).toContain('CREATE TRIGGER update_media_updated_at');
    expect(migrationContent).toContain('BEFORE UPDATE');
    expect(migrationContent).toContain('ON media');
    expect(migrationContent).toContain('FOR EACH ROW');
    expect(migrationContent).toContain('EXECUTE FUNCTION update_updated_at_column()');
  });

  it('should include proper table and column comments', () => {
    const migrationContent = readFileSync(migrationPath, 'utf8');

    // Check for documentation comments
    expect(migrationContent).toContain("COMMENT ON TABLE media IS");
    expect(migrationContent).toContain("COMMENT ON COLUMN media.r2_url IS");
    expect(migrationContent).toContain("COMMENT ON COLUMN media.r2_key IS");
  });
});