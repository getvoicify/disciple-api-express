-- Migration: Create media table for storing uploaded files metadata
-- Description: Creates media table to store file metadata and Cloudflare R2 URLs
-- Author: System
-- Date: 2024-09-24

-- Create media table
CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    r2_url TEXT NOT NULL,
    r2_key TEXT NOT NULL UNIQUE,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_media_uploaded_by ON media (uploaded_by);
CREATE INDEX idx_media_mime_type ON media (mime_type);
CREATE INDEX idx_media_created_at ON media (created_at DESC);
CREATE UNIQUE INDEX idx_media_r2_key ON media (r2_key);

-- Add comments for documentation
COMMENT ON TABLE media IS 'Stores metadata for uploaded media files stored in Cloudflare R2';
COMMENT ON COLUMN media.id IS 'Unique identifier for the media record';
COMMENT ON COLUMN media.filename IS 'Sanitized filename used in URLs';
COMMENT ON COLUMN media.original_filename IS 'Original filename as uploaded by user';
COMMENT ON COLUMN media.mime_type IS 'MIME type of the uploaded file';
COMMENT ON COLUMN media.file_size IS 'Size of the file in bytes';
COMMENT ON COLUMN media.r2_url IS 'Full URL to access the file from Cloudflare R2';
COMMENT ON COLUMN media.r2_key IS 'Unique key used to store the file in R2 bucket';
COMMENT ON COLUMN media.uploaded_by IS 'UUID of the user who uploaded the file';
COMMENT ON COLUMN media.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN media.updated_at IS 'Timestamp when the record was last updated';

-- Create trigger to automatically update updated_at on record updates
CREATE TRIGGER update_media_updated_at
    BEFORE UPDATE ON media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
