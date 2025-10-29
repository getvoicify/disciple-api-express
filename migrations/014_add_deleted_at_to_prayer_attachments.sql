-- Migration: Add deleted_at column to prayer_attachments table
-- Description: Adds soft delete support for prayer attachments

ALTER TABLE prayer_attachments
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Create index for deleted_at to optimize queries that filter on soft-deleted records
CREATE INDEX idx_prayer_attachments_deleted_at ON prayer_attachments(deleted_at);

-- Add comment for the new column
COMMENT ON COLUMN prayer_attachments.deleted_at IS 'Soft delete timestamp - NULL means attachment is active, non-NULL means attachment has been deleted';
