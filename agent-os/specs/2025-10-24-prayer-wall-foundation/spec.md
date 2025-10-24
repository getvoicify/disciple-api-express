# Specification: Prayer Wall Foundation

## Goal

Build a real-time prayer community platform where church members can create topic-based prayer walls, submit prayer requests with flexible anonymity options, engage in threaded conversations, and receive encouragement from pastors and fellow members—with robust moderation tools to ensure safe, respectful communication.

## User Stories

### Lead/Head Pastor Stories
- As a lead pastor, I want to create church-wide prayer walls so that members can submit prayer requests for my attention
- As a lead pastor, I want to create private prayer walls so that I can have confidential prayer conversations with leadership
- As a lead pastor, I want to see the identity of "anonymous to members" prayers so that I can provide personalized pastoral care when needed
- As a lead pastor, I want to review flagged content so that I can maintain a safe and respectful prayer environment
- As a lead pastor, I want to ban disruptive users from prayer walls so that I can protect the community

### Church Admin/Pastor Stories
- As a church admin, I want to create custom prayer categories so that our church can organize prayers by relevant topics
- As a pastor, I want to edit prayer wall details so that I can update schedules and video call links
- As a pastor, I want to invite specific members to prayer walls so that I can facilitate targeted prayer groups
- As a pastor, I want to remove members from prayer walls when necessary for moderation purposes
- As a pastor, I want to restore falsely flagged content so that legitimate prayers are not hidden

### Church Member Stories
- As a church member, I want to view all available prayer walls so that I can discover prayer communities that interest me
- As a church member, I want to join prayer walls voluntarily so that I only participate in groups that matter to me
- As a church member, I want to submit prayer requests anonymously so that I can share sensitive struggles without fear of judgment
- As a church member, I want to respond to others' prayers so that I can offer encouragement and support
- As a church member, I want to attach files to my prayers so that I can share relevant documents or images
- As a church member, I want to receive real-time notifications so that I know when someone responds to my prayer
- As a church member, I want to flag inappropriate content so that I can help maintain a respectful community
- As a church member, I want to leave prayer walls so that I can manage my participation
- As a church member, I want to customize notification preferences per wall so that I don't get overwhelmed with notifications

## Core Requirements

### Prayer Wall Management
- Pastors and admins can create public church-wide walls or private walls
- Wall creators can edit wall details (name, description, schedule, video call link)
- All church members can view available public walls (church-wide visibility)
- Members must join a wall to participate (opt-in membership model)
- Walls support scheduling with recurring meetings (e.g., "Every Saturday 6AM WAT")
- Walls can include external video call links displayed with "Join call" button
- Walls have status indicators (Active, Ongoing, Archived)
- Wall creators can invite members to their walls
- Pastors can remove members from walls and ban disruptive users

### Prayer Request Submission
- Joined members can submit prayer requests to their walls
- Members can attach files (images, PDFs, documents up to 10MB)
- Members can optionally categorize prayers with multiple tags
- Authors can edit prayers within 5 minutes of posting
- Authors can soft-delete their own prayers anytime
- Deleted prayers can be restored by authors within 24 hours, by pastors within 30 days

### Anonymity System (3 Levels)
- **Fully Identified (Default)**: Name, profile picture, and online status visible to everyone
- **Anonymous to Members**: Identity hidden from members but visible to pastors in moderation view
- **Fully Anonymous**: Identity hidden from everyone including pastors (only system logs retain identity)
- Anonymity setting configurable globally in user profile, overridable per wall
- Anonymity does NOT apply in private walls (always identified)

### Prayer Categories
- System provides predefined categories: Healing, Guidance, Thanksgiving, Intercession, Family
- Church admins can create custom categories for their church
- Categories are optional (not required)
- Prayers can have multiple categories

### Prayer Threading (Max 3 Levels)
- Members can respond to prayers (Level 1)
- Members can reply to responses (Level 2)
- Members can reply to replies (Level 3 - maximum depth)
- Threads display chronologically within each level
- API validates thread depth and rejects attempts to exceed max depth

### Real-Time Communication (WebSocket)
- Instant delivery of new prayers and responses
- Typing indicators show when someone is composing a message
- Online/presence indicators show who is currently active
- Read receipts track who has seen messages (aggregate counts)
- Real-time moderation notifications for pastors

### Moderation & Flagging Workflow
- Any joined member can flag inappropriate content
- Flagged content is auto-hidden immediately from all members (except pastors)
- Pastors receive real-time notification of flagged content
- Pastors can review flagged content in moderation dashboard
- Pastors can take three actions:
  - **Delete**: Soft-delete content permanently
  - **Restore**: Unhide content and make it visible again
  - **Ban User**: Remove user from wall and optionally ban church-wide
- All moderation actions logged in permanent audit trail

### Notifications
- Granular per-wall notification preferences
- Notification types: New prayers, responses to my prayers, replies to my responses, mentions, wall invitations, moderation actions (pastors only)
- Delivery channels: In-app, push notifications (mobile), email (optional)
- Batched notifications to prevent spam (e.g., "5 new prayers in Youth Group")

### Scheduled Prayer Meetings (Nice-to-Have)
- Walls can have recurring schedules with frequency, day, time, timezone
- Automated status updates: Upcoming → Starting Soon (15 min before) → Ongoing → Ended
- Notifications sent at key transitions (e.g., "Peniel Hour starts in 15 minutes")
- Pastors can manually override status

## Visual Design

The API must support all UI patterns shown in the high-fidelity mockups:

**Mockup References:**
- `planning/visuals/Prayer Wall details.png` - Main chat interface with messages, tabs, and wall header
- `planning/visuals/Prayer Wall details-invite-friend.png` - Invitation modal and member selection
- `planning/visuals/Prayer Wall details-members.png` - Member list with online status indicators
- `planning/visuals/Prayer Wall details-remove-member.png` - Confirmation dialog for member removal

**Key UI Elements to Support:**
- Wall header: Name, schedule, status badge, admin badge, edit icon, "Join call" button
- Tab navigation: Messages (default) and Members with count
- Chat-style messages: Profile pictures, online indicators, timestamps, date separators
- Message bubbles: Left-aligned for others, right-aligned for "You"
- File attachments: Display filename and file size
- Message input: Text field with emoji picker and send button
- Member list: Scrollable with online status indicators and remove icons
- Invitation flow: Search/select users, send individual invites, confirmation modals
- Confirmation dialogs: Warning icon, clear messaging, destructive actions in red

**Design Patterns:**
- Purple primary color (#5B4EE5)
- Schedule format: "Every [day] [time] [timezone]"
- Status badges: "Ongoing" (red dot), "Admin" badge for creators
- Online presence: Green dot indicator
- Destructive actions require confirmation

## Reusable Components

### Existing Code to Leverage

**Repository Pattern:**
- Follow pattern from `src/notes/pg-repository.ts` and `src/cache/redis-cache.repository.ts`
- Use `RawDb` abstraction from `src/utils/database.ts` instead of direct postgres library usage
- Use `safeExecute` for all async operations
- Implement repository interfaces for testability
- All test files should reside in `src/tests/` directory organized by feature

**Handler Factory Pattern:**
- Follow pattern from existing routes (e.g., `src/notes/routes/`)
- Use `EndpointRequest` type from `src/types/endpoint-handler.ts`
- Access user with pattern: `req.user?.[1]?.['payload']?.['sub']`

**Error Handling:**
- Use `safeExecute` utility from `src/utils/handle-async.ts`
- Return tuple pattern `[Error] | [undefined, T]`
- Never use try/catch blocks directly

**Structured Logging:**
- Use request-scoped logging: `req.log?.info({ context }, 'message')`
- Use application-wide logging: Import `logger` from `src/logging`
- Never use `console.*` methods
- Always pass context object first, message second

**Authentication:**
- Reuse existing Keycloak JWT validation middleware
- Use `EndpointRequest` type with `user?: User` property
- Extract user ID: `const userId = req.user?.[1]?.['payload']?.['sub']`

**Caching (Redis):**
- Use existing `RedisCacheRepository` from `src/cache/redis-cache.repository.ts`
- ioredis already configured with proper error handling and reconnection logic
- Follow singleton pattern: `RedisCacheRepository.getInstance(connectionString)`

**File Upload:**
- Integrate with existing S3/R2 infrastructure in `src/media/` or `src/gallery/`
- Use existing file validation patterns
- Generate storage keys: `prayer-attachments/{wallId}/{prayerId}/{filename}`

**Validation:**
- Use Zod schemas for request/response validation (already in package.json)
- Follow pattern from `src/notes/schemas.ts`

**Database:**
- PostgreSQL connection via `RawDb` abstraction from `src/utils/database.ts`
- Never use the `postgres` package directly - always use `RawDb` type and `getRawDb()` helper
- Create migrations for all new tables in `/migrations` folder
- Migration files run in sequence based on naming (e.g., 008, 009, 010...)
- Use testcontainers for migration testing to ensure migrations work correctly
- Use UUIDs for primary keys (consistent with existing pattern)

### New Components Required

**WebSocket Server (Socket.io):**
- Socket.io not currently in project - needs to be added
- Required for real-time features (prayers, typing, presence)
- Redis adapter needed for horizontal scaling
- JWT authentication middleware for WebSocket connections

**Prayer Wall Domain:**
- PrayerWallRepository, PrayerRequestRepository, PrayerWallMembershipRepository
- PrayerWallService with business logic for wall management
- PrayerRequestService with threading validation and anonymity enforcement
- ModerationService for flagging workflow

**Notification System:**
- NotificationPreferenceRepository for user preferences
- NotificationService to check preferences and send notifications
- Background worker or queue for processing notifications
- Integration with FCM/APNs for push notifications (if not exists)

**Presence Tracking:**
- Redis-based presence tracking (user online/offline/away status)
- TTL-based expiration for inactive users
- Pub/sub for multi-server coordination

## Technical Approach

### Database Schema (PostgreSQL)

**Migration Strategy:**
- Create 9 entity tables with proper relationships
- Add indexes in separate migration for rollback safety
- Seed system categories on initial migration
- Use soft deletes (deleted_at timestamp) for all content

**Core Tables:**
1. `prayer_walls` - Wall metadata with schedule JSONB and video links
2. `prayer_wall_memberships` - Join table with invitation and ban tracking
3. `prayer_requests` - Prayers with self-referential threading (parent_id)
4. `prayer_categories` - System and custom categories
5. `prayer_request_categories` - Many-to-many join table
6. `prayer_attachments` - File metadata with S3/R2 storage keys
7. `flagged_content` - Moderation workflow tracking
8. `prayer_read_receipts` - Read tracking per user
9. `notification_preferences` - Per-wall granular settings

**Key Indexes:**
- Foreign keys: wall_id, author_id, parent_id, church_id, user_id
- Composite: (wall_id, created_at) for paginated queries
- Composite: (user_id, wall_id) for membership checks
- deleted_at for filtering soft-deleted content

### WebSocket Architecture (Socket.io)

**Setup:**
- Install: `socket.io` and `@socket.io/redis-adapter`
- Namespace: `/churches/:churchId/prayer-walls`
- Rooms: `wall-{wallId}` for each prayer wall
- JWT authentication middleware validates Keycloak token on handshake

**Event Types:**
- `prayer:created`, `prayer:updated`, `prayer:deleted` - Prayer lifecycle
- `prayer:response`, `prayer:reply` - Threading events
- `typing:start`, `typing:stop` - Typing indicators
- `user:online`, `user:offline`, `user:away` - Presence
- `prayer:read` - Read receipts
- `content:flagged`, `content:hidden`, `content:restored` - Moderation
- `member:joined`, `member:left`, `member:invited` - Membership

**Redis Integration:**
- Socket.io Redis adapter for multi-server pub/sub
- Store active connections in Redis
- Track presence with sorted sets (timestamps for TTL)
- Cache typing indicators with 5-second TTL

### API Endpoints (RESTful)

**Prayer Walls:**
- `GET /api/churches/:churchId/prayer-walls` - List all available walls
- `POST /api/churches/:churchId/prayer-walls` - Create wall (pastors only)
- `GET /api/churches/:churchId/prayer-walls/:wallId` - Get wall details
- `PATCH /api/churches/:churchId/prayer-walls/:wallId` - Update wall (creator only)
- `DELETE /api/churches/:churchId/prayer-walls/:wallId` - Archive wall (soft delete)

**Wall Membership:**
- `POST /api/prayer-walls/:wallId/join` - Join wall
- `POST /api/prayer-walls/:wallId/leave` - Leave wall
- `GET /api/prayer-walls/:wallId/members` - List members with online status
- `POST /api/prayer-walls/:wallId/invite` - Invite member (pastors)
- `DELETE /api/prayer-walls/:wallId/members/:userId` - Remove member (pastors)
- `POST /api/prayer-walls/:wallId/ban/:userId` - Ban user (pastors)

**Prayer Requests:**
- `GET /api/prayer-walls/:wallId/prayers` - List prayers (paginated, 20 per page)
- `POST /api/prayer-walls/:wallId/prayers` - Submit prayer
- `GET /api/prayer-walls/:wallId/prayers/:prayerId` - Get prayer with thread
- `PATCH /api/prayer-walls/:wallId/prayers/:prayerId` - Edit prayer (5 min window)
- `DELETE /api/prayer-walls/:wallId/prayers/:prayerId` - Soft-delete prayer
- `POST /api/prayer-walls/:wallId/prayers/:prayerId/restore` - Restore deleted prayer
- `POST /api/prayer-walls/:wallId/prayers/:prayerId/responses` - Add response (threading)

**Attachments:**
- `POST /api/prayer-walls/:wallId/prayers/upload` - Upload file (returns attachment ID)
- `GET /api/prayer-walls/:wallId/prayers/attachments/:attachmentId` - Get signed URL

**Moderation:**
- `POST /api/prayer-walls/:wallId/prayers/:prayerId/flag` - Flag content
- `GET /api/churches/:churchId/moderation/flagged` - List flagged content (pastors)
- `POST /api/moderation/flagged/:flagId/delete` - Delete flagged content (pastors)
- `POST /api/moderation/flagged/:flagId/restore` - Restore flagged content (pastors)
- `GET /api/churches/:churchId/moderation/audit` - View audit trail (pastors)

**Categories:**
- `GET /api/churches/:churchId/prayer-categories` - List categories (system + custom)
- `POST /api/churches/:churchId/prayer-categories` - Create custom category (admins)

**Notifications:**
- `GET /api/users/me/notification-preferences` - Get preferences
- `PATCH /api/users/me/notification-preferences/:wallId` - Update per-wall preferences

### Authentication & Authorization

**JWT Validation:**
- Use existing Keycloak middleware
- Extract user ID: `req.user?.[1]?.['payload']?.['sub']`
- Extract user roles: `req.user?.[1]?.['payload']?.['realm_access']?.['roles']`

**Authorization Matrix:**

| Action | Member | Pastor | Admin |
|--------|--------|--------|-------|
| View public walls | Yes | Yes | Yes |
| Join walls | Yes | Yes | Yes |
| Create public walls | No | Yes | Yes |
| Create private walls | No | Yes | No |
| Edit walls | Creator only | Creator only | Creator only |
| Invite members | No | Yes | Yes |
| Remove members | No | Yes | Yes |
| Submit prayers | Joined only | Joined only | Joined only |
| Flag content | Joined only | Joined only | Joined only |
| Review flagged content | No | Yes | Yes |
| Ban users | No | Yes | Yes |
| Create custom categories | No | No | Yes |

**Wall Access Control:**
- Public walls: Visible to all church members, must join to participate
- Private walls: Only visible to invited members
- Message content: Only viewable by joined members

**Anonymity Enforcement:**
- Service layer conditionally returns author info based on:
  - Requesting user's role (member vs pastor)
  - Author's anonymity setting
  - Wall type (private vs public)
- Backend always stores author_id for audit trail

### Threading Implementation

**Self-Referential Structure:**
- `parent_id` foreign key to `prayer_requests.id`
- `thread_depth` computed field (0 for root, max 3)
- Service validates depth before insert: `if (parent.thread_depth >= 3) reject`

**Query Strategy:**
- Fetch root prayers: `WHERE parent_id IS NULL AND wall_id = $wallId`
- Lazy load responses: Fetch children on demand
- Use recursive CTE for full thread retrieval if needed
- Return flat list with parent_id and thread_depth for frontend nesting

### Soft Delete & Restoration

**Audit Trail Retention: 2 YEARS**
- Text content is lightweight, 2 years is reasonable for accountability
- Automated cleanup job archives content older than 730 days

**Restoration Rules:**
- **Authors**: Can restore within 24 hours (prevents delete/restore abuse)
- **Pastors**: Can restore within 30 days (for accidental deletions)
- **Flagged Content**: Pastors can restore within 2 years (for false flags)

### Performance Optimization

**Caching Strategy:**
- Wall membership checks: Redis cache with 5-minute TTL
- User roles: Redis cache with 5-minute TTL
- Wall details: Redis cache with 1-minute TTL
- Presence data: Redis sorted sets with TTL
- Invalidate caches on updates (membership changes, wall edits)

**Pagination:**
- Default 20 prayers per page
- Use cursor-based pagination (last created_at) for infinite scroll
- Avoid OFFSET for large datasets

**Rate Limiting:**
- Prayer submissions: 5 per minute per user
- Flagging: 10 flags per hour per user
- Invitations: 20 invitations per hour per wall
- WebSocket messages: 100 per minute per connection

## Out of Scope

**Deferred to Future Phases:**
- Native video call hosting (Phase 3 - currently external links only)
- AI-powered content moderation (ML-based filtering)
- Prayer analytics (topic trends, response rates)
- Prayer reminders and follow-ups
- Personal prayer journaling outside walls
- Advanced roles within walls (Admin, Moderator, Member)
- Ownership transfer for walls
- Cross-church prayer wall discovery
- Multimedia prayers (voice notes, video prayers)
- Prayer wall widgets (embeddable on church websites)
- Advanced search (full-text search with filters)
- Prayer bookmarking/saving

**Explicitly Excluded:**
- Hard delete of any content (all deletes are soft deletes)
- Anonymity in private walls (always identified)
- Unlimited threading depth (max 3 levels enforced)
- Wall roles beyond creator/member distinction

## Success Criteria

### Functional Requirements
- [ ] Pastors can create public and private prayer walls
- [ ] Members can view all public walls and join them voluntarily
- [ ] Members can submit prayers with optional anonymity (3 levels)
- [ ] Members can respond to prayers with max 3-level threading
- [ ] File attachments (up to 10MB) can be added to prayers
- [ ] Real-time updates for new prayers, responses, typing, and presence
- [ ] Members can flag inappropriate content (auto-hidden)
- [ ] Pastors can review, delete, restore flagged content, and ban users
- [ ] Users have granular per-wall notification preferences
- [ ] Soft-deleted content can be restored within defined time windows
- [ ] Audit trail retains all moderation actions permanently

### Performance Benchmarks
- [ ] API response time < 200ms for 95th percentile
- [ ] WebSocket message delivery < 500ms
- [ ] Support 1000+ concurrent WebSocket connections per server
- [ ] Prayer list pagination loads in < 300ms
- [ ] Database queries use indexes (query plans reviewed)

### Security Requirements
- [ ] All endpoints require Keycloak JWT authentication
- [ ] Row-level access control enforced (users can only access joined walls)
- [ ] Anonymity settings respected in all API responses
- [ ] File uploads validated for type and size
- [ ] Rate limiting prevents spam and abuse
- [ ] Audit logs track all moderation actions with timestamps

### Quality Standards
- [ ] 80%+ test coverage (unit + integration)
- [ ] All code follows TDD approach (tests written first)
- [ ] Structured logging used throughout (no console.*)
- [ ] safeExecute pattern used for all async operations
- [ ] TypeScript strict mode enabled with no type errors
- [ ] Code review approved before merge

## Open Questions & Risks

### Technical Risks

**1. WebSocket Scaling**
- **Risk**: Socket.io may struggle with high concurrent connections
- **Mitigation**: Use Redis adapter for horizontal scaling, implement sticky sessions, load test early

**2. Threading Query Performance**
- **Risk**: Recursive queries for deep threads may be slow
- **Mitigation**: Use lazy loading (fetch children on demand), add composite indexes, limit thread depth to 3

**3. Real-Time Message Delivery Guarantees**
- **Risk**: WebSocket messages may be lost on connection drops
- **Mitigation**: Implement message queue fallback, store missed events in notification queue, support polling fallback

**4. Anonymity Enforcement Complexity**
- **Risk**: Accidentally exposing identity in edge cases (API responses, logs, WebSocket events)
- **Mitigation**: Centralize anonymity logic in service layer, write comprehensive tests, audit all API responses

**5. Rate Limiting at Scale**
- **Risk**: Redis rate limit counters may become bottleneck
- **Mitigation**: Use distributed rate limiting strategies, tune Redis performance, implement local rate limiting

### Dependencies

**External Services:**
- Keycloak (authentication) - existing dependency
- PostgreSQL (database) - existing dependency
- Redis (caching, WebSocket, rate limiting) - existing dependency
- S3/R2 (file storage) - existing dependency
- FCM/APNs (push notifications) - may need to be added

**New Libraries:**
- `socket.io` and `@socket.io/redis-adapter` - required for real-time features
- Push notification library (e.g., `node-push-notify` or direct API integration)

### Performance Concerns

**Database Growth:**
- Prayer requests may accumulate quickly in active churches
- Soft-deleted content retained for 2 years adds to storage
- **Mitigation**: Archive old content to cold storage, implement pagination everywhere, optimize indexes

**Redis Memory:**
- Presence tracking, typing indicators, and caching may consume significant memory
- **Mitigation**: Use TTLs aggressively, monitor Redis memory usage, consider Redis cluster for scaling

**File Storage Costs:**
- Attachments (10MB max) may add up
- **Mitigation**: Implement retention policy (e.g., delete attachments after 1 year), compress images

---

## Implementation Notes

### Code Structure

```
src/
├── prayer-walls/
│   ├── repositories/
│   │   ├── prayer-wall.repository.ts
│   │   ├── prayer-request.repository.ts
│   │   ├── prayer-wall-membership.repository.ts
│   │   ├── prayer-category.repository.ts
│   │   ├── prayer-attachment.repository.ts
│   │   ├── flagged-content.repository.ts
│   │   ├── prayer-read-receipt.repository.ts
│   │   └── notification-preference.repository.ts
│   ├── services/
│   │   ├── prayer-wall.service.ts
│   │   ├── prayer-request.service.ts
│   │   ├── moderation.service.ts
│   │   ├── notification.service.ts
│   │   └── presence.service.ts
│   ├── routes/
│   │   ├── walls.routes.ts
│   │   ├── prayers.routes.ts
│   │   ├── moderation.routes.ts
│   │   └── categories.routes.ts
│   ├── schemas/
│   │   ├── wall.schemas.ts
│   │   ├── prayer.schemas.ts
│   │   └── moderation.schemas.ts
│   └── types/
│       └── prayer-wall.types.ts
├── websocket/
│   ├── socket.server.ts
│   ├── middleware/
│   │   └── auth.middleware.ts
│   ├── handlers/
│   │   ├── prayer.handler.ts
│   │   ├── presence.handler.ts
│   │   └── moderation.handler.ts
│   └── events.ts
└── tests/
    ├── prayer-walls/
    │   ├── repositories/
    │   │   ├── prayer-wall.repository.test.ts
    │   │   ├── prayer-request.repository.test.ts
    │   │   └── ...
    │   ├── services/
    │   │   ├── prayer-wall.service.test.ts
    │   │   ├── prayer-request.service.test.ts
    │   │   └── ...
    │   └── routes/
    │       ├── walls.routes.test.ts
    │       ├── prayers.routes.test.ts
    │       └── ...
    └── websocket/
        ├── prayer.handler.test.ts
        ├── presence.handler.test.ts
        └── ...

migrations/ (root level, continues from existing migrations 001-007)
├── 008_create_prayer_walls.sql
├── 009_create_prayer_requests.sql
├── 010_create_prayer_categories.sql
├── 011_create_supporting_tables.sql
├── 012_add_indexes.sql
└── 013_seed_system_categories.sql
```

### Development Workflow

1. **Phase 1: Database & Core API** (Week 1, Days 1-3)
   - Create migrations for all 9 tables
   - Build repositories with basic CRUD operations
   - Implement core services (wall management, prayer submission)
   - Create REST endpoints for walls and prayers
   - Write unit and integration tests

2. **Phase 2: WebSocket & Real-Time** (Week 1, Days 4-5)
   - Set up Socket.io server with Redis adapter
   - Implement JWT authentication middleware
   - Build event handlers (prayers, responses, presence)
   - Integrate real-time events with REST API
   - Test WebSocket connection and message delivery

3. **Phase 3: Anonymity & Threading** (Week 2, Days 1-2)
   - Implement anonymity enforcement in service layer
   - Build threading validation and queries
   - Add file attachment support
   - Test anonymity scenarios and thread depth limits

4. **Phase 4: Moderation & Notifications** (Week 2, Days 3-4)
   - Build flagging workflow and moderation dashboard endpoints
   - Implement notification service with preferences
   - Add soft-delete restoration logic
   - Test moderation actions and audit trail

5. **Phase 5: Polish & Performance** (Week 2, Day 5)
   - Add caching for membership checks and wall details
   - Implement rate limiting
   - Load test WebSocket connections
   - Optimize database queries and indexes
   - Final integration testing

### Testing Strategy (TDD Approach)

**Test First, Then Implement:**
- Write failing test for each feature
- Implement minimum code to pass test
- Refactor and optimize
- Repeat

**Unit Tests (Vitest):**
- Service layer business logic (anonymity, threading validation)
- Repository CRUD operations (mocked database)
- Utility functions (date formatting, validation helpers)

**Integration Tests (Supertest):**
- API endpoints with real database (test database)
- Authentication and authorization flows
- Error handling and validation
- WebSocket event handlers

**E2E Tests:**
- Complete user flows (join wall → post prayer → receive response)
- Moderation workflows (flag → review → delete/restore)
- Anonymity scenarios (member sees anonymous, pastor sees identity)

**Load Tests (Artillery or K6):**
- Concurrent WebSocket connections (target: 1000+)
- Prayer submission throughput (target: 100/sec)
- Database query performance under load

### Deployment Considerations

**Environment Variables:**
- `SOCKET_IO_PORT` - WebSocket server port
- `REDIS_URL` - Redis connection string (already exists)
- `DATABASE_URL` - PostgreSQL connection string (already exists)
- `KEYCLOAK_URL`, `KEYCLOAK_REALM` - Auth config (already exists)
- `S3_BUCKET` or `R2_BUCKET` - File storage (already exists)
- `FCM_SERVER_KEY`, `APNS_KEY` - Push notification credentials (if needed)

**Feature Flags:**
- `FEATURE_PRAYER_WALLS_ENABLED` - Toggle entire feature
- `FEATURE_SCHEDULED_MEETINGS_ENABLED` - Toggle nice-to-have scheduling
- `FEATURE_FILE_ATTACHMENTS_ENABLED` - Toggle file uploads

**Monitoring:**
- Log all WebSocket connections/disconnections
- Track moderation actions with correlation IDs
- Monitor Redis memory usage
- Alert on high rate limit violations
- Track prayer submission rates per church

**Rollback Strategy:**
- Database migrations reversible (down migrations)
- Feature flags allow instant disable without deployment
- WebSocket server can run separately from REST API (gradual rollout)
- Cache invalidation on rollback to clear stale data