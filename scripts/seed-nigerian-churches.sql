-- Seed Nigerian churches for staging environment
-- Usage: psql ... -v owner_id="'f5a3bb4d-fdb7-482c-ba38-27864c18ea43'" -f seed-nigerian-churches.sql
-- Idempotent: uses ON CONFLICT (slug) DO NOTHING

BEGIN;

-- 1. Redeemed Christian Church of God (RCCG) — Lagos, Approved
INSERT INTO churches (
  id, slug, name, description, byline,
  address, latitude, longitude,
  approval_status, approved_by, approved_at,
  created_by, version
) VALUES (
  gen_random_uuid(),
  'redeemed-christian-church-of-god',
  'Redeemed Christian Church of God (RCCG)',
  'The Redeemed Christian Church of God is one of the largest and most influential Pentecostal denominations in Africa, founded in 1952. With its sprawling Redemption Camp along the Lagos-Ibadan Expressway, RCCG hosts the annual Holy Ghost Congress attracting millions of worshippers.',
  'Jesus is Lord — The Redeemed Christian Church of God',
  '{"street": "1-5 Redemption Way, Ebute Metta", "city": "Lagos", "state": "Lagos", "country": "Nigeria", "postalCode": "101212"}'::jsonb,
  6.4920000, 3.3875000,
  'Approved', :owner_id, NOW(),
  :owner_id, 1
) ON CONFLICT (slug) DO NOTHING;

-- 2. Winners Chapel (Living Faith Church) — Ota, Ogun, Approved
INSERT INTO churches (
  id, slug, name, description, byline,
  address, latitude, longitude,
  approval_status, approved_by, approved_at,
  created_by, version
) VALUES (
  gen_random_uuid(),
  'winners-chapel-living-faith-church',
  'Winners Chapel (Living Faith Church)',
  'Living Faith Church Worldwide, popularly known as Winners Chapel, was founded by Bishop David Oyedepo in 1981. Its Canaanland headquarters in Ota, Ogun State, houses the 50,000-seat Faith Tabernacle — one of the largest church auditoriums in the world.',
  'I am a Winner — Living Faith Church Worldwide',
  '{"street": "Canaanland, Km 10 Idiroko Road", "city": "Ota", "state": "Ogun", "country": "Nigeria", "postalCode": "112104"}'::jsonb,
  6.6718000, 3.1565000,
  'Approved', :owner_id, NOW(),
  :owner_id, 1
) ON CONFLICT (slug) DO NOTHING;

-- 3. Deeper Life Bible Church — Gbagada, Lagos, Approved
INSERT INTO churches (
  id, slug, name, description, byline,
  address, latitude, longitude,
  approval_status, approved_by, approved_at,
  created_by, version
) VALUES (
  gen_random_uuid(),
  'deeper-life-bible-church',
  'Deeper Life Bible Church',
  'Founded by Pastor W.F. Kumuyi in 1973, Deeper Life Bible Church is known for its emphasis on holiness, Bible study, and evangelism. The church has grown from a small Bible study group in Lagos to a global ministry with congregations across more than 100 countries.',
  'Deeper Christian Life Ministry — Holiness and Bible Study',
  '{"street": "2 Gbagada Expressway", "city": "Gbagada, Lagos", "state": "Lagos", "country": "Nigeria", "postalCode": "100234"}'::jsonb,
  6.5514000, 3.3872000,
  'Approved', :owner_id, NOW(),
  :owner_id, 1
) ON CONFLICT (slug) DO NOTHING;

-- 4. Mountain of Fire and Miracles Ministries — Lagos, Approved
INSERT INTO churches (
  id, slug, name, description, byline,
  address, latitude, longitude,
  approval_status, approved_by, approved_at,
  created_by, version
) VALUES (
  gen_random_uuid(),
  'mountain-of-fire-and-miracles-ministries',
  'Mountain of Fire and Miracles Ministries',
  'Mountain of Fire and Miracles Ministries (MFM) was founded by Dr. Daniel Olukoya in 1989. Known for its fervent prayer sessions and spiritual warfare teachings, MFM has become one of the fastest-growing churches in Africa with its international headquarters in Lagos.',
  'Prayer City — Mountain of Fire and Miracles Ministries',
  '{"street": "13 Olasimbo Street, Onike", "city": "Yaba, Lagos", "state": "Lagos", "country": "Nigeria", "postalCode": "101245"}'::jsonb,
  6.5095000, 3.3711000,
  'Approved', :owner_id, NOW(),
  :owner_id, 1
) ON CONFLICT (slug) DO NOTHING;

-- 5. Dunamis International Gospel Centre — Abuja, Approved
INSERT INTO churches (
  id, slug, name, description, byline,
  address, latitude, longitude,
  approval_status, approved_by, approved_at,
  created_by, version
) VALUES (
  gen_random_uuid(),
  'dunamis-international-gospel-centre',
  'Dunamis International Gospel Centre',
  'Dunamis International Gospel Centre, led by Dr. Paul Enenche, is a vibrant church headquartered in Abuja, Nigeria. Known for The Glory Dome — a 100,000-seat auditorium — the church is committed to the propagation of the Gospel through worship, teaching, and community impact.',
  'Raising leaders, shaping satisfying satisfying destinies',
  '{"street": "Along Airport Road, Lugbe", "city": "Abuja", "state": "FCT", "country": "Nigeria", "postalCode": "900110"}'::jsonb,
  9.0058000, 7.3800000,
  'Approved', :owner_id, NOW(),
  :owner_id, 1
) ON CONFLICT (slug) DO NOTHING;

-- 6. House on the Rock — Lekki, Lagos, Pending
INSERT INTO churches (
  id, slug, name, description, byline,
  address, latitude, longitude,
  approval_status,
  created_by, version
) VALUES (
  gen_random_uuid(),
  'house-on-the-rock',
  'House on the Rock',
  'House on the Rock is a dynamic and contemporary church founded by Pastor Paul Adefarasin in 1994. Located in Lekki, Lagos, the church is known for its vibrant worship, creative arts ministry, and The Experience Lagos — an annual interdenominational gospel concert.',
  'Building lives, building futures — House on the Rock',
  '{"street": "26 Bisola Durosinmi-Etti Drive, Lekki Phase 1", "city": "Lekki, Lagos", "state": "Lagos", "country": "Nigeria", "postalCode": "106104"}'::jsonb,
  6.4281000, 3.4536000,
  'Pending',
  :owner_id, 1
) ON CONFLICT (slug) DO NOTHING;

-- 7. Daystar Christian Centre — Oregun, Lagos, Pending
INSERT INTO churches (
  id, slug, name, description, byline,
  address, latitude, longitude,
  approval_status,
  created_by, version
) VALUES (
  gen_random_uuid(),
  'daystar-christian-centre',
  'Daystar Christian Centre',
  'Daystar Christian Centre, founded by Pastor Sam Adeyemi, is a leading church in Lagos known for its focus on leadership development, personal growth, and community transformation. The church holds its services at the Daystar Centre in Oregun, Ikeja.',
  'Raising role models — Daystar Christian Centre',
  '{"street": "29 Oregun Road, Oregun", "city": "Ikeja, Lagos", "state": "Lagos", "country": "Nigeria", "postalCode": "100271"}'::jsonb,
  6.6018000, 3.3615000,
  'Pending',
  :owner_id, 1
) ON CONFLICT (slug) DO NOTHING;

-- 8. Christ Embassy (Believers' LoveWorld) — Lagos, Pending
INSERT INTO churches (
  id, slug, name, description, byline,
  address, latitude, longitude,
  approval_status,
  created_by, version
) VALUES (
  gen_random_uuid(),
  'christ-embassy-believers-loveworld',
  'Christ Embassy (Believers'' LoveWorld)',
  'Christ Embassy, also known as Believers'' LoveWorld Inc., was founded by Pastor Chris Oyakhilome. The ministry is renowned for its Healing School, Rhapsody of Realities devotional, and large-scale evangelical outreach programmes across Africa and beyond.',
  'Spreading the message of eternal life — Christ Embassy',
  '{"street": "LoveWorld Conference Centre, Kudirat Abiola Way", "city": "Oregun, Lagos", "state": "Lagos", "country": "Nigeria", "postalCode": "100271"}'::jsonb,
  6.5950000, 3.3620000,
  'Pending',
  :owner_id, 1
) ON CONFLICT (slug) DO NOTHING;

-- Create Owner memberships for each seeded church
-- Only inserts where the church exists and no membership exists yet
INSERT INTO church_members (id, church_id, user_id, role, status, joined_at, updated_at)
SELECT gen_random_uuid(), c.id, :owner_id, 'Owner', 'Active', NOW(), NOW()
FROM churches c
WHERE c.created_by = :owner_id
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM church_members cm
    WHERE cm.church_id = c.id AND cm.user_id = :owner_id
  );

COMMIT;
