-- Create churches table
CREATE TABLE IF NOT EXISTS churches
(
    id                UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    slug              VARCHAR(255) UNIQUE      NOT NULL,
    name              VARCHAR(100)             NOT NULL,
    description       TEXT,
    logo_url          TEXT,
    cover_image_url   TEXT,
    byline            VARCHAR(160),
    mission_statement TEXT,
    address           JSONB,
    latitude          NUMERIC(10, 7),
    longitude         NUMERIC(10, 7),
    email             VARCHAR(255),
    phone_number      VARCHAR(50),
    website_url       TEXT,
    social_links      JSONB                             DEFAULT '{}'::jsonb,
    approval_status   VARCHAR(50)              NOT NULL DEFAULT 'Pending',
    approved_by       UUID,
    approved_at       TIMESTAMP WITH TIME ZONE,
    rejected_by       UUID,
    rejected_at       TIMESTAMP WITH TIME ZONE,
    rejection_reason  TEXT,
    created_by        UUID                     NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version           INTEGER                  NOT NULL DEFAULT 1,
    deleted_at        TIMESTAMP WITH TIME ZONE,
    CONSTRAINT check_approval_status CHECK (approval_status IN ('Pending', 'Approved', 'Rejected')),
    CONSTRAINT check_latitude CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    CONSTRAINT check_longitude CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
    CONSTRAINT check_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
    CONSTRAINT check_description_length CHECK (description IS NULL OR char_length(description) <= 2000),
    CONSTRAINT check_byline_length CHECK (byline IS NULL OR char_length(byline) <= 160),
    CONSTRAINT check_mission_statement_length CHECK (mission_statement IS NULL OR char_length(mission_statement) <= 2000)
);

-- Create church_members table
CREATE TABLE IF NOT EXISTS church_members
(
    id         UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    church_id  UUID                     NOT NULL REFERENCES churches (id) ON DELETE CASCADE,
    user_id    UUID                     NOT NULL,
    role       VARCHAR(50)              NOT NULL DEFAULT 'Member',
    status     VARCHAR(50)              NOT NULL DEFAULT 'Active',
    joined_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    invited_by UUID,
    invited_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT check_role CHECK (role IN ('Owner', 'Manager', 'Member')),
    CONSTRAINT check_status CHECK (status IN ('Active', 'Invited', 'Removed', 'Banned')),
    CONSTRAINT unique_church_user UNIQUE (church_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_churches_slug ON churches (slug);
CREATE INDEX idx_churches_approval_status ON churches (approval_status);
CREATE INDEX idx_churches_created_by ON churches (created_by);
CREATE INDEX idx_churches_name ON churches (name);
CREATE INDEX idx_churches_created_at ON churches (created_at DESC);
CREATE INDEX idx_churches_deleted_at ON churches (deleted_at);

-- Spatial index for location-based queries (if PostGIS is available)
-- CREATE INDEX idx_churches_location ON churches USING GIST (ll_to_earth(latitude, longitude));

-- Create indexes for church_members
CREATE INDEX idx_church_members_church_id ON church_members (church_id);
CREATE INDEX idx_church_members_user_id ON church_members (user_id);
CREATE INDEX idx_church_members_status ON church_members (status);
CREATE INDEX idx_church_members_role ON church_members (role);

-- Create GIN indexes for JSONB fields
CREATE INDEX idx_churches_social_links ON churches USING GIN (social_links);
CREATE INDEX idx_churches_address ON churches USING GIN (address);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_churches_updated_at_column()
    RETURNS TRIGGER AS
$$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at for churches
CREATE TRIGGER update_churches_updated_at
    BEFORE UPDATE
    ON churches
    FOR EACH ROW
EXECUTE FUNCTION update_churches_updated_at_column();

-- Create trigger to automatically update updated_at for church_members
CREATE TRIGGER update_church_members_updated_at
    BEFORE UPDATE
    ON church_members
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments to tables
COMMENT ON TABLE churches IS 'Stores church entities with approval workflow';
COMMENT ON COLUMN churches.slug IS 'Unique URL-safe identifier for the church';
COMMENT ON COLUMN churches.approval_status IS 'Approval workflow status: Pending, Approved, Rejected';
COMMENT ON COLUMN churches.social_links IS 'JSON object with social media URLs {facebook, instagram, twitterX, youtube, tiktok, other[]}';
COMMENT ON COLUMN churches.address IS 'Structured address components in JSON format';
COMMENT ON COLUMN churches.version IS 'Optimistic concurrency control version';

COMMENT ON TABLE church_members IS 'Manages church membership and roles';
COMMENT ON COLUMN church_members.role IS 'Member role: Owner, Manager, Member';
COMMENT ON COLUMN church_members.status IS 'Membership status: Active, Invited, Removed, Banned';