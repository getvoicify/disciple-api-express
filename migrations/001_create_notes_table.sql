-- Create notes table
CREATE TABLE IF NOT EXISTS notes
(
    id                   UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    title                VARCHAR(255)             NOT NULL,
    content              TEXT                     NOT NULL,
    date                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    scripture_references JSONB                             DEFAULT '[]'::jsonb,
    images               JSONB                             DEFAULT '[]'::jsonb,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_notes_date ON notes (date DESC);
CREATE INDEX idx_notes_title ON notes (title);
CREATE INDEX idx_notes_created_at ON notes (created_at DESC);

-- Create a GIN index for full-text search on content
CREATE INDEX idx_notes_content_fts ON notes USING GIN (to_tsvector('english', content));

-- Create a GIN index for JSONB scripture references queries
CREATE INDEX idx_notes_scripture_references ON notes USING GIN (scripture_references);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS
$$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE
    ON notes
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE notes IS 'Stores worship service notes for worshipers';
COMMENT ON COLUMN notes.scripture_references IS 'Array of scripture references in JSON format [{book: string, chapter: number, verse: number, endVerse?: number}]';
COMMENT ON COLUMN notes.images IS 'Array of image URLs or references';