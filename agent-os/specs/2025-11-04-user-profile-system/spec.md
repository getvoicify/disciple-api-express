# Specification: User Profile System

## Goal
Enable church members to create and manage comprehensive user profiles that track their spiritual journey, customize privacy settings, and view a personalized dashboard aggregating their engagement across notes, prayers, and devotional content.

## User Stories
- As a church member, I want to create a profile with my bio and testimony so that other members can get to know me better
- As a church member, I want to upload a profile photo so that my identity is visually recognizable across the platform
- As a church member, I want to control who can see my profile information through privacy settings so that I maintain appropriate boundaries
- As a church member, I want to see my spiritual engagement statistics (notes created, prayers offered, devotionals completed) so that I can track my spiritual growth
- As a church member, I want a personalized dashboard showing my recent notes, active prayer requests, and devotional progress so that I can quickly access what matters most to me
- As a church member, I want to configure notification preferences so that I receive reminders at times that work for my schedule
- As a pastor, I want to view church member profiles so that I can better understand and minister to my congregation
- As a church admin, I want to see which members have completed their profiles so that I can encourage full participation

## Core Requirements

**Profile Management:**
- Members can create and edit their profile (bio/testimony, profile photo, basic info)
- Members can upload profile photos using existing media upload system
- Basic user info (name, email) synced from Keycloak authentication system
- Profile automatically created on first login with Keycloak data

**Privacy Controls:**
- Three privacy modes: Public (visible to entire church), Church Members Only (default), Private (only me and pastors)
- Per-field visibility controls allowing members to hide specific fields (e.g., hide prayer count but show devotional progress)
- Pastors can view all church member profiles regardless of privacy settings
- Privacy settings enforced at API level for all profile endpoints

**Spiritual Engagement Statistics:**
- Display aggregated metrics: notes created count, prayers offered count, devotionals completed count, days active
- Statistics calculated from existing tables (notes, prayer_requests, posts/series)
- Cached metrics in database and Redis for performance optimization
- Auto-refresh cached metrics on profile view or via background job

**Personalized Dashboard:**
- Recent notes section with links to full note details (last 5-10 notes)
- Active prayer requests section showing user's requests and requests they're following
- Current devotional series progress with completion percentage
- Upcoming devotional reminders based on user preferences
- Spiritual health score or engagement summary

**Notification Preferences:**
- Preferred devotional notification time (time picker)
- Email vs push notification toggle (note: push implementation deferred to notification feature)
- Preferences stored in user profile and used by future notification system

**Content Discovery:**
- Dashboard automatically includes content from all churches user has joined
- Dashboard shows prayer walls user is a member of
- No manual content creator following (auto-include based on church membership)

## Visual Design
No visual mockups provided. UI should follow existing platform patterns for consistency.

## Reusable Components

### Existing Code to Leverage

**Keycloak Integration:**
- `src/keycloak/admin-client.ts` - KeycloakAdminClient for fetching user attributes (id, username, email, firstName, lastName, attributes)
- `src/keycloak/types.ts` - Type definitions for Keycloak resources and users
- User ID from JWT: `req.user[1].payload.sub` pattern used throughout codebase
- Sync basic profile data from Keycloak on profile creation/update

**Repository Pattern:**
- `src/notes/pg-repository.ts` - PostgreSQL repository pattern with safeExecute error handling
- `src/notes/repository.ts` - Interface-based repository abstraction
- Create `ProfileRepository` interface and `PostgresProfileRepository` implementation following same pattern

**Service Layer:**
- `src/notes/service.ts` - Service layer with business logic separated from data access
- Create `ProfileService` with methods: createProfile, updateProfile, getProfile, getProfileStatistics, getDashboard

**Endpoint Factory Pattern:**
- `src/notes/routes/noteList.endpoint.ts` - Query parameter validation with Zod, endpoint factory accepting dependencies
- `src/notes/routes/noteCreate.endpoint.ts` - Request body validation, safeExecute usage, structured logging
- Create similar endpoints: `profileCreate`, `profileUpdate`, `profileFetch`, `dashboardFetch`

**Media Upload:**
- `src/media/routes/mediaUpload.endpoint.ts` - Multipart file upload handling
- `src/media/cloudflare-r2-service.ts` - S3-compatible storage integration
- `src/media/pg-repository.ts` - Media metadata storage
- Reuse existing media upload flow for profile photos, store media ID in user_profiles table

**Database Migration Pattern:**
- `migrations/001_create_notes_table.sql` - Table creation with UUID primary keys, timestamps, indexes, triggers for updated_at
- `migrations/009_create_prayer_requests.sql` - User ID foreign key references, composite indexes
- Follow same patterns for new `user_profiles` table migration

**Query Aggregation:**
- Notes count: `SELECT COUNT(*) FROM notes WHERE user_id = ?`
- Prayer requests: `SELECT COUNT(*) FROM prayer_requests WHERE author_id = ?`
- Recent notes: `SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`
- Active prayer memberships: `SELECT * FROM prayer_wall_memberships WHERE user_id = ? AND left_at IS NULL`

**Caching:**
- Existing Redis caching patterns for devotional content
- Cache profile data and statistics in Redis with TTL (e.g., 5 minutes)
- Invalidate cache on profile update

**Validation:**
- Zod schemas for input validation (see `src/notes/schemas.ts`)
- Create profile validation schemas: CreateProfileSchema, UpdateProfileSchema, ProfileFiltersSchema

**Authentication:**
- JWT extraction via `req.user[1].payload` pattern
- User ID from `req.user[1].payload.sub`
- Role-based access from Keycloak token claims

### New Components Required

**Profile Repository (`src/profiles/repository.ts`, `src/profiles/pg-repository.ts`):**
- No existing profile repository exists
- Needs CRUD operations for user profiles
- Needs aggregation queries for statistics
- Needs privacy filtering logic

**Profile Service (`src/profiles/service.ts`):**
- No existing profile service
- Business logic for profile creation, update, privacy enforcement
- Statistics calculation and caching logic
- Dashboard data aggregation from multiple sources

**Profile Endpoints (`src/profiles/routes/`):**
- `profileCreate.endpoint.ts` - POST /profiles
- `profileUpdate.endpoint.ts` - PUT /profiles/:userId
- `profileFetch.endpoint.ts` - GET /profiles/:userId
- `dashboardFetch.endpoint.ts` - GET /profiles/:userId/dashboard
- `profileStatistics.endpoint.ts` - GET /profiles/:userId/statistics

**Database Table (`migrations/xxx_create_user_profiles_table.sql`):**
- New table required to store profile-specific data
- Cannot reuse existing tables as none store user profile information

**Profile Schemas (`src/profiles/schemas.ts`):**
- Zod validation schemas for profile operations
- Privacy mode enum, visibility settings structure

## Technical Approach

**Database Schema:**
```
user_profiles table:
- user_id (UUID, primary key, references Keycloak user ID)
- bio (TEXT, nullable)
- testimony (TEXT, nullable)
- profile_photo_media_id (UUID, nullable, foreign key to media table)
- privacy_mode (ENUM: 'public', 'church_only', 'private', default 'church_only')
- field_visibility_settings (JSONB, stores per-field visibility rules)
- cached_metrics (JSONB, stores pre-calculated statistics)
- notification_preferences (JSONB, stores notification settings)
- preferred_devotional_time (TIME, nullable)
- created_at (TIMESTAMP WITH TIME ZONE)
- updated_at (TIMESTAMP WITH TIME ZONE)

Indexes:
- Primary key on user_id
- Index on privacy_mode for filtering
```

**Data Aggregation Strategy:**
- On profile fetch, calculate statistics from existing tables if cache expired
- Store calculated metrics in `cached_metrics` JSONB field
- Cache profile data in Redis with 5-minute TTL
- Background job or profile update triggers cache refresh
- Dashboard queries combine data from notes, prayer_requests, prayer_wall_memberships, posts/series tables

**Privacy Enforcement:**
- Repository filters profiles based on requesting user's role and relationship
- Members can only see profiles within their privacy level
- Pastors bypass privacy restrictions for church members
- Field-level visibility applied after fetching profile data

**Keycloak Integration:**
- On first profile access, create profile if not exists using Keycloak data
- Sync basic fields (name, email) from Keycloak on profile update
- Use KeycloakAdminClient to fetch fresh user attributes when needed

**API Endpoints:**
- POST /profiles - Create profile (auto-populated from Keycloak)
- PUT /profiles/:userId - Update profile (own profile only)
- GET /profiles/:userId - Fetch profile (privacy enforced)
- GET /profiles/:userId/dashboard - Get personalized dashboard
- GET /profiles/:userId/statistics - Get engagement statistics

**Performance Optimization:**
- Redis caching for profile data and statistics
- Database indexes on user_id for all aggregation queries
- Cached metrics in database to avoid expensive calculations
- Lazy-load dashboard components if needed

**Testing:**
- Unit tests for ProfileService with mocked repositories
- Repository tests with test database for CRUD and aggregation queries
- Endpoint integration tests with Supertest
- Privacy control tests ensuring proper access restrictions
- Keycloak integration tests with mock admin client
- Cache invalidation tests

## Out of Scope
- Visual charts and engagement trend graphs (deferred to Phase 3 - "Profile Engagement Visualization")
- Streaks and milestone tracking (deferred)
- Activity timeline visualization (deferred)
- Friend/connection requests between members
- Direct messaging between members
- Profile endorsements or testimonials
- Public profiles visible outside church context
- Following specific pastors/content creators (content based on church membership only)
- Special lead pastor profile management capabilities
- Push notification implementation (will be handled by separate Notification feature)

## Success Criteria
- 80% of active members complete their profile within 30 days of launch
- Profile page loads within 500ms for cached data
- Dashboard aggregates data from all sources (notes, prayers, devotionals) accurately
- Privacy settings properly restrict profile visibility according to user preferences
- Statistics match actual counts from source tables (notes, prayers, devotionals)
- Profile photo upload succeeds using existing media system
- Keycloak user data syncs correctly on profile creation and updates
- Pastors can view all church member profiles for pastoral care purposes
