-- Seed system-wide prayer categories
-- These categories are available to all churches and cannot be deleted

-- Insert system categories using INSERT ... WHERE NOT EXISTS for idempotency
-- This prevents duplicate inserts when migration is run multiple times

INSERT INTO prayer_categories (name, is_system_category, church_id)
SELECT 'Healing', true, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM prayer_categories
    WHERE name = 'Healing' AND is_system_category = true AND church_id IS NULL
);

INSERT INTO prayer_categories (name, is_system_category, church_id)
SELECT 'Guidance', true, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM prayer_categories
    WHERE name = 'Guidance' AND is_system_category = true AND church_id IS NULL
);

INSERT INTO prayer_categories (name, is_system_category, church_id)
SELECT 'Thanksgiving', true, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM prayer_categories
    WHERE name = 'Thanksgiving' AND is_system_category = true AND church_id IS NULL
);

INSERT INTO prayer_categories (name, is_system_category, church_id)
SELECT 'Intercession', true, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM prayer_categories
    WHERE name = 'Intercession' AND is_system_category = true AND church_id IS NULL
);

INSERT INTO prayer_categories (name, is_system_category, church_id)
SELECT 'Family', true, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM prayer_categories
    WHERE name = 'Family' AND is_system_category = true AND church_id IS NULL
);

-- Add comments to document the system categories
COMMENT ON TABLE prayer_categories IS 'Categories for organizing prayer requests - includes both system-wide and church-specific categories';

-- Verify the seed was successful by querying system categories
-- Uncomment the following query to verify seeding in psql:
/*
SELECT
    id,
    name,
    is_system_category,
    church_id,
    created_at
FROM prayer_categories
WHERE is_system_category = true
ORDER BY name;
*/