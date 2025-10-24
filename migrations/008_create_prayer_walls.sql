-- Create prayer_walls table
CREATE TABLE IF NOT EXISTS prayer_walls
(
    id                      UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    church_id               UUID                     NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
    name                    VARCHAR(255)             NOT NULL,
    description             TEXT,
    created_by              UUID                     NOT NULL,
    is_private              BOOLEAN                  NOT NULL DEFAULT FALSE,
    has_restricted_access   BOOLEAN                  NOT NULL DEFAULT FALSE,
    schedule                JSONB,
    video_call_link         VARCHAR(500),
    status                  VARCHAR(50)              NOT NULL DEFAULT 'active',
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMP WITH TIME ZONE,
    CONSTRAINT check_status CHECK (status IN ('active', 'archived')),
    CONSTRAINT check_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 255),
    CONSTRAINT check_description_length CHECK (description IS NULL OR char_length(description) <= 5000),
    CONSTRAINT check_video_call_link_length CHECK (video_call_link IS NULL OR char_length(video_call_link) <= 500)
);

-- Create indexes for better query performance
CREATE INDEX idx_prayer_walls_church_id ON prayer_walls (church_id);
CREATE INDEX idx_prayer_walls_created_by ON prayer_walls (created_by);
CREATE INDEX idx_prayer_walls_created_at ON prayer_walls (created_at DESC);
CREATE INDEX idx_prayer_walls_deleted_at ON prayer_walls (deleted_at);
CREATE INDEX idx_prayer_walls_status ON prayer_walls (status);

-- Create GIN index for JSONB schedule field
CREATE INDEX idx_prayer_walls_schedule ON prayer_walls USING GIN (schedule);

-- Create trigger to automatically update updated_at for prayer_walls
CREATE TRIGGER update_prayer_walls_updated_at
    BEFORE UPDATE
    ON prayer_walls
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments to table and columns
COMMENT ON TABLE prayer_walls IS 'Prayer walls for church communities where members can submit and respond to prayer requests';
COMMENT ON COLUMN prayer_walls.church_id IS 'Foreign key to churches table - identifies which church owns this prayer wall';
COMMENT ON COLUMN prayer_walls.name IS 'Display name of the prayer wall (e.g., "Youth Prayers", "Healing", "Peniel Hour")';
COMMENT ON COLUMN prayer_walls.description IS 'Optional description providing context about the prayer wall purpose';
COMMENT ON COLUMN prayer_walls.created_by IS 'UUID of the user (pastor/admin) who created this prayer wall';
COMMENT ON COLUMN prayer_walls.is_private IS 'If true, wall is only visible to invited members; if false, visible to all church members';
COMMENT ON COLUMN prayer_walls.has_restricted_access IS 'If true, membership is invitation-only; if false, members can join freely';
COMMENT ON COLUMN prayer_walls.schedule IS 'JSONB object containing recurring meeting schedule: {frequency, day, time, timezone, duration_minutes}';
COMMENT ON COLUMN prayer_walls.video_call_link IS 'External video call URL for virtual prayer meetings';
COMMENT ON COLUMN prayer_walls.status IS 'Wall status: active (normal operation) or archived (soft-archived/hidden)';
COMMENT ON COLUMN prayer_walls.created_at IS 'Timestamp when the prayer wall was created';
COMMENT ON COLUMN prayer_walls.updated_at IS 'Timestamp when the prayer wall was last updated (auto-updated by trigger)';
COMMENT ON COLUMN prayer_walls.deleted_at IS 'Soft delete timestamp - if set, wall is considered deleted but data retained for audit';