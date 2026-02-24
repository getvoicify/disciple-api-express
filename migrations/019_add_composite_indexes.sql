-- Migration 019: Add composite index for authorization middleware performance
-- The authorize middleware queries: WHERE church_id = ? AND user_id = ? AND status = 'Active'
-- on every protected request. A composite index covering all three columns
-- avoids sequential scans as the church_members table grows.

CREATE INDEX IF NOT EXISTS idx_church_members_church_user_status
ON church_members(church_id, user_id, status);
