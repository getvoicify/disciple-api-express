# Spec Requirements: User Profile System

## Initial Description
**User Profile System** — Comprehensive user profile management including spiritual journey tracking, content preferences, engagement history, and personalized dashboard showing recent notes, prayers, and devotional progress.

Effort: Large (L) - 2 weeks
Phase: Phase 2: Social Engagement & Community Interaction

## Requirements Discussion

### First Round Questions

**Q1: Profile Information Structure** — I'm assuming we should include basic info (name, profile photo, bio/testimony) plus spiritual stats (days active, notes created, prayers offered, devotionals completed). Is that the right scope, or should we include additional fields like spiritual gifts, ministry interests, or baptism/membership dates?

**Answer:** Yes, although you should be aware that the user authenticates using Keycloak and some basic information already exists there.

**Q2: Privacy & Visibility Controls** — I'm thinking profiles should have three privacy modes: Public (visible to entire church), Church Members Only (default), and Private (only me and pastors). Should members be able to customize visibility per field (e.g., hide prayer count but show devotional progress)?

**Answer:** Yes

**Q3: Spiritual Journey Tracking** — I assume we should track streaks (consecutive days of engagement), milestones (e.g., "50 notes created," "30 prayers offered"), and activity timeline. Should we also include visual charts showing engagement trends over time, or keep it simple with counters and badges?

**Answer:** We can do this at a later time. Perhaps update the roadmap?

**Q4: Personalized Dashboard Components** — I'm thinking the dashboard should show: (a) Recent notes with quick access, (b) Active prayer requests they've made or are following, (c) Current devotional series progress, (d) Upcoming devotional reminders. Should we also include a "spiritual health" score or engagement summary?

**Answer:** Yes

**Q5: Content Preferences** — I assume preferences should include: preferred devotional notification time, email vs push notification toggle, and content series interests/tags. Should members also be able to follow specific pastors/content creators or opt into specific prayer wall types?

**Answer:** They should get all contents from churches and prayer walls they've joined

**Q6: Integration with Existing Features** — I'm assuming the profile should pull data from existing systems: notes count from notes repository, prayer activity from prayer walls, devotional progress from devotional completion tracking. Do we need to create new tracking tables, or can we aggregate from existing data?

**Answer:** What do you suggest?

**Q7: Access Control** — I'm thinking members can edit their own profile, pastors can view all church member profiles, and church admins can manage profile settings/permissions. Should lead pastors have any special profile management capabilities?

**Answer:** No.

**Q8: Out of Scope for V1** — I assume we're NOT including: friend/connection requests, direct messaging between members, profile endorsements/testimonials, or public profiles visible outside the church. Are there any other features you want to explicitly exclude from this version?

**Answer:** No. We'll come back to this later.

### Existing Code to Reference

**Similar Features Identified:**

Based on the codebase structure, the following existing features should be referenced:

- **Keycloak Integration**: User authentication and basic user data
  - Path: `src/keycloak/`
  - Key files: `src/keycloak/admin-client.ts`, `src/keycloak/types.ts`
  - The KeycloakAdminClient is used to access user attributes and manage users

- **Notes System**: For aggregating user's note activity
  - Path: `src/notes/`
  - Migration: `migrations/001_create_notes_table.sql`
  - Query notes by `user_id` for profile statistics

- **Posts/Devotionals System**: For tracking devotional engagement
  - Paths: `src/posts/`, `src/series/`
  - Migrations: `migrations/005_create_posts_table.sql`, `migrations/006_create_series_table.sql`
  - Track devotional completion and series progress

- **Prayer Wall System**: For aggregating prayer activity
  - Path: `src/websocket/handlers/prayer.handler.ts`
  - Migrations: `migrations/008_create_prayer_walls.sql`, `migrations/009_create_prayer_requests.sql`
  - Query prayer requests and responses by `user_id`

- **Church Membership**: For understanding user's church affiliations
  - Migration: `migrations/002_create_churches_tables.sql`
  - Reference church membership to determine content visibility

- **Media Management**: For profile photo uploads
  - Migration: `migrations/004_create_media_table.sql`
  - Use existing media upload patterns for profile photos

### Follow-up Questions

**Follow-up 1: Data Integration Strategy**

For tracking user engagement metrics, I suggest we can aggregate from existing tables without creating new tracking tables:

- **Notes count & recent notes**: Query `notes` table by `user_id` (assuming it exists)
- **Prayer activity**: Query `prayer_requests` and `prayer_responses` tables by `user_id`
- **Devotional progress**: Query devotional completion/interaction tables (if they exist) by `user_id`
- **Streaks & milestones**: Calculate on-the-fly from engagement data or cache in Redis for performance

However, we might need a new `user_profiles` table to store:
- Profile-specific data (bio/testimony, profile photo URL, privacy settings)
- Cached metrics (to avoid heavy aggregation queries on every profile view)
- User preferences (notification settings, preferred devotional time)

Does this approach sound good, or would you prefer a different strategy?

**Answer:** This sounds like a good plan

**Follow-up 2: Existing Code Reference**

Since you mentioned Keycloak already has some basic user info, can you point me to:
- Where Keycloak user data is currently accessed/synced in your codebase?
- Any existing database tables for users, notes, prayers, or devotionals I should reference?
- Folder paths for notes, prayer wall, or devotional features that might have user-related queries?

**Answer:** We use the KeycloakAdminClient to access Keycloak for users' attributes, amongst other things. There are sql files in the project for notes, posts, series(devotional) and prayer related data

**Follow-up 3: Roadmap Update for Deferred Features**

You mentioned deferring visual charts/engagement trends to a later time. Should I note this as a Phase 3 feature in the roadmap, something like:

> **Profile Engagement Visualization** — Visual charts and graphs showing spiritual engagement trends, devotional completion over time, and prayer activity patterns. `S`

Or would you prefer to handle the roadmap update separately?

**Answer:** Yes

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
No visual assets were found in the visuals folder.

## Requirements Summary

### Functional Requirements

**Core Profile Features:**
- User profile page displaying basic information (name, profile photo, bio/testimony)
- Spiritual engagement statistics (notes created, prayers offered, devotionals completed, days active)
- Profile photo upload using existing media management system
- Integration with Keycloak for basic user attributes (name, email, etc.)

**Privacy & Visibility:**
- Three privacy modes: Public, Church Members Only (default), Private
- Per-field visibility controls allowing members to customize what information is visible
- Pastors and admins can view church member profiles based on permissions

**Personalized Dashboard:**
- Recent notes section with quick access links
- Active prayer requests (created by user or followed by user)
- Current devotional series progress tracker
- Upcoming devotional reminders
- Spiritual health score or engagement summary

**Content Preferences:**
- Preferred devotional notification time
- Email vs push notification preferences
- Content automatically includes all churches and prayer walls user has joined

**Data Integration:**
- Aggregate user statistics from existing tables:
  - Notes from `notes` table
  - Prayer activity from `prayer_requests` and `prayer_responses` tables
  - Devotional progress from posts/series tables
- New `user_profiles` table for profile-specific data and cached metrics
- Redis caching for performance optimization on frequently accessed metrics

### Reusability Opportunities

**Keycloak Integration:**
- Leverage existing `KeycloakAdminClient` in `src/keycloak/admin-client.ts`
- Use existing patterns from `src/keycloak/types.ts` for user data structures
- Reference user attribute handling from `src/tests/keycloak/user-attributes.test.ts`

**Database Patterns:**
- Model after existing migration patterns in `migrations/` folder
- Use repository pattern consistent with `src/notes/`, `src/posts/`, `src/series/`
- Follow existing query patterns for user-specific data aggregation

**Media Upload:**
- Use existing media upload system (migration `004_create_media_table.sql`)
- Follow patterns from media management for profile photo handling
- Leverage S3/R2 integration for profile photo storage

**Endpoint Structure:**
- Follow existing endpoint factory patterns from `src/posts/routes/` and `src/notes/routes/`
- Use similar error handling and validation patterns
- Maintain consistency with `EndpointRequest` type for user access

### Scope Boundaries

**In Scope:**
- User profile creation and management (bio, photo, preferences)
- Spiritual engagement statistics and dashboard
- Privacy controls with per-field visibility
- Integration with Keycloak for basic user info
- Aggregation of data from notes, prayers, devotionals
- Profile viewing by church members based on privacy settings
- User preference management (notifications, timing)
- Profile photo upload via existing media system
- Cached metrics in Redis for performance
- New `user_profiles` database table

**Out of Scope (Deferred to Later Phases):**
- Visual charts and engagement trend graphs (added to roadmap as Phase 3 feature)
- Streaks and milestone tracking (deferred)
- Activity timeline visualization (deferred)
- Friend/connection requests between members
- Direct messaging between members
- Profile endorsements or testimonials
- Public profiles visible outside church context
- Following specific pastors/content creators
- Special lead pastor profile management capabilities

### Technical Considerations

**Database:**
- Create new `user_profiles` table with fields:
  - `user_id` (references Keycloak user ID)
  - `bio` / `testimony` (text fields)
  - `profile_photo_url` (references media table)
  - `privacy_mode` (enum: public, church_only, private)
  - `field_visibility_settings` (JSON for per-field controls)
  - `cached_metrics` (JSON for performance optimization)
  - `notification_preferences` (JSON)
  - `preferred_devotional_time` (time)
  - Timestamps: `created_at`, `updated_at`

**Data Aggregation Strategy:**
- Query existing tables for real-time stats:
  - `SELECT COUNT(*) FROM notes WHERE user_id = ?`
  - `SELECT COUNT(*) FROM prayer_requests WHERE user_id = ?`
  - `SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`
- Cache expensive aggregations in `user_profiles.cached_metrics`
- Update cached metrics via background job or on profile save
- Use Redis for temporary caching of profile data

**Keycloak Integration:**
- Use `KeycloakAdminClient` to fetch basic user attributes
- Sync Keycloak user data with profile data on profile creation/update
- Respect Keycloak roles for access control (member, pastor, admin)
- Map Keycloak `sub` claim to `user_id` in profile table

**Authentication & Authorization:**
- Members can view/edit their own profile
- Respect privacy settings when displaying profiles to other members
- Pastors can view all church member profiles (filtered by church membership)
- Church admins can manage profile settings within their church

**Content Delivery:**
- Dashboard pulls content from churches user is member of
- Include prayer walls user has joined or created
- Filter devotional content based on church membership
- No manual content creator following (auto-include all church content)

**Performance:**
- Redis cache for frequently accessed profile data
- Cached metrics in database to avoid heavy aggregations
- Lazy-load dashboard components for faster initial render
- Index database queries on `user_id` for fast lookups

**Testing Strategy:**
- Unit tests for profile service logic
- Repository tests with test database
- Integration tests for profile endpoints
- Test privacy controls and field visibility
- Test Keycloak integration with mock admin client
- Test data aggregation accuracy from existing tables
