-- Migration: Create posts table for church posts/devotionals
-- Description: Creates posts table for church-authored content with support for series, scripture references, and publishing workflow
-- Author: System
-- Date: 2024-09-30

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL,
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMP WITH TIME ZONE,
    image TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    categories JSONB DEFAULT '[]'::jsonb,
    scripture_references JSONB DEFAULT '[]'::jsonb,
    series_id UUID,
    series_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_status CHECK (status IN ('draft', 'published')),
    CONSTRAINT check_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 255),
    CONSTRAINT check_content_not_empty CHECK (char_length(content) > 0)
);

-- Create indexes for better query performance
CREATE INDEX idx_posts_author_id ON posts (author_id);
CREATE INDEX idx_posts_church_id ON posts (church_id);
CREATE INDEX idx_posts_status ON posts (status);
CREATE INDEX idx_posts_published_at ON posts (published_at DESC);
CREATE INDEX idx_posts_series_id ON posts (series_id);
CREATE INDEX idx_posts_created_at ON posts (created_at DESC);

-- Create GIN indexes for JSONB fields
CREATE INDEX idx_posts_tags ON posts USING GIN (tags);
CREATE INDEX idx_posts_categories ON posts USING GIN (categories);
CREATE INDEX idx_posts_scripture_references ON posts USING GIN (scripture_references);

-- Create full-text search index on content
CREATE INDEX idx_posts_content_fts ON posts USING GIN (to_tsvector('english', content));

-- Create trigger to automatically update updated_at on record updates
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE posts IS 'Stores church posts, devotionals, and series content. Only church owners and managers can create posts.';
COMMENT ON COLUMN posts.id IS 'Unique identifier for the post';
COMMENT ON COLUMN posts.title IS 'Title of the post';
COMMENT ON COLUMN posts.content IS 'Main content of the post';
COMMENT ON COLUMN posts.author_id IS 'UUID of the user who authored the post (must be church owner or manager)';
COMMENT ON COLUMN posts.church_id IS 'UUID of the church this post belongs to';
COMMENT ON COLUMN posts.status IS 'Publishing status: draft or published. Drafts are only visible to the author, published posts are visible to all users.';
COMMENT ON COLUMN posts.published_at IS 'Timestamp when the post was published';
COMMENT ON COLUMN posts.image IS 'URL or reference to the post image';
COMMENT ON COLUMN posts.tags IS 'Array of tags for categorization in JSON format';
COMMENT ON COLUMN posts.categories IS 'Array of categories for organization in JSON format';
COMMENT ON COLUMN posts.scripture_references IS 'Array of scripture references in JSON format [{book: string, chapter: number, verse: number, endVerse?: number}]';
COMMENT ON COLUMN posts.series_id IS 'Optional UUID linking posts in a series/devotional';
COMMENT ON COLUMN posts.series_name IS 'Optional name of the series/devotional this post belongs to';
COMMENT ON COLUMN posts.created_at IS 'Timestamp when the post was created';
COMMENT ON COLUMN posts.updated_at IS 'Timestamp when the post was last updated';