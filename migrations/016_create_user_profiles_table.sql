-- Migration: Create user_profiles table for User Profile System
-- Description: Creates user_profiles table to store profile data, privacy settings, and cached metrics
-- Author: System
-- Date: 2025-11-04

-- Create privacy mode enum
CREATE TYPE privacy_mode AS ENUM ('public', 'church_only', 'private');

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY,
    bio TEXT,
    testimony TEXT,
    profile_photo_media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    privacy_mode privacy_mode NOT NULL DEFAULT 'church_only',
    field_visibility_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    cached_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    preferred_devotional_time TIME,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_user_profiles_privacy_mode ON user_profiles (privacy_mode);
CREATE INDEX idx_user_profiles_created_at ON user_profiles (created_at DESC);
CREATE INDEX idx_user_profiles_profile_photo ON user_profiles (profile_photo_media_id) WHERE profile_photo_media_id IS NOT NULL;

-- Create GIN indexes for JSONB fields for efficient queries
CREATE INDEX idx_user_profiles_cached_metrics ON user_profiles USING GIN (cached_metrics);
CREATE INDEX idx_user_profiles_field_visibility ON user_profiles USING GIN (field_visibility_settings);

-- Add comments for documentation
COMMENT ON TABLE user_profiles IS 'Stores user profile data including spiritual journey tracking and privacy settings';
COMMENT ON COLUMN user_profiles.user_id IS 'UUID of the user (references Keycloak user ID) - primary key';
COMMENT ON COLUMN user_profiles.bio IS 'User biography or personal description';
COMMENT ON COLUMN user_profiles.testimony IS 'User spiritual testimony or faith journey';
COMMENT ON COLUMN user_profiles.profile_photo_media_id IS 'Foreign key to media table for profile photo';
COMMENT ON COLUMN user_profiles.privacy_mode IS 'Privacy level: public (visible to all), church_only (default, visible to church members), private (only user and pastors)';
COMMENT ON COLUMN user_profiles.field_visibility_settings IS 'JSONB object controlling per-field visibility (e.g., {prayerCount: false, notesCount: true})';
COMMENT ON COLUMN user_profiles.cached_metrics IS 'JSONB object storing pre-calculated statistics (notesCount, prayersCount, devotionalsCount, daysActive, lastCalculated)';
COMMENT ON COLUMN user_profiles.notification_preferences IS 'JSONB object for notification settings (e.g., {emailEnabled: true, pushEnabled: false})';
COMMENT ON COLUMN user_profiles.preferred_devotional_time IS 'User preferred time for devotional notifications';
COMMENT ON COLUMN user_profiles.created_at IS 'Timestamp when the profile was created';
COMMENT ON COLUMN user_profiles.updated_at IS 'Timestamp when the profile was last updated (auto-updated by trigger)';

-- Create trigger to automatically update updated_at on record updates
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
