-- Migration: Move authorization from Keycloak to database
-- This migration adds owner_id to notes and removes Keycloak outbox tables

-- Add owner_id column to notes table for ownership-based authorization
ALTER TABLE notes ADD COLUMN owner_id UUID;
CREATE INDEX idx_notes_owner_id ON notes(owner_id);

-- Drop outbox tables — no longer needed without Keycloak resource sync
DROP TABLE IF EXISTS outbox_dead_letter;
DROP TABLE IF EXISTS outbox_events;
