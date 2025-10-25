-- Create prayer_requests table with threading support
CREATE TABLE IF NOT EXISTS prayer_requests
(
    id                UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    wall_id           UUID                     NOT NULL REFERENCES prayer_walls (id) ON DELETE CASCADE,
    author_id         UUID                     NOT NULL,
    content           TEXT                     NOT NULL,
    anonymity_level   VARCHAR(50)              NOT NULL DEFAULT 'identified',
    parent_id         UUID                              REFERENCES prayer_requests (id) ON DELETE CASCADE,
    thread_depth      INTEGER                  NOT NULL DEFAULT 0,
    has_attachment    BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMP WITH TIME ZONE,
    deleted_by        UUID,
    CONSTRAINT check_anonymity_level CHECK (anonymity_level IN ('identified', 'anonymous_to_members', 'fully_anonymous')),
    CONSTRAINT check_thread_depth CHECK (thread_depth BETWEEN 0 AND 3),
    CONSTRAINT check_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 10000)
);

-- Create prayer_wall_memberships table
CREATE TABLE IF NOT EXISTS prayer_wall_memberships
(
    id         UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    wall_id    UUID                     NOT NULL REFERENCES prayer_walls (id) ON DELETE CASCADE,
    user_id    UUID                     NOT NULL,
    joined_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    invited_by UUID,
    left_at    TIMESTAMP WITH TIME ZONE,
    is_banned  BOOLEAN                  NOT NULL DEFAULT FALSE,
    banned_at  TIMESTAMP WITH TIME ZONE,
    banned_by  UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for prayer_requests
CREATE INDEX idx_prayer_requests_wall_id ON prayer_requests (wall_id);
CREATE INDEX idx_prayer_requests_author_id ON prayer_requests (author_id);
CREATE INDEX idx_prayer_requests_parent_id ON prayer_requests (parent_id);
CREATE INDEX idx_prayer_requests_deleted_at ON prayer_requests (deleted_at);
CREATE INDEX idx_prayer_requests_created_at ON prayer_requests (created_at DESC);
CREATE INDEX idx_prayer_requests_anonymity_level ON prayer_requests (anonymity_level);

-- Create composite index for efficient thread queries
CREATE INDEX idx_prayer_requests_wall_created ON prayer_requests (wall_id, created_at DESC);
CREATE INDEX idx_prayer_requests_thread ON prayer_requests (parent_id, thread_depth, created_at);

-- Create indexes for prayer_wall_memberships
CREATE INDEX idx_prayer_wall_memberships_wall_id ON prayer_wall_memberships (wall_id);
CREATE INDEX idx_prayer_wall_memberships_user_id ON prayer_wall_memberships (user_id);
CREATE INDEX idx_prayer_wall_memberships_is_banned ON prayer_wall_memberships (is_banned);
CREATE INDEX idx_prayer_wall_memberships_left_at ON prayer_wall_memberships (left_at);

-- Create composite index for efficient membership checks
CREATE INDEX idx_prayer_wall_memberships_wall_user ON prayer_wall_memberships (wall_id, user_id);

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_prayer_requests_updated_at
    BEFORE UPDATE
    ON prayer_requests
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prayer_wall_memberships_updated_at
    BEFORE UPDATE
    ON prayer_wall_memberships
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments to prayer_requests table
COMMENT ON TABLE prayer_requests IS 'Prayer requests submitted to prayer walls with threading support and anonymity options';
COMMENT ON COLUMN prayer_requests.wall_id IS 'Foreign key to prayer_walls - identifies which wall this prayer belongs to';
COMMENT ON COLUMN prayer_requests.author_id IS 'UUID of the user who submitted this prayer request';
COMMENT ON COLUMN prayer_requests.content IS 'The actual prayer request text content';
COMMENT ON COLUMN prayer_requests.anonymity_level IS 'Privacy level: identified (default), anonymous_to_members (pastors see identity), fully_anonymous (complete anonymity)';
COMMENT ON COLUMN prayer_requests.parent_id IS 'Self-referential foreign key for threading - references parent prayer request, NULL for root prayers';
COMMENT ON COLUMN prayer_requests.thread_depth IS 'Computed depth in thread hierarchy: 0 (root), 1 (response), 2 (reply), 3 (max depth)';
COMMENT ON COLUMN prayer_requests.has_attachment IS 'Indicates if this prayer has file attachments';
COMMENT ON COLUMN prayer_requests.created_at IS 'Timestamp when the prayer was submitted';
COMMENT ON COLUMN prayer_requests.updated_at IS 'Timestamp when the prayer was last updated (auto-updated by trigger)';
COMMENT ON COLUMN prayer_requests.deleted_at IS 'Soft delete timestamp - if set, prayer is considered deleted but retained for audit (2-year retention)';
COMMENT ON COLUMN prayer_requests.deleted_by IS 'UUID of the user who deleted this prayer (author or pastor)';

-- Add comments to prayer_wall_memberships table
COMMENT ON TABLE prayer_wall_memberships IS 'Tracks membership in prayer walls including join/leave history, invitations, and bans';
COMMENT ON COLUMN prayer_wall_memberships.wall_id IS 'Foreign key to prayer_walls - identifies which wall the user is a member of';
COMMENT ON COLUMN prayer_wall_memberships.user_id IS 'UUID of the user who is a member of this wall';
COMMENT ON COLUMN prayer_wall_memberships.joined_at IS 'Timestamp when the user joined this prayer wall';
COMMENT ON COLUMN prayer_wall_memberships.invited_by IS 'UUID of the user who invited this member (NULL if joined voluntarily)';
COMMENT ON COLUMN prayer_wall_memberships.left_at IS 'Timestamp when the user left this wall (NULL if currently a member) - allows tracking rejoin history';
COMMENT ON COLUMN prayer_wall_memberships.is_banned IS 'Indicates if the user is banned from this wall';
COMMENT ON COLUMN prayer_wall_memberships.banned_at IS 'Timestamp when the user was banned (NULL if not banned)';
COMMENT ON COLUMN prayer_wall_memberships.banned_by IS 'UUID of the pastor/admin who banned this user';
COMMENT ON COLUMN prayer_wall_memberships.created_at IS 'Timestamp when this membership record was created';
COMMENT ON COLUMN prayer_wall_memberships.updated_at IS 'Timestamp when this membership was last updated (auto-updated by trigger)';