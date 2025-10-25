-- Create flagged_content table for moderation workflow
CREATE TABLE IF NOT EXISTS flagged_content
(
    id                 UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    prayer_request_id  UUID                     NOT NULL REFERENCES prayer_requests (id) ON DELETE CASCADE,
    flagged_by         UUID                     NOT NULL,
    reason             TEXT                     NOT NULL,
    status             VARCHAR(50)              NOT NULL DEFAULT 'pending',
    reviewed_by        UUID,
    reviewed_at        TIMESTAMP WITH TIME ZONE,
    resolution_action  VARCHAR(50),
    resolution_notes   TEXT,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_flagged_content_status CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
    CONSTRAINT check_resolution_action CHECK (resolution_action IN ('delete', 'restore', 'warn', 'ban') OR resolution_action IS NULL)
);

-- Create prayer_read_receipts table
CREATE TABLE IF NOT EXISTS prayer_read_receipts
(
    id                 UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    prayer_request_id  UUID                     NOT NULL REFERENCES prayer_requests (id) ON DELETE CASCADE,
    user_id            UUID                     NOT NULL,
    read_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_prayer_read_receipt UNIQUE (prayer_request_id, user_id)
);

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences
(
    id                         UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    user_id                    UUID                     NOT NULL,
    wall_id                    UUID                              REFERENCES prayer_walls (id) ON DELETE CASCADE,
    new_prayers                BOOLEAN                  NOT NULL DEFAULT TRUE,
    responses_to_my_prayers    BOOLEAN                  NOT NULL DEFAULT TRUE,
    replies_to_my_responses    BOOLEAN                  NOT NULL DEFAULT TRUE,
    wall_invitations           BOOLEAN                  NOT NULL DEFAULT TRUE,
    moderation_actions         BOOLEAN                  NOT NULL DEFAULT TRUE,
    created_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_wall_preferences UNIQUE (user_id, wall_id)
);

-- Create indexes for flagged_content
CREATE INDEX idx_flagged_content_prayer_request_id ON flagged_content (prayer_request_id);
CREATE INDEX idx_flagged_content_flagged_by ON flagged_content (flagged_by);
CREATE INDEX idx_flagged_content_status ON flagged_content (status);

-- Create indexes for prayer_read_receipts
CREATE INDEX idx_prayer_read_receipts_prayer_request_id ON prayer_read_receipts (prayer_request_id);
CREATE INDEX idx_prayer_read_receipts_user_id ON prayer_read_receipts (user_id);
CREATE INDEX idx_prayer_read_receipts_composite ON prayer_read_receipts (prayer_request_id, user_id);

-- Create indexes for notification_preferences
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences (user_id);
CREATE INDEX idx_notification_preferences_wall_id ON notification_preferences (wall_id);
CREATE INDEX idx_notification_preferences_composite ON notification_preferences (user_id, wall_id);

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_flagged_content_updated_at
    BEFORE UPDATE
    ON flagged_content
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE
    ON notification_preferences
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments to flagged_content table
COMMENT ON TABLE flagged_content IS 'Tracks flagged prayer requests for moderation with workflow states (pending → reviewed/dismissed/actioned)';
COMMENT ON COLUMN flagged_content.prayer_request_id IS 'Foreign key to prayer_requests - identifies which prayer was flagged';
COMMENT ON COLUMN flagged_content.flagged_by IS 'UUID of the user who flagged this content';
COMMENT ON COLUMN flagged_content.reason IS 'Text description of why the content was flagged';
COMMENT ON COLUMN flagged_content.status IS 'Workflow status: pending (awaiting review), reviewed (pastor reviewed), dismissed (no action needed), actioned (action taken)';
COMMENT ON COLUMN flagged_content.reviewed_by IS 'UUID of the pastor/admin who reviewed this flag (NULL if not reviewed yet)';
COMMENT ON COLUMN flagged_content.reviewed_at IS 'Timestamp when the flag was reviewed (NULL if not reviewed yet)';
COMMENT ON COLUMN flagged_content.resolution_action IS 'Action taken during review: delete (content deleted), restore (false flag), warn (warning issued), ban (user banned), NULL (no action)';
COMMENT ON COLUMN flagged_content.resolution_notes IS 'Pastor notes explaining the resolution decision';
COMMENT ON COLUMN flagged_content.created_at IS 'Timestamp when the content was flagged';
COMMENT ON COLUMN flagged_content.updated_at IS 'Timestamp when the flag record was last updated (auto-updated by trigger)';

-- Add comments to prayer_read_receipts table
COMMENT ON TABLE prayer_read_receipts IS 'Tracks which users have read which prayer requests for read receipt functionality';
COMMENT ON COLUMN prayer_read_receipts.prayer_request_id IS 'Foreign key to prayer_requests - identifies which prayer was read';
COMMENT ON COLUMN prayer_read_receipts.user_id IS 'UUID of the user who read this prayer';
COMMENT ON COLUMN prayer_read_receipts.read_at IS 'Timestamp when the user first read this prayer';
COMMENT ON COLUMN prayer_read_receipts.created_at IS 'Timestamp when the read receipt record was created';

-- Add comments to notification_preferences table
COMMENT ON TABLE notification_preferences IS 'Per-user, per-wall notification preferences with granular control over 5 notification types';
COMMENT ON COLUMN notification_preferences.user_id IS 'UUID of the user who owns these preferences';
COMMENT ON COLUMN notification_preferences.wall_id IS 'Foreign key to prayer_walls - NULL for global preferences, specific wall ID for per-wall preferences';
COMMENT ON COLUMN notification_preferences.new_prayers IS 'Receive notifications when new prayers are posted to this wall (default: true)';
COMMENT ON COLUMN notification_preferences.responses_to_my_prayers IS 'Receive notifications when someone responds to my prayers (default: true)';
COMMENT ON COLUMN notification_preferences.replies_to_my_responses IS 'Receive notifications when someone replies to my responses (default: true)';
COMMENT ON COLUMN notification_preferences.wall_invitations IS 'Receive notifications when invited to join a wall (default: true)';
COMMENT ON COLUMN notification_preferences.moderation_actions IS 'Receive notifications about moderation actions (pastors only, default: true)';
COMMENT ON COLUMN notification_preferences.created_at IS 'Timestamp when the preferences were created';
COMMENT ON COLUMN notification_preferences.updated_at IS 'Timestamp when the preferences were last updated (auto-updated by trigger)';