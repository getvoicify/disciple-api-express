-- Create prayer_categories table
CREATE TABLE IF NOT EXISTS prayer_categories
(
    id                  UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    name                VARCHAR(100)             NOT NULL,
    church_id           UUID                              REFERENCES churches (id) ON DELETE CASCADE,
    is_system_category  BOOLEAN                  NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_category_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

-- Create prayer_request_categories table (many-to-many join table)
CREATE TABLE IF NOT EXISTS prayer_request_categories
(
    id                 UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    prayer_request_id  UUID                     NOT NULL REFERENCES prayer_requests (id) ON DELETE CASCADE,
    category_id        UUID                     NOT NULL REFERENCES prayer_categories (id) ON DELETE CASCADE,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_prayer_category UNIQUE (prayer_request_id, category_id)
);

-- Create prayer_attachments table
CREATE TABLE IF NOT EXISTS prayer_attachments
(
    id                 UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    prayer_request_id  UUID                     NOT NULL REFERENCES prayer_requests (id) ON DELETE CASCADE,
    file_name          VARCHAR(255)             NOT NULL,
    file_size          INTEGER                  NOT NULL,
    file_type          VARCHAR(100)             NOT NULL,
    storage_key        VARCHAR(500)             NOT NULL,
    uploaded_by        UUID                     NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_file_size CHECK (file_size > 0 AND file_size <= 10485760),
    CONSTRAINT check_file_name_length CHECK (char_length(file_name) >= 1 AND char_length(file_name) <= 255)
);

-- Create indexes for prayer_categories
CREATE INDEX idx_prayer_categories_church_id ON prayer_categories (church_id);
CREATE INDEX idx_prayer_categories_is_system_category ON prayer_categories (is_system_category);

-- Create indexes for prayer_request_categories
CREATE INDEX idx_prayer_request_categories_prayer_id ON prayer_request_categories (prayer_request_id);
CREATE INDEX idx_prayer_request_categories_category_id ON prayer_request_categories (category_id);
CREATE INDEX idx_prayer_request_categories_composite ON prayer_request_categories (prayer_request_id, category_id);

-- Create indexes for prayer_attachments
CREATE INDEX idx_prayer_attachments_prayer_request_id ON prayer_attachments (prayer_request_id);
CREATE INDEX idx_prayer_attachments_uploaded_by ON prayer_attachments (uploaded_by);

-- Create trigger to automatically update updated_at for prayer_categories
CREATE TRIGGER update_prayer_categories_updated_at
    BEFORE UPDATE
    ON prayer_categories
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments to prayer_categories table
COMMENT ON TABLE prayer_categories IS 'Categories for organizing prayer requests - includes both system-wide and church-specific categories';
COMMENT ON COLUMN prayer_categories.name IS 'Category name (e.g., Healing, Guidance, Thanksgiving)';
COMMENT ON COLUMN prayer_categories.church_id IS 'Foreign key to churches - NULL for system categories, specific church ID for custom categories';
COMMENT ON COLUMN prayer_categories.is_system_category IS 'Indicates if this is a system-wide category (true) or church-specific custom category (false)';
COMMENT ON COLUMN prayer_categories.created_at IS 'Timestamp when the category was created';
COMMENT ON COLUMN prayer_categories.updated_at IS 'Timestamp when the category was last updated (auto-updated by trigger)';

-- Add comments to prayer_request_categories table
COMMENT ON TABLE prayer_request_categories IS 'Many-to-many junction table linking prayer requests to categories';
COMMENT ON COLUMN prayer_request_categories.prayer_request_id IS 'Foreign key to prayer_requests - identifies which prayer is being categorized';
COMMENT ON COLUMN prayer_request_categories.category_id IS 'Foreign key to prayer_categories - identifies which category is assigned';
COMMENT ON COLUMN prayer_request_categories.created_at IS 'Timestamp when the category was assigned to the prayer';

-- Add comments to prayer_attachments table
COMMENT ON TABLE prayer_attachments IS 'File attachments for prayer requests (images, PDFs, documents) with 10MB size limit';
COMMENT ON COLUMN prayer_attachments.prayer_request_id IS 'Foreign key to prayer_requests - identifies which prayer this attachment belongs to';
COMMENT ON COLUMN prayer_attachments.file_name IS 'Original filename of the uploaded file (1-255 characters)';
COMMENT ON COLUMN prayer_attachments.file_size IS 'File size in bytes (1 byte to 10MB/10485760 bytes)';
COMMENT ON COLUMN prayer_attachments.file_type IS 'MIME type of the file (e.g., image/jpeg, application/pdf)';
COMMENT ON COLUMN prayer_attachments.storage_key IS 'Storage key/path for retrieving the file from S3/R2 (e.g., prayer-attachments/wallId/prayerId/filename)';
COMMENT ON COLUMN prayer_attachments.uploaded_by IS 'UUID of the user who uploaded this attachment';
COMMENT ON COLUMN prayer_attachments.created_at IS 'Timestamp when the file was uploaded';