-- Migration: Create series table for devotional series
-- Description: Creates the series table to support devotional series functionality
-- Author: Claude Code
-- Date: 2025-01-XX

-- Create series table
CREATE TABLE IF NOT EXISTS series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image TEXT,
    author_id UUID NOT NULL,
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_series_author_id ON series (author_id);
CREATE INDEX idx_series_church_id ON series (church_id);
CREATE INDEX idx_series_status ON series (status);
CREATE INDEX idx_series_published_at ON series (published_at DESC);
CREATE INDEX idx_series_created_at ON series (created_at DESC);

-- Create trigger for auto-updating updated_at column
CREATE TRIGGER update_series_updated_at
    BEFORE UPDATE
    ON series
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraint to posts table
ALTER TABLE posts
    ADD CONSTRAINT fk_posts_series
        FOREIGN KEY (series_id)
            REFERENCES series(id)
            ON DELETE SET NULL;

-- Add table and column comments for documentation
COMMENT ON TABLE series IS 'Stores devotional series created by church owners and managers';
COMMENT ON COLUMN series.status IS 'Status of the series: draft (not visible to members) or published (visible to all church members)';
COMMENT ON COLUMN series.description IS 'Detailed description of the devotional series purpose and content';
COMMENT ON COLUMN series.image IS 'URL to the series cover image';
COMMENT ON COLUMN series.published_at IS 'Timestamp when the series was first published (set automatically when status changes to published)';
