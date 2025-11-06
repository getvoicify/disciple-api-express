-- Migration: Add Keycloak user info fields to user_profiles table
-- Description: Adds firstName, lastName, displayName, avatarUrl, and email columns to sync Keycloak claims
-- Author: System
-- Date: 2025-11-06

-- Add first_name column (from Keycloak given_name claim)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);

-- Add last_name column (from Keycloak family_name claim)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

-- Add display_name column (computed from first_name + last_name)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS display_name VARCHAR(511);

-- Add avatar_url column (nullable, for future use)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add email column (from Keycloak email claim, nullable for privacy)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Create index on email for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles (email) WHERE email IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.first_name IS 'User first name synced from Keycloak given_name claim';
COMMENT ON COLUMN user_profiles.last_name IS 'User last name synced from Keycloak family_name claim';
COMMENT ON COLUMN user_profiles.display_name IS 'User display name computed from first_name and last_name';
COMMENT ON COLUMN user_profiles.avatar_url IS 'User profile picture URL (nullable)';
COMMENT ON COLUMN user_profiles.email IS 'User email synced from Keycloak email claim (nullable, privacy-controlled)';
