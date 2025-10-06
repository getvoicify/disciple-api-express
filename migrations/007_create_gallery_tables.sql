-- Migration: Create gallery tables for church media galleries
-- Description: Creates galleries and gallery_items tables to store church photo/video galleries with thumbnail support
-- Author: System
-- Date: 2025-10-03

-- Create galleries table
CREATE TABLE IF NOT EXISTS galleries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_gallery_per_church UNIQUE (church_id)
);

-- Create gallery_items junction table
CREATE TABLE IF NOT EXISTS gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    thumbnail_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_media_per_gallery UNIQUE (gallery_id, media_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_galleries_church_id ON galleries (church_id);
CREATE INDEX idx_gallery_items_gallery_id ON gallery_items (gallery_id);
CREATE INDEX idx_gallery_items_media_id ON gallery_items (media_id);
CREATE INDEX idx_gallery_items_thumbnail_id ON gallery_items (thumbnail_id);
CREATE INDEX idx_gallery_items_created_at ON gallery_items (created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE galleries IS 'Stores church media galleries. Each church can have one gallery.';
COMMENT ON COLUMN galleries.id IS 'Unique identifier for the gallery';
COMMENT ON COLUMN galleries.church_id IS 'UUID of the church this gallery belongs to';
COMMENT ON COLUMN galleries.created_at IS 'Timestamp when the gallery was created';
COMMENT ON COLUMN galleries.updated_at IS 'Timestamp when the gallery was last updated';

COMMENT ON TABLE gallery_items IS 'Junction table linking galleries to media items with thumbnails';
COMMENT ON COLUMN gallery_items.id IS 'Unique identifier for the gallery item';
COMMENT ON COLUMN gallery_items.gallery_id IS 'Reference to the gallery';
COMMENT ON COLUMN gallery_items.media_id IS 'Reference to the original media item';
COMMENT ON COLUMN gallery_items.thumbnail_id IS 'Reference to the thumbnail media item';
COMMENT ON COLUMN gallery_items.created_at IS 'Timestamp when the item was added to the gallery';

-- Create trigger to automatically update updated_at on record updates
CREATE TRIGGER update_galleries_updated_at
    BEFORE UPDATE ON galleries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();