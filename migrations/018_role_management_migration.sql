-- Migration: Move authorization from Keycloak to database
-- This migration adds owner_id to notes and removes Keycloak outbox tables
-- NOTE: Migration runner re-executes all files, so all statements must be idempotent

BEGIN;

-- Add owner_id column to notes table for ownership-based authorization
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE notes ADD COLUMN owner_id UUID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notes_owner_id ON notes(owner_id);

-- Drop outbox tables — no longer needed without Keycloak resource sync
DROP TABLE IF EXISTS outbox_dead_letter;
DROP TABLE IF EXISTS outbox_events;

COMMIT;
