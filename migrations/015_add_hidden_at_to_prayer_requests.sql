-- Add hidden_at column to prayer_requests table for moderation workflow
-- When content is flagged, it is immediately hidden from public view by setting hidden_at
-- Pastors can review and either restore (clear hidden_at) or delete (set deleted_at)

ALTER TABLE prayer_requests
ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient queries filtering hidden content
CREATE INDEX IF NOT EXISTS idx_prayer_requests_hidden_at ON prayer_requests (hidden_at);

-- Add comment explaining the column's purpose
COMMENT ON COLUMN prayer_requests.hidden_at IS 'Timestamp when prayer was hidden from public view due to flagging - NULL if visible, set when flagged, cleared when restored by pastor';
