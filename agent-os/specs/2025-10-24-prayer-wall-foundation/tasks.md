# Task Breakdown: Prayer Wall Foundation

## Overview

This document provides a comprehensive task breakdown for implementing the Prayer Wall Foundation feature - a real-time prayer community platform where church members can create topic-based prayer walls, submit prayer requests with flexible anonymity options, engage in threaded conversations, and receive encouragement from pastors and fellow members with robust moderation tools.

**Total Estimated Timeline:** 2 weeks (10 working days)
**Total Task Groups:** 23
**Total Sub-Tasks:** 120+

## Development Phases

The tasks are organized into 5 strategic phases aligned with the spec's development workflow:

1. **Phase 1: Database & Core API** (Days 1-3)
2. **Phase 2: WebSocket & Real-Time** (Days 4-5)
3. **Phase 3: Anonymity & Threading** (Days 6-7)
4. **Phase 4: Moderation & Notifications** (Days 8-9)
5. **Phase 5: Polish & Performance** (Day 10)

---

## Phase 1: Database & Core API (Days 1-3)

### Task Group 1: Database Schema - Prayer Walls Table
**Phase:** 1
**Dependencies:** None
**Estimated Time:** 2 hours

- [ ] 1.0 Create prayer walls table migration
  - [ ] 1.1 Write 2-8 focused tests for prayer wall database operations
    - Test wall creation with valid data
    - Test wall retrieval by church_id
    - Test soft-delete behavior
    - Test unique constraint violations
  - [ ] 1.2 Create migration file: `/migrations/008_create_prayer_walls.sql`
    - Table: `prayer_walls`
    - Fields: id (UUID), church_id (UUID FK), name (VARCHAR 255), description (TEXT), created_by (UUID FK), is_private (BOOLEAN), has_restricted_access (BOOLEAN), schedule (JSONB), video_call_link (VARCHAR 500), status (ENUM), created_at, updated_at, deleted_at
    - Constraints: NOT NULL on required fields, CHECK constraint on status enum
    - Reference existing pattern from `/migrations/002_create_churches_tables.sql`
  - [ ] 1.3 Run migration and verify table creation
    - Run ONLY the newly created migration
    - Verify table structure with `\d prayer_walls`
  - [ ] 1.4 Ensure migration tests pass
    - Run ONLY the 2-8 tests written in 1.1
    - Verify migrations run successfully

**Acceptance Criteria:**
- Migration 008 creates prayer_walls table successfully
- All constraints and defaults work correctly
- The 2-8 tests written in 1.1 pass
- Migration is reversible (down migration works)

---

### Task Group 2: Database Schema - Prayer Requests & Threading
**Phase:** 1
**Dependencies:** Task Group 1
**Estimated Time:** 2 hours

- [ ] 2.0 Create prayer requests table with threading support
  - [ ] 2.1 Write 2-8 focused tests for prayer request operations
    - Test prayer creation with anonymity levels
    - Test self-referential threading (parent_id)
    - Test thread depth calculation
    - Test soft-delete with restoration windows
  - [ ] 2.2 Create migration file: `/migrations/009_create_prayer_requests.sql`
    - Table: `prayer_requests`
    - Fields: id (UUID), wall_id (UUID FK), author_id (UUID FK), content (TEXT), anonymity_level (ENUM: identified, anonymous_to_members, fully_anonymous), parent_id (UUID FK self-referential nullable), thread_depth (INTEGER default 0), has_attachment (BOOLEAN), created_at, updated_at, deleted_at, deleted_by (UUID FK nullable)
    - Constraints: CHECK thread_depth BETWEEN 0 AND 3, parent_id references prayer_requests(id)
  - [ ] 2.3 Create prayer_wall_memberships table
    - Table: `prayer_wall_memberships`
    - Fields: id (UUID), wall_id (UUID FK), user_id (UUID FK), joined_at, invited_by (UUID FK nullable), left_at (nullable), is_banned (BOOLEAN default false), banned_at (nullable), banned_by (UUID FK nullable), created_at, updated_at
    - Constraints: UNIQUE(wall_id, user_id, left_at), handles rejoining logic
  - [ ] 2.4 Run migrations and verify table creation
  - [ ] 2.5 Ensure prayer request tests pass
    - Run ONLY the 2-8 tests written in 2.1

**Acceptance Criteria:**
- Migration 009 creates both tables successfully
- Self-referential foreign key for threading works
- Thread depth constraint enforced
- The 2-8 tests written in 2.1 pass

---

### Task Group 3: Database Schema - Categories & Supporting Tables
**Phase:** 1
**Dependencies:** Task Group 2
**Estimated Time:** 2 hours

- [ ] 3.0 Create prayer categories and supporting tables
  - [ ] 3.1 Write 2-8 focused tests for category operations
    - Test system category retrieval
    - Test custom category creation
    - Test many-to-many category assignment
    - Test category filtering
  - [ ] 3.2 Create migration file: `/migrations/010_create_prayer_categories.sql`
    - Table: `prayer_categories` (id, name, church_id nullable, is_system_category, created_at, updated_at)
    - Table: `prayer_request_categories` (id, prayer_request_id FK, category_id FK, created_at)
    - Table: `prayer_attachments` (id, prayer_request_id FK, file_name, file_size, file_type, storage_key, uploaded_by FK, created_at)
  - [ ] 3.3 Create migration file: `/migrations/011_create_supporting_tables.sql`
    - Table: `flagged_content` (id, prayer_request_id FK, flagged_by FK, reason, status ENUM, reviewed_by FK, reviewed_at, resolution_action ENUM, resolution_notes, created_at, updated_at)
    - Table: `prayer_read_receipts` (id, prayer_request_id FK, user_id FK, read_at, created_at)
    - Table: `notification_preferences` (id, user_id FK, wall_id FK nullable, new_prayers BOOLEAN, responses_to_my_prayers BOOLEAN, replies_to_my_responses BOOLEAN, wall_invitations BOOLEAN, moderation_actions BOOLEAN, created_at, updated_at)
  - [ ] 3.4 Run migrations and verify all tables created
  - [ ] 3.5 Ensure category tests pass
    - Run ONLY the 2-8 tests written in 3.1

**Acceptance Criteria:**
- All 6 supporting tables created successfully
- Foreign key relationships work correctly
- The 2-8 tests written in 3.1 pass

---

### Task Group 4: Database Schema - Indexes & Performance
**Phase:** 1
**Dependencies:** Task Group 3
**Estimated Time:** 1.5 hours

- [ ] 4.0 Create database indexes for performance
  - [ ] 4.1 Write 2-8 focused tests for index performance
    - Test query performance on indexed columns
    - Test composite index usage in EXPLAIN plans
    - Test pagination query performance
  - [ ] 4.2 Create migration file: `/migrations/012_add_indexes.sql`
    - Index: prayer_walls(church_id)
    - Index: prayer_walls(created_by)
    - Index: prayer_walls(deleted_at)
    - Index: prayer_requests(wall_id, created_at) - composite for pagination
    - Index: prayer_requests(author_id)
    - Index: prayer_requests(parent_id)
    - Index: prayer_requests(deleted_at)
    - Index: prayer_wall_memberships(user_id, wall_id) - composite for membership checks
    - Index: prayer_wall_memberships(wall_id)
    - Index: flagged_content(prayer_request_id)
    - Index: prayer_read_receipts(prayer_request_id, user_id) - composite
  - [ ] 4.3 Run migration and verify indexes created
    - Use EXPLAIN ANALYZE to verify index usage
  - [ ] 4.4 Ensure index tests pass
    - Run ONLY the 2-8 tests written in 4.1

**Acceptance Criteria:**
- All indexes created successfully
- Query plans show index usage
- The 2-8 tests written in 4.1 pass
- Migration is reversible

---

### Task Group 5: Database Schema - Seed System Categories
**Phase:** 1
**Dependencies:** Task Group 4
**Estimated Time:** 1 hour

- [ ] 5.0 Seed system prayer categories
  - [ ] 5.1 Write 2-8 focused tests for system categories
    - Test all 5 system categories are seeded
    - Test is_system_category flag is true
    - Test church_id is NULL for system categories
  - [ ] 5.2 Create migration file: `/migrations/013_seed_system_categories.sql`
    - Insert: Healing, Guidance, Thanksgiving, Intercession, Family
    - Set is_system_category = true, church_id = NULL
  - [ ] 5.3 Run migration and verify categories seeded
  - [ ] 5.4 Ensure seed tests pass
    - Run ONLY the 2-8 tests written in 5.1

**Acceptance Criteria:**
- All 5 system categories inserted
- Categories have correct flags
- The 2-8 tests written in 5.1 pass

---

### Task Group 6: Repository Layer - Prayer Wall Repository
**Phase:** 1
**Dependencies:** Task Group 5
**Estimated Time:** 3 hours

- [ ] 6.0 Implement PrayerWallRepository
  - [ ] 6.1 Write 2-8 focused tests for PrayerWallRepository
    - Test create wall with valid data
    - Test findById with church_id check
    - Test findByChurchId pagination
    - Test update wall details
    - Test soft-delete wall
  - [ ] 6.2 Create file: `/src/prayer-walls/repositories/prayer-wall.repository.ts`
    - Interface: IPrayerWallRepository
    - Methods: create(data), findById(id, churchId), findByChurchId(churchId, pagination), update(id, data), softDelete(id), restore(id)
    - Use safeExecute for all database operations
    - Follow pattern from `/src/notes/pg-repository.ts`
    - Use postgres package for database queries
  - [ ] 6.3 Create types file: `/src/prayer-walls/types/prayer-wall.types.ts`
    - Types: PrayerWall, CreatePrayerWallData, UpdatePrayerWallData, PaginationParams
    - Enums: WallStatus, AnonymityLevel, FlaggedContentStatus
  - [ ] 6.4 Ensure repository tests pass
    - Run ONLY the 2-8 tests written in 6.1

**Acceptance Criteria:**
- Repository implements all CRUD methods
- All database operations use safeExecute
- The 2-8 tests written in 6.1 pass
- Follows existing repository pattern

---

### Task Group 7: Repository Layer - Prayer Request Repository
**Phase:** 1
**Dependencies:** Task Group 6
**Estimated Time:** 3 hours

- [ ] 7.0 Implement PrayerRequestRepository
  - [ ] 7.1 Write 2-8 focused tests for PrayerRequestRepository
    - Test create prayer with threading
    - Test findByWallId with pagination
    - Test findById with thread children
    - Test update prayer content
    - Test soft-delete and restoration
  - [ ] 7.2 Create file: `/src/prayer-walls/repositories/prayer-request.repository.ts`
    - Interface: IPrayerRequestRepository
    - Methods: create(data), findById(id), findByWallId(wallId, pagination), findThreadChildren(parentId), update(id, data), softDelete(id, deletedBy), restore(id), validateThreadDepth(parentId)
    - Use recursive CTE for fetching full threads
    - Implement cursor-based pagination
  - [ ] 7.3 Ensure repository tests pass
    - Run ONLY the 2-8 tests written in 7.1

**Acceptance Criteria:**
- Repository handles threading correctly
- Thread depth validation works
- The 2-8 tests written in 7.1 pass
- Pagination uses cursor-based approach

---

### Task Group 8: Repository Layer - Membership & Supporting Repositories
**Phase:** 1
**Dependencies:** Task Group 7
**Estimated Time:** 4 hours

- [ ] 8.0 Implement supporting repositories
  - [ ] 8.1 Write 2-8 focused tests for each repository
    - Test membership: join, leave, ban, invitation tracking
    - Test categories: create custom, find by church
    - Test attachments: create, find by prayer
    - Test flagged content: create flag, update status
    - Test read receipts: mark as read, get count
    - Test notification preferences: create, update
  - [ ] 8.2 Create file: `/src/prayer-walls/repositories/prayer-wall-membership.repository.ts`
    - Methods: join(wallId, userId, invitedBy?), leave(wallId, userId), isMember(wallId, userId), findMembers(wallId), removeMember(wallId, userId, removedBy), ban(wallId, userId, bannedBy)
  - [ ] 8.3 Create file: `/src/prayer-walls/repositories/prayer-category.repository.ts`
    - Methods: findAll(churchId), findSystemCategories(), create(name, churchId), assignToRequest(requestId, categoryIds)
  - [ ] 8.4 Create file: `/src/prayer-walls/repositories/prayer-attachment.repository.ts`
    - Methods: create(data), findByRequestId(requestId), deleteUnused(attachmentId)
  - [ ] 8.5 Create file: `/src/prayer-walls/repositories/flagged-content.repository.ts`
    - Methods: create(requestId, flaggedBy, reason), findPending(churchId), updateStatus(flagId, status, reviewedBy, action, notes)
  - [ ] 8.6 Create file: `/src/prayer-walls/repositories/prayer-read-receipt.repository.ts`
    - Methods: markAsRead(requestId, userId), getReadCount(requestId), hasRead(requestId, userId)
  - [ ] 8.7 Create file: `/src/prayer-walls/repositories/notification-preference.repository.ts`
    - Methods: create(userId, wallId, preferences), update(userId, wallId, preferences), find(userId, wallId)
  - [ ] 8.8 Ensure all repository tests pass
    - Run ONLY the 2-8 tests written in 8.1 for each repository

**Acceptance Criteria:**
- All 6 repositories implemented
- All methods use safeExecute
- The 2-8 tests per repository pass (approximately 12-48 tests total)
- Repositories follow existing patterns

---

### Task Group 9: Service Layer - Prayer Wall Service
**Phase:** 1
**Dependencies:** Task Group 8
**Estimated Time:** 4 hours

- [ ] 9.0 Implement PrayerWallService
  - [ ] 9.1 Write 2-8 focused tests for PrayerWallService
    - Test create wall (pastor permission check)
    - Test edit wall (creator-only check)
    - Test list walls (public vs private visibility)
    - Test join wall (membership validation)
    - Test leave wall
  - [ ] 9.2 Create file: `/src/prayer-walls/services/prayer-wall.service.ts`
    - Class: PrayerWallService
    - Dependencies: PrayerWallRepository, PrayerWallMembershipRepository, RedisCacheRepository
    - Methods: createWall(data, creatorId, creatorRole), updateWall(wallId, data, userId), getWall(wallId, userId), listWalls(churchId, userId), joinWall(wallId, userId, invitedBy?), leaveWall(wallId, userId), inviteMember(wallId, userId, invitedBy), removeMember(wallId, userId, removedBy), banUser(wallId, userId, bannedBy)
    - Business logic: Permission checks, private wall visibility, membership validation
    - Cache: Wall details (1 min TTL), membership checks (5 min TTL)
  - [ ] 9.3 Ensure service tests pass
    - Run ONLY the 2-8 tests written in 9.1

**Acceptance Criteria:**
- Service implements all business logic
- Permission checks enforce authorization matrix
- The 2-8 tests written in 9.1 pass
- Caching works correctly

---

### Task Group 10: API Layer - Prayer Wall Endpoints
**Phase:** 1
**Dependencies:** Task Group 9
**Estimated Time:** 5 hours

- [ ] 10.0 Create prayer wall REST endpoints
  - [ ] 10.1 Write 2-8 focused tests for prayer wall endpoints
    - Test POST /api/churches/:churchId/prayer-walls (create)
    - Test GET /api/churches/:churchId/prayer-walls (list)
    - Test PATCH /api/churches/:churchId/prayer-walls/:wallId (update)
    - Test POST /api/prayer-walls/:wallId/join
    - Test DELETE /api/prayer-walls/:wallId/leave
  - [ ] 10.2 Create Zod schemas: `/src/prayer-walls/schemas/wall.schemas.ts`
    - Schemas: createWallSchema, updateWallSchema, wallResponseSchema
    - Validation: name (1-255 chars), schedule (valid JSONB), video_call_link (valid URL)
  - [ ] 10.3 Create routes file: `/src/prayer-walls/routes/walls.routes.ts`
    - Route: POST /api/churches/:churchId/prayer-walls - Create wall (pastors only)
    - Route: GET /api/churches/:churchId/prayer-walls - List walls
    - Route: GET /api/churches/:churchId/prayer-walls/:wallId - Get wall details
    - Route: PATCH /api/churches/:churchId/prayer-walls/:wallId - Update wall (creator only)
    - Route: DELETE /api/churches/:churchId/prayer-walls/:wallId - Archive wall (soft delete)
    - Route: POST /api/prayer-walls/:wallId/join - Join wall
    - Route: POST /api/prayer-walls/:wallId/leave - Leave wall
    - Route: POST /api/prayer-walls/:wallId/invite - Invite member (pastors)
    - Route: DELETE /api/prayer-walls/:wallId/members/:userId - Remove member (pastors)
    - Route: POST /api/prayer-walls/:wallId/ban/:userId - Ban user (pastors)
    - Route: GET /api/prayer-walls/:wallId/members - List members with online status
  - [ ] 10.4 Create handler factories following pattern from `/src/notes/routes/`
    - Use EndpointRequest type
    - Extract user: `req.user?.[1]?.['payload']?.['sub']`
    - Use safeExecute for all service calls
    - Use structured logging: `req.log?.info({ context }, 'message')`
  - [ ] 10.5 Register routes in `/src/index.ts`
  - [ ] 10.6 Ensure API endpoint tests pass
    - Run ONLY the 2-8 tests written in 10.1

**Acceptance Criteria:**
- All 11 endpoints implemented
- Zod validation works correctly
- The 2-8 tests written in 10.1 pass
- Endpoints use handler factory pattern

---

### Task Group 11: Service Layer - Prayer Request Service
**Phase:** 1
**Dependencies:** Task Group 9
**Estimated Time:** 4 hours

- [ ] 11.0 Implement PrayerRequestService
  - [ ] 11.1 Write 2-8 focused tests for PrayerRequestService
    - Test create prayer (membership check, anonymity enforcement)
    - Test thread depth validation (reject if parent depth >= 3)
    - Test edit prayer (5-minute window check)
    - Test soft-delete with restoration windows
    - Test list prayers with pagination
  - [ ] 11.2 Create file: `/src/prayer-walls/services/prayer-request.service.ts`
    - Class: PrayerRequestService
    - Dependencies: PrayerRequestRepository, PrayerWallMembershipRepository, PrayerCategoryRepository, PrayerAttachmentRepository
    - Methods: createPrayer(wallId, data, authorId), updatePrayer(prayerId, content, authorId), getPrayer(prayerId, requestingUserId, requestingUserRole), listPrayers(wallId, userId, pagination), softDelete(prayerId, deletedBy), restore(prayerId, userId, userRole), addResponse(parentId, content, authorId), validateThreadDepth(parentId)
    - Business logic: Thread depth validation (max 3), anonymity enforcement, 5-minute edit window, restoration rules (24hr authors, 30-day pastors, 2-year flagged)
  - [ ] 11.3 Ensure service tests pass
    - Run ONLY the 2-8 tests written in 11.1

**Acceptance Criteria:**
- Service validates thread depth correctly
- Anonymity enforcement works for all 3 levels
- The 2-8 tests written in 11.1 pass
- Restoration rules enforced correctly

---

### Task Group 12: API Layer - Prayer Request Endpoints
**Phase:** 1
**Dependencies:** Task Group 11
**Estimated Time:** 5 hours

- [ ] 12.0 Create prayer request REST endpoints
  - [ ] 12.1 Write 2-8 focused tests for prayer endpoints
    - Test POST /api/prayer-walls/:wallId/prayers (create)
    - Test GET /api/prayer-walls/:wallId/prayers (list with pagination)
    - Test PATCH /api/prayer-walls/:wallId/prayers/:prayerId (edit)
    - Test DELETE /api/prayer-walls/:wallId/prayers/:prayerId (soft-delete)
    - Test POST /api/prayer-walls/:wallId/prayers/:prayerId/responses (threading)
  - [ ] 12.2 Create Zod schemas: `/src/prayer-walls/schemas/prayer.schemas.ts`
    - Schemas: createPrayerSchema, updatePrayerSchema, prayerResponseSchema
    - Validation: content (required, max length), anonymity_level (enum), category_ids (array of UUIDs)
  - [ ] 12.3 Create routes file: `/src/prayer-walls/routes/prayers.routes.ts`
    - Route: GET /api/prayer-walls/:wallId/prayers - List prayers (paginated, 20 per page)
    - Route: POST /api/prayer-walls/:wallId/prayers - Submit prayer
    - Route: GET /api/prayer-walls/:wallId/prayers/:prayerId - Get prayer with thread
    - Route: PATCH /api/prayer-walls/:wallId/prayers/:prayerId - Edit prayer (5 min window)
    - Route: DELETE /api/prayer-walls/:wallId/prayers/:prayerId - Soft-delete prayer
    - Route: POST /api/prayer-walls/:wallId/prayers/:prayerId/restore - Restore deleted prayer
    - Route: POST /api/prayer-walls/:wallId/prayers/:prayerId/responses - Add response (threading)
    - Route: POST /api/prayer-walls/:wallId/prayers/upload - Upload file attachment
    - Route: GET /api/prayer-walls/:wallId/prayers/attachments/:attachmentId - Get signed URL
  - [ ] 12.4 Create handler factories
    - Use EndpointRequest type
    - Use safeExecute for all service calls
    - Use structured logging
  - [ ] 12.5 Register routes in `/src/index.ts`
  - [ ] 12.6 Ensure API endpoint tests pass
    - Run ONLY the 2-8 tests written in 12.1

**Acceptance Criteria:**
- All 9 endpoints implemented
- Pagination uses cursor-based approach
- The 2-8 tests written in 12.1 pass
- Threading validation enforced

---

## Phase 2: WebSocket & Real-Time (Days 4-5)

### Task Group 13: WebSocket Infrastructure - Socket.io Setup
**Phase:** 2
**Dependencies:** Task Group 12
**Estimated Time:** 4 hours

- [ ] 13.0 Set up Socket.io server with Redis adapter
  - [ ] 13.1 Write 2-8 focused tests for WebSocket infrastructure
    - Test WebSocket connection with valid JWT
    - Test connection rejection with invalid JWT
    - Test room join/leave
    - Test Redis adapter pub/sub
  - [ ] 13.2 Install dependencies
    - Run: `npm install socket.io @socket.io/redis-adapter`
    - Run: `npm install --save-dev @types/socket.io`
  - [ ] 13.3 Create file: `/src/websocket/socket.server.ts`
    - Set up Socket.io server attached to Express
    - Configure Redis adapter for multi-server scaling
    - Namespace: `/churches/:churchId/prayer-walls`
    - Rooms: `wall-{wallId}` for each prayer wall
    - Enable CORS for WebSocket connections
    - Configure reconnection settings
  - [ ] 13.4 Create file: `/src/websocket/events.ts`
    - Define event type constants: prayer:created, prayer:updated, prayer:deleted, prayer:response, prayer:reply, typing:start, typing:stop, user:online, user:offline, user:away, prayer:read, content:flagged, content:hidden, content:restored, user:banned, member:joined, member:left, member:invited
    - Define event payload types
  - [ ] 13.5 Integrate Socket.io server in `/src/index.ts`
  - [ ] 13.6 Ensure WebSocket infrastructure tests pass
    - Run ONLY the 2-8 tests written in 13.1

**Acceptance Criteria:**
- Socket.io server runs successfully
- Redis adapter configured for scaling
- The 2-8 tests written in 13.1 pass
- WebSocket connections work

---

### Task Group 14: WebSocket Middleware - JWT Authentication
**Phase:** 2
**Dependencies:** Task Group 13
**Estimated Time:** 3 hours

- [ ] 14.0 Implement WebSocket authentication middleware
  - [ ] 14.1 Write 2-8 focused tests for WebSocket auth
    - Test valid JWT token authentication
    - Test invalid/expired token rejection
    - Test missing token rejection
    - Test user context extraction
  - [ ] 14.2 Create file: `/src/websocket/middleware/auth.middleware.ts`
    - Extract JWT from handshake query or headers
    - Validate JWT using existing Keycloak validation logic
    - Extract user ID and roles
    - Attach user context to socket
    - Reject connection if authentication fails
    - Follow pattern from existing JWT middleware
  - [ ] 14.3 Apply middleware to Socket.io namespace
  - [ ] 14.4 Ensure WebSocket auth tests pass
    - Run ONLY the 2-8 tests written in 14.1

**Acceptance Criteria:**
- JWT authentication works for WebSocket
- Invalid tokens rejected
- The 2-8 tests written in 14.1 pass
- User context available on socket

---

### Task Group 15: WebSocket Event Handlers - Prayer Events
**Phase:** 2
**Dependencies:** Task Group 14
**Estimated Time:** 4 hours

- [ ] 15.0 Implement prayer-related WebSocket event handlers
  - [ ] 15.1 Write 2-8 focused tests for prayer events
    - Test prayer:created event broadcast
    - Test prayer:updated event broadcast
    - Test prayer:deleted event broadcast
    - Test prayer:response event broadcast
    - Test anonymity enforcement in events
  - [ ] 15.2 Create file: `/src/websocket/handlers/prayer.handler.ts`
    - Handler: onPrayerCreated - Broadcast to room `wall-{wallId}`
    - Handler: onPrayerUpdated - Broadcast updated prayer
    - Handler: onPrayerDeleted - Broadcast deletion event
    - Handler: onPrayerResponse - Broadcast response with thread info
    - Handler: onPrayerReply - Broadcast reply with thread depth
    - Integrate with PrayerRequestService for data retrieval
    - Enforce anonymity in event payloads
    - Use structured logging: `logger.info({ context }, 'message')`
  - [ ] 15.3 Register event handlers in Socket.io server
  - [ ] 15.4 Integrate events with REST API endpoints
    - Emit prayer:created when POST /prayers succeeds
    - Emit prayer:updated when PATCH /prayers/:id succeeds
    - Emit prayer:deleted when DELETE /prayers/:id succeeds
    - Emit prayer:response when POST /prayers/:id/responses succeeds
  - [ ] 15.5 Ensure prayer event tests pass
    - Run ONLY the 2-8 tests written in 15.1

**Acceptance Criteria:**
- All prayer events broadcast correctly
- Anonymity enforced in event payloads
- The 2-8 tests written in 15.1 pass
- Events triggered from REST API

---

### Task Group 16: WebSocket Event Handlers - Presence & Typing
**Phase:** 2
**Dependencies:** Task Group 15
**Estimated Time:** 4 hours

- [ ] 16.0 Implement presence and typing indicators
  - [ ] 16.1 Write 2-8 focused tests for presence events
    - Test user:online event on connection
    - Test user:offline event on disconnection
    - Test typing:start with debouncing
    - Test typing:stop auto-clear
    - Test presence data in Redis
  - [ ] 16.2 Create file: `/src/websocket/handlers/presence.handler.ts`
    - Handler: onConnection - Mark user online, broadcast user:online, store in Redis sorted set
    - Handler: onDisconnect - Mark user offline, broadcast user:offline, remove from Redis
    - Handler: onTypingStart - Broadcast to room, store in Redis with 5-second TTL
    - Handler: onTypingStop - Broadcast to room, remove from Redis
    - Handler: onUserAway - Mark user away after 5 minutes inactive
  - [ ] 16.3 Create file: `/src/prayer-walls/services/presence.service.ts`
    - Class: PresenceService
    - Dependencies: RedisCacheRepository
    - Methods: setOnline(userId, wallId), setOffline(userId, wallId), setAway(userId, wallId), getOnlineUsers(wallId), setTyping(userId, wallId, prayerId), clearTyping(userId, wallId, prayerId), getTypingUsers(wallId, prayerId)
    - Use Redis sorted sets with timestamps for TTL
  - [ ] 16.4 Register presence handlers in Socket.io server
  - [ ] 16.5 Ensure presence tests pass
    - Run ONLY the 2-8 tests written in 16.1

**Acceptance Criteria:**
- Presence tracking works correctly
- Typing indicators with 5-second TTL
- The 2-8 tests written in 16.1 pass
- Redis stores presence data

---

### Task Group 17: WebSocket Event Handlers - Read Receipts & Membership
**Phase:** 2
**Dependencies:** Task Group 16
**Estimated Time:** 3 hours

- [ ] 17.0 Implement read receipts and membership events
  - [ ] 17.1 Write 2-8 focused tests for read receipts and membership
    - Test prayer:read event
    - Test read count aggregation
    - Test member:joined broadcast
    - Test member:left broadcast
    - Test member:invited notification
  - [ ] 17.2 Add read receipt handlers to `/src/websocket/handlers/prayer.handler.ts`
    - Handler: onPrayerRead - Mark as read, broadcast aggregate count, use PrayerReadReceiptRepository
  - [ ] 17.3 Add membership handlers to `/src/websocket/handlers/prayer.handler.ts`
    - Handler: onMemberJoined - Broadcast to wall room
    - Handler: onMemberLeft - Broadcast to wall room
    - Handler: onMemberInvited - Send to specific user
  - [ ] 17.4 Integrate events with REST API endpoints
    - Emit member:joined when POST /join succeeds
    - Emit member:left when POST /leave succeeds
    - Emit member:invited when POST /invite succeeds
  - [ ] 17.5 Ensure read receipt and membership tests pass
    - Run ONLY the 2-8 tests written in 17.1

**Acceptance Criteria:**
- Read receipts track correctly
- Membership events broadcast
- The 2-8 tests written in 17.1 pass
- Events integrated with API

---

## Phase 3: Anonymity & Threading (Days 6-7)

### Task Group 18: Anonymity Enforcement - Service Layer Logic
**Phase:** 3
**Dependencies:** Task Group 17
**Estimated Time:** 4 hours

- [ ] 18.0 Implement comprehensive anonymity enforcement
  - [ ] 18.1 Write 2-8 focused tests for anonymity enforcement
    - Test fully identified: Name and profile visible
    - Test anonymous to members: Members see "Anonymous Member", pastors see identity
    - Test fully anonymous: Everyone sees "Anonymous"
    - Test private wall override: Always identified
    - Test WebSocket event anonymity
  - [ ] 18.2 Create utility: `/src/prayer-walls/utils/anonymity.util.ts`
    - Function: getAuthorInfo(prayer, requestingUser, wall) - Returns author info based on anonymity level, requesting user role, and wall type
    - Function: enforceAnonymityInEvent(event, requestingUsers) - Conditionally redact author info in WebSocket events
  - [ ] 18.3 Update PrayerRequestService to use anonymity utility
    - Apply anonymity enforcement in getPrayer, listPrayers
    - Apply anonymity enforcement in WebSocket event handlers
  - [ ] 18.4 Update API responses to respect anonymity
    - Test all prayer endpoints return correct author info
    - Test WebSocket events respect anonymity
  - [ ] 18.5 Add anonymity preference endpoints
    - Route: GET /api/users/me/anonymity-preferences
    - Route: PATCH /api/users/me/anonymity-preferences/:wallId
  - [ ] 18.6 Ensure anonymity tests pass
    - Run ONLY the 2-8 tests written in 18.1

**Acceptance Criteria:**
- All 3 anonymity levels enforced correctly
- Private walls always show identity
- The 2-8 tests written in 18.1 pass
- WebSocket events respect anonymity

---

### Task Group 19: Threading Implementation - Query Optimization
**Phase:** 3
**Dependencies:** Task Group 18
**Estimated Time:** 4 hours

- [ ] 19.0 Optimize threading queries and validation
  - [ ] 19.1 Write 2-8 focused tests for threading
    - Test fetch root prayers (parent_id IS NULL)
    - Test lazy load children (fetch by parent_id)
    - Test recursive CTE for full thread
    - Test thread depth validation (reject if parent depth >= 3)
    - Test nested response creation
  - [ ] 19.2 Update PrayerRequestRepository with optimized queries
    - Method: findRootPrayers(wallId, pagination) - WHERE parent_id IS NULL
    - Method: findThreadChildren(parentId) - Fetch direct children only
    - Method: findFullThread(rootId) - Use recursive CTE for complete thread
    - Add composite index optimization
  - [ ] 19.3 Update PrayerRequestService threading logic
    - Validate thread depth before creation
    - Return thread_depth and parent_id in responses for frontend nesting
    - Implement "Load more replies" pagination for threads
  - [ ] 19.4 Update API endpoints to support threading
    - GET /prayers returns root prayers only
    - GET /prayers/:id returns prayer with immediate children
    - GET /prayers/:id/thread returns full thread (recursive)
  - [ ] 19.5 Ensure threading tests pass
    - Run ONLY the 2-8 tests written in 19.1

**Acceptance Criteria:**
- Thread depth validation works (max 3)
- Queries optimized with indexes
- The 2-8 tests written in 19.1 pass
- Lazy loading supported

---

### Task Group 20: File Attachments - Upload & Storage
**Phase:** 3
**Dependencies:** Task Group 19
**Estimated Time:** 4 hours

- [ ] 20.0 Implement file attachment support
  - [ ] 20.1 Write 2-8 focused tests for file attachments
    - Test file upload with valid types (images, PDFs, docs)
    - Test file size validation (10MB max)
    - Test file type validation
    - Test attachment linking to prayer
    - Test signed URL generation
  - [ ] 20.2 Create file upload handler
    - Reuse existing S3/R2 upload infrastructure from `/src/media/` or `/src/gallery/`
    - Validate file type (images, PDFs, documents)
    - Validate file size (10MB max)
    - Generate storage key: `prayer-attachments/{wallId}/{prayerId}/{filename}`
  - [ ] 20.3 Implement POST /api/prayer-walls/:wallId/prayers/upload endpoint
    - Use multer for multipart/form-data
    - Upload to S3/R2
    - Create PrayerAttachment record
    - Return attachment metadata (id, file_name, file_size, storage_key)
  - [ ] 20.4 Implement GET /api/prayer-walls/:wallId/prayers/attachments/:attachmentId endpoint
    - Generate signed URL for download
    - Validate user has access to wall
    - Set appropriate expiration time
  - [ ] 20.5 Update prayer creation to support attachments
    - Accept attachment_ids in POST /prayers
    - Link attachments to prayer_request_id
  - [ ] 20.6 Add cleanup job for unused attachments
    - Delete attachments uploaded but not linked to prayer after 24 hours
  - [ ] 20.7 Ensure attachment tests pass
    - Run ONLY the 2-8 tests written in 20.1

**Acceptance Criteria:**
- File uploads work for images, PDFs, docs
- 10MB size limit enforced
- The 2-8 tests written in 20.1 pass
- Signed URLs generated correctly

---

## Phase 4: Moderation & Notifications (Days 8-9)

### Task Group 21: Moderation System - Flagging Workflow
**Phase:** 4
**Dependencies:** Task Group 20
**Estimated Time:** 5 hours

- [ ] 21.0 Implement complete moderation workflow
  - [ ] 21.1 Write 2-8 focused tests for moderation
    - Test flag content (auto-hide)
    - Test pastor review workflow
    - Test delete action
    - Test restore action
    - Test ban user action
    - Test audit trail logging
  - [ ] 21.2 Create file: `/src/prayer-walls/services/moderation.service.ts`
    - Class: ModerationService
    - Dependencies: FlaggedContentRepository, PrayerRequestRepository, PrayerWallMembershipRepository
    - Methods: flagContent(prayerId, flaggedBy, reason), listFlaggedContent(churchId), reviewFlaggedContent(flagId, action, reviewedBy, notes), deleteContent(prayerId, deletedBy), restoreContent(prayerId, restoredBy), banUser(wallId, userId, bannedBy, churchWide)
    - Business logic: Auto-hide on flag, pastor-only review, audit logging
  - [ ] 21.3 Create Zod schemas: `/src/prayer-walls/schemas/moderation.schemas.ts`
    - Schemas: flagContentSchema, reviewFlaggedContentSchema
  - [ ] 21.4 Create routes file: `/src/prayer-walls/routes/moderation.routes.ts`
    - Route: POST /api/prayer-walls/:wallId/prayers/:prayerId/flag - Flag content
    - Route: GET /api/churches/:churchId/moderation/flagged - List flagged content (pastors)
    - Route: POST /api/moderation/flagged/:flagId/delete - Delete flagged content (pastors)
    - Route: POST /api/moderation/flagged/:flagId/restore - Restore flagged content (pastors)
    - Route: GET /api/churches/:churchId/moderation/audit - View audit trail (pastors)
  - [ ] 21.5 Create WebSocket moderation handler: `/src/websocket/handlers/moderation.handler.ts`
    - Handler: onContentFlagged - Notify pastors
    - Handler: onContentHidden - Broadcast to room (auto-hide)
    - Handler: onContentRestored - Broadcast to room
    - Handler: onUserBanned - Broadcast to room
  - [ ] 21.6 Integrate moderation events with API
    - Emit content:flagged when POST /flag succeeds
    - Emit content:restored when POST /restore succeeds
    - Emit user:banned when POST /ban succeeds
  - [ ] 21.7 Register routes in `/src/index.ts`
  - [ ] 21.8 Ensure moderation tests pass
    - Run ONLY the 2-8 tests written in 21.1

**Acceptance Criteria:**
- Flagging auto-hides content
- Pastors can review and take actions
- The 2-8 tests written in 21.1 pass
- Audit trail logs all actions
- Real-time notifications work

---

### Task Group 22: Notification System - Preferences & Delivery
**Phase:** 4
**Dependencies:** Task Group 21
**Estimated Time:** 5 hours

- [ ] 22.0 Implement notification system
  - [ ] 22.1 Write 2-8 focused tests for notifications
    - Test create notification preferences
    - Test update per-wall preferences
    - Test notification filtering based on preferences
    - Test batched notifications
    - Test delivery channels (in-app, push, email)
  - [ ] 22.2 Create file: `/src/prayer-walls/services/notification.service.ts`
    - Class: NotificationService
    - Dependencies: NotificationPreferenceRepository, RedisCacheRepository
    - Methods: sendNotification(userId, wallId, type, data), checkPreferences(userId, wallId, type), batchNotifications(wallId, type, data), sendToChannel(userId, channel, notification)
    - Business logic: Check preferences before sending, batch rapid events (30-second window), support multiple channels
  - [ ] 22.3 Create routes file: `/src/prayer-walls/routes/notifications.routes.ts`
    - Route: GET /api/users/me/notification-preferences - Get preferences
    - Route: PATCH /api/users/me/notification-preferences/:wallId - Update per-wall preferences
  - [ ] 22.4 Integrate notifications with events
    - New prayer posted → Notify wall members (if preferences allow)
    - Response to prayer → Notify prayer author
    - Reply to response → Notify response author
    - Wall invitation → Notify invitee
    - Content flagged → Notify pastors
  - [ ] 22.5 Implement notification batching
    - Use Redis to collect events in 30-second window
    - Send single notification: "5 new prayers in Youth Group"
  - [ ] 22.6 Register routes in `/src/index.ts`
  - [ ] 22.7 Ensure notification tests pass
    - Run ONLY the 2-8 tests written in 22.1

**Acceptance Criteria:**
- Granular preferences work per-wall
- Notifications respect user preferences
- The 2-8 tests written in 22.1 pass
- Batching prevents spam
- Multiple delivery channels supported

---

### Task Group 23: Category Management - API Endpoints
**Phase:** 4
**Dependencies:** Task Group 22
**Estimated Time:** 2 hours

- [ ] 23.0 Create prayer category endpoints
  - [ ] 23.1 Write 2-8 focused tests for categories
    - Test GET /categories (list system + custom)
    - Test POST /categories (create custom, admin-only)
    - Test category assignment to prayers
    - Test category filtering
  - [ ] 23.2 Create routes file: `/src/prayer-walls/routes/categories.routes.ts`
    - Route: GET /api/churches/:churchId/prayer-categories - List categories (system + custom)
    - Route: POST /api/churches/:churchId/prayer-categories - Create custom category (admins)
  - [ ] 23.3 Create handler factories
    - Use EndpointRequest type
    - Use safeExecute
    - Use structured logging
  - [ ] 23.4 Register routes in `/src/index.ts`
  - [ ] 23.5 Ensure category tests pass
    - Run ONLY the 2-8 tests written in 23.1

**Acceptance Criteria:**
- Category endpoints work correctly
- Admin-only permission enforced
- The 2-8 tests written in 23.1 pass
- System categories always available

---

## Phase 5: Polish & Performance (Day 10)

### Task Group 24: Caching Strategy - Redis Implementation
**Phase:** 5
**Dependencies:** Task Groups 1-23
**Estimated Time:** 3 hours

- [ ] 24.0 Implement comprehensive caching
  - [ ] 24.1 Review existing cache usage across all services
  - [ ] 24.2 Add caching for frequently accessed data
    - Cache: Wall membership checks (5-minute TTL)
    - Cache: User roles (5-minute TTL)
    - Cache: Wall details (1-minute TTL)
    - Cache: Presence data (TTL-based expiration)
    - Cache: Read receipt counts (5-minute TTL)
  - [ ] 24.3 Implement cache invalidation
    - Invalidate membership cache on join/leave/ban
    - Invalidate wall cache on update
    - Invalidate presence cache on disconnect
  - [ ] 24.4 Add cache hit/miss logging
    - Log cache performance: `logger.debug({ key, hit: true }, 'Cache hit')`
  - [ ] 24.5 Test cache performance improvements

**Acceptance Criteria:**
- All identified data cached
- Cache invalidation works correctly
- Cache hit rates logged
- Performance improvements measurable

---

### Task Group 25: Rate Limiting - Abuse Prevention
**Phase:** 5
**Dependencies:** Task Group 24
**Estimated Time:** 3 hours

- [ ] 25.0 Implement rate limiting
  - [ ] 25.1 Install rate limiting package: `npm install express-rate-limit`
  - [ ] 25.2 Create rate limiting middleware: `/src/middleware/rate-limit.middleware.ts`
    - Limit: Prayer submissions (5 per minute per user)
    - Limit: Flagging (10 flags per hour per user)
    - Limit: Invitations (20 invitations per hour per wall)
    - Limit: WebSocket messages (100 per minute per connection)
  - [ ] 25.3 Apply rate limiting to endpoints
    - POST /prayers - 5 per minute
    - POST /flag - 10 per hour
    - POST /invite - 20 per hour
  - [ ] 25.4 Apply rate limiting to WebSocket events
    - All emitted events - 100 per minute per connection
  - [ ] 25.5 Test rate limiting with load tests
    - Verify 429 status returned when limit exceeded
    - Verify retry-after header present

**Acceptance Criteria:**
- Rate limits enforced on all endpoints
- WebSocket rate limiting works
- 429 status with retry-after header
- Limits prevent abuse

---

### Task Group 26: Performance Optimization - Query & Index Review
**Phase:** 5
**Dependencies:** Task Group 25
**Estimated Time:** 3 hours

- [ ] 26.0 Optimize database performance
  - [ ] 26.1 Review all database queries with EXPLAIN ANALYZE
    - Verify indexes used in common queries
    - Identify slow queries (> 100ms)
  - [ ] 26.2 Optimize slow queries
    - Add missing indexes
    - Rewrite inefficient queries
    - Add composite indexes where needed
  - [ ] 26.3 Verify pagination performance
    - Test cursor-based pagination with large datasets
    - Ensure OFFSET not used
  - [ ] 26.4 Test threading query performance
    - Recursive CTE performance with deep threads
    - Lazy loading vs full thread fetch
  - [ ] 26.5 Document query optimization decisions

**Acceptance Criteria:**
- All queries use indexes (verified with EXPLAIN)
- No queries slower than 200ms (95th percentile)
- Pagination performs well with large datasets
- Threading queries optimized

---

### Task Group 27: Load Testing - WebSocket & API
**Phase:** 5
**Dependencies:** Task Group 26
**Estimated Time:** 4 hours

- [ ] 27.0 Conduct comprehensive load testing
  - [ ] 27.1 Install load testing tools: `npm install --save-dev artillery` or `k6`
  - [ ] 27.2 Create load test scripts
    - Test: 1000+ concurrent WebSocket connections
    - Test: Prayer submission throughput (target: 100/sec)
    - Test: Concurrent reads/writes to database
    - Test: Cache performance under load
  - [ ] 27.3 Run load tests and collect metrics
    - WebSocket connection capacity
    - API response times under load
    - Database query performance
    - Redis memory usage
  - [ ] 27.4 Identify bottlenecks and optimize
    - Tune Redis configuration
    - Optimize WebSocket connection pooling
    - Adjust database connection pool
  - [ ] 27.5 Document load test results and recommendations

**Acceptance Criteria:**
- 1000+ concurrent WebSocket connections supported
- API response time < 200ms (95th percentile)
- WebSocket message delivery < 500ms
- No memory leaks detected

---

### Task Group 28: Integration Testing - End-to-End Flows
**Phase:** 5
**Dependencies:** Task Group 27
**Estimated Time:** 4 hours

- [ ] 28.0 Test complete user workflows
  - [ ] 28.1 Write E2E test: Member joins wall, posts prayer, receives response
    - Join wall → POST /join
    - Submit prayer → POST /prayers
    - Receive WebSocket event → prayer:created
    - Another member responds → POST /responses
    - Original author receives notification → WebSocket event
  - [ ] 28.2 Write E2E test: Anonymity scenarios
    - Member posts anonymous prayer
    - Other members see "Anonymous Member"
    - Pastor views same prayer and sees identity
  - [ ] 28.3 Write E2E test: Moderation workflow
    - Member flags inappropriate content
    - Content auto-hidden from members
    - Pastor receives notification
    - Pastor reviews and deletes content
    - Audit log created
  - [ ] 28.4 Write E2E test: Threading depth validation
    - Create root prayer
    - Add response (depth 1)
    - Add reply (depth 2)
    - Add reply to reply (depth 3)
    - Attempt depth 4 → rejected with error
  - [ ] 28.5 Write E2E test: Soft-delete restoration
    - Author deletes prayer
    - Author restores within 24 hours → success
    - Author attempts restore after 24 hours → fails
    - Pastor restores within 30 days → success
  - [ ] 28.6 Run all E2E tests

**Acceptance Criteria:**
- All E2E workflows pass
- Anonymity enforced correctly
- Moderation workflow works end-to-end
- Thread depth validation works
- Restoration rules enforced

---

### Task Group 29: Code Review & Documentation
**Phase:** 5
**Dependencies:** Task Group 28
**Estimated Time:** 3 hours

- [ ] 29.0 Review and document implementation
  - [ ] 29.1 Run code review using CodeRabbit CLI
    - Run: `cr review` (if available)
    - Address all critical and high-priority issues
  - [ ] 29.2 Update API documentation
    - Document all new endpoints in Swagger/OpenAPI
    - Include request/response examples
    - Document WebSocket events
  - [ ] 29.3 Review logging consistency
    - Verify all endpoints use structured logging
    - Verify no console.* usage
    - Verify correlation IDs present
  - [ ] 29.4 Review error handling
    - Verify all async operations use safeExecute
    - Verify user-friendly error messages
    - Verify proper HTTP status codes
  - [ ] 29.5 Create deployment checklist
    - Environment variables required
    - Migration rollback strategy
    - Feature flag configuration
    - Monitoring alerts setup

**Acceptance Criteria:**
- Code review approved
- API documentation complete
- All logging uses structured format
- Error handling consistent
- Deployment checklist ready

---

### Task Group 30: Final Test Suite Review & Gap Analysis
**Phase:** 5
**Dependencies:** Task Groups 1-29
**Estimated Time:** 3 hours

- [ ] 30.0 Review test coverage and fill critical gaps
  - [ ] 30.1 Review all tests written in Task Groups 1-29
    - Count total tests from database-engineer groups (Groups 1-8)
    - Count total tests from api-engineer groups (Groups 9-12, 21, 23)
    - Count total tests from websocket-engineer groups (Groups 13-17)
    - Count total tests from feature-engineer groups (Groups 18-20, 22)
    - Expected total: approximately 60-192 tests (2-8 tests × 24 task groups)
  - [ ] 30.2 Analyze test coverage gaps for Prayer Wall feature ONLY
    - Identify critical user workflows lacking test coverage
    - Focus ONLY on gaps related to this spec's feature requirements
    - Do NOT assess entire application test coverage
    - Prioritize end-to-end workflows over unit test gaps
  - [ ] 30.3 Write up to 10 additional strategic tests maximum
    - Add maximum of 10 new tests to fill identified critical gaps
    - Focus on integration points and end-to-end workflows
    - Examples: Full moderation workflow, anonymity edge cases, thread depth limits, restoration time windows
    - Do NOT write comprehensive coverage for all scenarios
    - Skip edge cases, performance tests unless business-critical
  - [ ] 30.4 Run all Prayer Wall feature tests
    - Run ONLY tests related to this spec's feature (all tests from Groups 1-29 plus new tests from 30.3)
    - Expected total: approximately 70-202 tests maximum
    - Do NOT run the entire application test suite
    - Verify all critical workflows pass
  - [ ] 30.5 Generate test coverage report
    - Run coverage for Prayer Wall module only
    - Target: 80%+ coverage for Prayer Wall feature
    - Document coverage gaps and rationale for exclusions

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 70-202 tests total)
- Critical user workflows for Prayer Wall feature are covered
- No more than 10 additional tests added when filling in testing gaps
- Testing focused exclusively on this spec's feature requirements
- Coverage report shows 80%+ for Prayer Wall module

---

## Execution Notes

### Sequential Dependencies

The task groups are organized to respect dependencies:

**Week 1:**
- Days 1-3: Complete Phase 1 (Database & Core API)
  - Groups 1-5: Database schema and migrations
  - Groups 6-8: Repository layer
  - Groups 9-10: Service layer and API for walls
  - Groups 11-12: Service layer and API for prayers

**Week 1:**
- Days 4-5: Complete Phase 2 (WebSocket & Real-Time)
  - Group 13: Socket.io setup
  - Group 14: WebSocket authentication
  - Groups 15-17: WebSocket event handlers

**Week 2:**
- Days 6-7: Complete Phase 3 (Anonymity & Threading)
  - Group 18: Anonymity enforcement
  - Group 19: Threading optimization
  - Group 20: File attachments

**Week 2:**
- Days 8-9: Complete Phase 4 (Moderation & Notifications)
  - Group 21: Moderation workflow
  - Group 22: Notification system
  - Group 23: Category endpoints

**Week 2:**
- Day 10: Complete Phase 5 (Polish & Performance)
  - Groups 24-26: Caching, rate limiting, optimization
  - Groups 27-28: Load testing and E2E tests
  - Groups 29-30: Code review and final testing

### Testing Strategy

Following TDD approach per CLAUDE.md:
1. Each task group starts with writing 2-8 focused tests (x.1 sub-task)
2. Implementation follows test creation
3. Each task group ends with running ONLY those specific tests (final sub-task)
4. Final comprehensive test review in Task Group 30
5. Expected total tests: 70-202 tests for entire feature

### File Organization

All code organized under:
- `/src/prayer-walls/` - Main feature directory
  - `/repositories/` - 8 repository files
  - `/services/` - 5 service files
  - `/routes/` - 4 route files
  - `/schemas/` - 3 schema files
  - `/types/` - 1 types file
  - `/utils/` - Utility functions
- `/src/websocket/` - WebSocket infrastructure
  - `/handlers/` - 3 event handler files
  - `/middleware/` - Authentication middleware
  - `socket.server.ts` - Socket.io server
  - `events.ts` - Event definitions
- `/migrations/` - 6 new migration files (008-013)

### Key Technical Patterns

All implementation must follow:
- **TDD**: Tests first, implementation second
- **safeExecute**: All async operations and promises
- **Structured logging**: Never use console.*, always use logger or req.log
- **EndpointRequest type**: For all API handlers
- **User extraction**: `req.user?.[1]?.['payload']?.['sub']`
- **Repository pattern**: Interface-based for testability
- **Handler factory**: For endpoint creation
- **Zod validation**: All request/response validation

### Success Metrics

Feature complete when:
- [ ] All 30 task groups completed
- [ ] All migrations run successfully (008-013)
- [ ] All 70-202 tests pass
- [ ] 80%+ test coverage for Prayer Wall module
- [ ] Load tests meet performance benchmarks
- [ ] Code review approved
- [ ] API documentation complete
- [ ] Deployment checklist ready

---

## Summary

This task breakdown provides:
- **120+ actionable sub-tasks** organized into 30 strategic task groups
- **5 development phases** aligned with spec workflow
- **Clear dependencies** ensuring proper execution order
- **TDD approach** with 2-8 tests per task group
- **Specific deliverables** with file paths and acceptance criteria
- **Comprehensive coverage** of all feature requirements
- **Performance optimization** and load testing
- **2-week timeline** with realistic estimates

The tasks are ready for implementation by specialized agents following the defined workflow.