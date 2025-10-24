# Spec Requirements: Prayer Wall Foundation

## Initial Description

Create church-wide prayer walls where members submit prayer requests (with name or anonymously) and pastors/members respond with encouragement and intercession. Includes real-time updates, prayer threading, and moderation tools for church leadership.

This is the highest priority Phase 2 feature for Disciple API, providing a chat room-like feature where members can send prayers to the pastor and create private prayer walls to share prayers with other members.

## Requirements Discussion

### First Round Questions

**Q1: Prayer Wall Access Model**
**Question:** Should all church members automatically have access to all prayer walls, or should walls be invite-only/opt-in groups that members can join?
**Answer:** HYBRID APPROACH
- Users can be invited to prayer walls
- Walls are accessible to everyone in the church (church-wide visibility)
- Church members must JOIN a wall to participate (not automatic membership)
- This combines church-wide visibility with opt-in participation

**Q2: Multiple Prayer Walls - Details**
**Question:** The roadmap mentions "multiple prayer walls" for future phases. Can you clarify: Will each church have multiple topic-based walls (e.g., "Youth Prayers", "Healing", "Family")? Who can create new walls? Can members be part of multiple walls simultaneously? Should walls have scheduling (e.g., "Prayer meeting every Tuesday 7pm")?
**Answer:**
- **Wall Organization:** Topic-based walls (e.g., "Youth Prayers", "Healing", "Family")
- **Wall Creation:** Pastors and administrators can create walls
- **Access Control:** Can have restricted access to walls (decided during creation or afterward)
- **Private Walls:** Only pastors can create private walls for the church
- **Membership Limits:** No limit on groups a member can create/join
- **Scheduling:** Yes, support scheduling (nice-to-have, not absolutely necessary). Example: "Every Saturday 6AM WAT"
- **Video Links:** IN SCOPE - Include video call link capability for prayer walls

**Q3: Anonymity Settings**
**Question:** For anonymous prayer requests, should this be: A per-message setting (I can post some prayers with my name, others anonymously)? A user-level privacy setting (I'm always anonymous on prayer walls)? Different levels of anonymity (e.g., "Anonymous to members but visible to pastors")?
**Answer:** User setting (not per-message) with THREE ANONYMITY LEVELS:
1. Fully identified
2. Anonymous to members (pastors can see identity)
3. Fully anonymous (even pastors cannot see)

**Note:** Anonymity does NOT apply to private groups (always identified in private groups)

**Q4: Prayer Categories/Tags**
**Question:** Should prayers be categorized? (e.g., Healing, Guidance, Thanksgiving, Intercession). If yes: Should categories be predefined by the system, or can churches create custom categories? Are categories required or optional? Can a prayer have multiple categories?
**Answer:**
- **Initial Categories:** Healing, Guidance, Thanksgiving, Intercession, Family
- **Optional:** Not required to categorize prayers
- **Multiple Categories:** Yes, multiple categories allowed per prayer
- **Custom Categories:** Predefined by system + churches can add custom categories

**Q5: Real-time Features Scope**
**Question:** For "real-time updates", should we implement: WebSocket connections for instant updates? Typing indicators? Read receipts? Online/presence indicators? Or start with polling/refresh patterns and add WebSockets later?
**Answer:** Implement ALL real-time features using WebSockets:
- New prayer requests posted
- New responses/replies to prayers
- Typing indicators
- Online/presence indicators
- Read receipts

**Q6: Threading Depth**
**Question:** For "prayer threading/conversation support", what's the maximum depth? Should it be unlimited nesting, or limit to 2-3 levels (prayer -> response -> reply)?
**Answer:** Maximum 3 levels deep for nested threading

**Q7: Moderation - Flagging Workflow**
**Question:** For moderation tools, should there be: A "flag inappropriate content" feature for members? Auto-hide flagged content until reviewed? Notification to pastors when content is flagged? Ability to ban users from prayer walls?
**Answer:** Full flagging workflow:
1. Content is AUTO-HIDDEN when flagged
2. Notify pastors of flagged content
3. Pastors can:
   - Delete the content
   - Restore the content
   - Ban the user if necessary

**Q8: Soft Delete vs Hard Delete**
**Question:** When content is deleted (by author or moderator), should it be: Soft-deleted (hidden but kept for audit trail)? Hard-deleted (permanently removed)? Should authors be able to delete their own prayers/responses within a time window?
**Answer:**
- Authors can soft delete: TRUE
- Nobody can hard delete: TRUE (no hard deletes in the system)
- **Audit trail duration:** Needs recommendation
- **Soft-delete restoration:** Needs recommendation

**Q9: Member Management**
**Question:** For prayer wall membership: Can group creators edit wall details (name, description, schedule)? Can members leave walls voluntarily? Should there be roles within walls (Admin, Moderator, Member)? Can wall ownership be transferred?
**Answer:**
- Wall creators CAN EDIT wall details (name, description, schedule): YES
- Members CAN LEAVE walls voluntarily: YES
- Wall roles (Admin, Moderator, Member): NOT NECESSARY for now
- Ownership transfer: MAYBE but not yet (future consideration)

**Q10: Notification Preferences**
**Question:** Should users be able to customize their notification preferences per wall? (e.g., "Notify me for every prayer on Wall A, but only when someone responds to my prayers on Wall B")
**Answer:** User decides on their notification preferences. Provide GRANULAR CONTROL for all notification types:
- New prayers posted to walls they've joined
- Responses to their prayers
- Replies to their responses
- Mentions (if applicable)
- Wall invitations
- Moderation actions (for pastors)
- Per-wall customization supported

**Q11: Visual Design Fidelity**
**Question:** I found mockup files in the visuals folder. Should these be treated as high-fidelity designs to implement exactly, or low-fidelity wireframes showing general layout and structure?
**Answer:** HIGH-FIDELITY - Implement the exact UI/UX shown in the mockups. The API should support all UI patterns shown in the visuals.

### Existing Code to Reference

**Similar Features Identified:**
No existing prayer wall features in the codebase. However, this feature should follow established patterns:
- Repository pattern for data access
- Handler factory for endpoints
- safeExecute for async operations and error handling
- Zod for request validation
- Structured logging (Pino)
- Keycloak authentication and authorization

### Visual Assets Analysis

**Files Provided:**
- `Prayer Wall details.png`: Main prayer wall interface showing "Peniel Hour" with 190 members
- `Prayer Wall details-invite-friend.png`: Invite interface for adding members to prayer wall
- `Prayer Wall details-members.png`: Members list view showing current wall participants
- `Prayer Wall details-remove-member.png`: Confirmation dialog for removing a member

**Visual Insights:**

**From "Prayer Wall details.png":**
- Wall header shows: Name ("Peniel Hour"), schedule ("Every Saturday 6AM WAT"), status ("Ongoing")
- "Join call" button with phone icon (confirms video call link feature)
- Admin badge indicator for wall creator/admin
- Edit icon for wall details (confirms edit capability)
- Description/notes section for wall context
- Two tabs: "Messages" (default) and "Members 190"
- Chat-style message interface with:
  - Profile pictures with online indicators (green dot)
  - User names and timestamps
  - Message bubbles (left-aligned for others, right-aligned for "You")
  - File attachment support (shows "Tech requirements.pdf 1.2 MB")
  - Date separators ("Today", "Thursday")
  - Message input at bottom with emoji picker and send button

**From "Prayer Wall details-invite-friend.png":**
- Current members section showing 4 members with remove icons
- "Invite Friends" section below current members
- User search/selection interface
- Individual invitation modal: "Invite Olivia to Peniel Hour"
- Action buttons: "Send Invite" (primary) and "Discard" (secondary)
- "Share app" link option

**From "Prayer Wall details-members.png":**
- Member list with profile pictures and online status indicators
- Shows 4 current members
- Remove icon next to each member (circle with minus)
- Scrollable list of invitable friends below
- Clean, simple member management interface

**From "Prayer Wall details-remove-member.png":**
- Confirmation modal with warning icon
- "Remove from prayer wall" title
- Confirmation message: "Are you sure you want to [remove] Noah from this prayer wall?"
- Destructive action button: "Delete" (red)
- Cancel option

**Design Patterns Identified:**
- Tab-based navigation (Messages/Members)
- Modal dialogs for critical actions (invite, remove)
- Online presence indicators
- Status badges (Admin, Ongoing)
- Purple primary color (#5B4EE5 or similar)
- Schedule format: "Every [day] [time] [timezone]"
- Chat-style message layout with clear sender identification
- Destructive actions require confirmation
- Supporting features: file attachments, emojis, timestamps

**High-Fidelity Design Requirements:**
The API must support:
- Wall metadata (name, description, schedule, status)
- Member count and member list with online status
- Role indicators (admin badge)
- Message threading with file attachments
- Invitation system with pending/accepted states
- Member removal with confirmation workflow
- Video call link storage and display
- Real-time presence tracking
- Timestamp tracking for all messages
- Tab content switching (messages vs members view)

## Requirements Summary

### Feature Overview

Prayer Wall Foundation provides a hybrid community prayer platform where:
- Churches can create multiple topic-based prayer walls
- All church members can VIEW available walls (church-wide visibility)
- Members must JOIN a wall to PARTICIPATE (opt-in membership)
- Members can be INVITED to specific walls
- Real-time communication with prayers, responses, and threaded conversations
- Flexible anonymity settings for sensitive prayer requests
- Robust moderation tools for church leadership
- Scheduled prayer meetings with video call integration
- Granular notification controls

### User Roles and Permissions

**Church Members (Authenticated Users):**
- View all available prayer walls in their church
- Join/leave prayer walls voluntarily
- Submit prayer requests to walls they've joined
- Respond to prayers and participate in threaded discussions
- Choose anonymity level (fully identified, anonymous to members, or fully anonymous)
- Categorize prayers (optional)
- Flag inappropriate content
- Receive notifications based on preferences
- Upload attachments to messages
- See online/presence indicators
- View typing indicators
- Soft-delete their own content

**Pastors (Church Leadership):**
- All member permissions PLUS:
- Create new prayer walls (public and private)
- Edit wall details (name, description, schedule)
- Invite members to walls
- Remove members from walls
- See identity of "anonymous to members" prayers
- Review flagged content
- Restore or delete flagged content
- Ban users from walls or church-wide
- Access moderation audit trail
- Receive moderation notifications

**Church Administrators:**
- Same permissions as Pastors
- Create and manage custom prayer categories for their church
- Configure church-wide prayer wall settings

### Prayer Wall Types

**1. Public Church-Wide Walls (Default)**
- Visible to all church members
- Members must join to participate
- Can be topic-based (e.g., "Youth Prayers", "Healing", "Family")
- Supports invitations
- Full anonymity options available

**2. Private Walls (Pastor-Only Creation)**
- Only pastors can create
- Restricted access (invitation-only)
- Not visible to all members
- Anonymity does NOT apply (always identified)
- Useful for leadership prayer, counseling contexts

**3. Scheduled Walls**
- Can have recurring schedule (e.g., "Every Saturday 6AM WAT")
- Status indicator (Ongoing, Upcoming, Ended)
- Optional feature (nice-to-have for this phase)

**4. Video-Enabled Walls**
- Can include video call link
- Displayed with "Join call" button
- External video platform (not native hosting in this phase)

### Data Models

**PrayerWall Entity**
```
- id: UUID (primary key)
- church_id: UUID (foreign key to Church)
- name: string (e.g., "Peniel Hour", "Youth Prayers")
- description: text (optional)
- created_by: UUID (foreign key to User - pastor/admin)
- is_private: boolean (default false)
- has_restricted_access: boolean (default false)
- schedule: jsonb (optional - { frequency, day, time, timezone })
- video_call_link: string (optional URL)
- status: enum (active, archived)
- created_at: timestamp
- updated_at: timestamp
- deleted_at: timestamp (soft delete)
```

**PrayerWallMembership Entity**
```
- id: UUID (primary key)
- wall_id: UUID (foreign key to PrayerWall)
- user_id: UUID (foreign key to User)
- joined_at: timestamp
- invited_by: UUID (foreign key to User, optional)
- left_at: timestamp (optional - tracks when user left)
- is_banned: boolean (default false)
- banned_at: timestamp (optional)
- banned_by: UUID (foreign key to User, optional)
- created_at: timestamp
- updated_at: timestamp
```

**PrayerRequest Entity**
```
- id: UUID (primary key)
- wall_id: UUID (foreign key to PrayerWall)
- author_id: UUID (foreign key to User)
- content: text
- anonymity_level: enum (identified, anonymous_to_members, fully_anonymous)
- parent_id: UUID (foreign key to PrayerRequest, for threading - nullable)
- thread_depth: integer (0 for root, max 3)
- has_attachment: boolean
- created_at: timestamp
- updated_at: timestamp
- deleted_at: timestamp (soft delete)
- deleted_by: UUID (foreign key to User, optional)
```

**PrayerCategory Entity**
```
- id: UUID (primary key)
- name: string (e.g., "Healing", "Guidance", "Thanksgiving")
- church_id: UUID (foreign key to Church, nullable for system categories)
- is_system_category: boolean (true for predefined, false for custom)
- created_at: timestamp
- updated_at: timestamp
```

**PrayerRequestCategory Entity (Join Table)**
```
- id: UUID (primary key)
- prayer_request_id: UUID (foreign key to PrayerRequest)
- category_id: UUID (foreign key to PrayerCategory)
- created_at: timestamp
```

**PrayerAttachment Entity**
```
- id: UUID (primary key)
- prayer_request_id: UUID (foreign key to PrayerRequest)
- file_name: string
- file_size: integer (bytes)
- file_type: string (MIME type)
- storage_key: string (S3/R2 key)
- uploaded_by: UUID (foreign key to User)
- created_at: timestamp
```

**FlaggedContent Entity**
```
- id: UUID (primary key)
- prayer_request_id: UUID (foreign key to PrayerRequest)
- flagged_by: UUID (foreign key to User)
- reason: text (optional)
- status: enum (pending, reviewed, restored, deleted)
- reviewed_by: UUID (foreign key to User - pastor, optional)
- reviewed_at: timestamp (optional)
- resolution_action: enum (restore, delete, ban_user, null)
- resolution_notes: text (optional)
- created_at: timestamp
- updated_at: timestamp
```

**PrayerReadReceipt Entity**
```
- id: UUID (primary key)
- prayer_request_id: UUID (foreign key to PrayerRequest)
- user_id: UUID (foreign key to User)
- read_at: timestamp
- created_at: timestamp
```

**NotificationPreference Entity**
```
- id: UUID (primary key)
- user_id: UUID (foreign key to User)
- wall_id: UUID (foreign key to PrayerWall, nullable for global settings)
- new_prayers: boolean (default true)
- responses_to_my_prayers: boolean (default true)
- replies_to_my_responses: boolean (default true)
- wall_invitations: boolean (default true)
- moderation_actions: boolean (default true for pastors, false for members)
- created_at: timestamp
- updated_at: timestamp
```

**Entity Relationships:**
- Church → PrayerWall (1:many)
- User → PrayerWall (many:many through PrayerWallMembership)
- PrayerWall → PrayerRequest (1:many)
- PrayerRequest → PrayerRequest (self-referential for threading)
- PrayerRequest → PrayerCategory (many:many through PrayerRequestCategory)
- PrayerRequest → PrayerAttachment (1:many)
- PrayerRequest → FlaggedContent (1:many)
- PrayerRequest → PrayerReadReceipt (1:many)
- User → NotificationPreference (1:many)

### Access Control Rules

**Wall Visibility:**
- Public walls: Visible to all church members (browse/discover)
- Private walls: Only visible to invited members
- Wall details (name, description, schedule) viewable by all church members
- Message content only viewable by joined members

**Wall Creation:**
- Public walls: Pastors and Administrators
- Private walls: Pastors only

**Wall Management:**
- Edit wall details: Wall creator (pastor/admin who created it)
- Invite members: Wall creator + pastors
- Remove members: Wall creator + pastors
- Delete walls: Wall creator only (soft delete)

**Content Creation:**
- Submit prayers: Any joined member
- Respond to prayers: Any joined member
- Threading depth: Max 3 levels

**Content Deletion:**
- Authors: Can soft-delete their own content anytime
- Pastors: Can soft-delete any content in walls they have access to
- Hard delete: NOT ALLOWED (no one can hard delete)

**Moderation:**
- Flag content: Any joined member
- Review flagged content: Pastors only
- Ban users: Pastors only
- View audit trail: Pastors only

**Anonymity Enforcement:**
- Fully identified: Name and profile visible to everyone
- Anonymous to members: Identity hidden from members, visible to pastors
- Fully anonymous: Identity hidden from everyone including pastors
- Private walls: Anonymity NOT available (always identified)

### Real-time Features Specification

**WebSocket Implementation (Socket.io):**

**Connection Management:**
- Authenticate WebSocket connections using Keycloak JWT
- Maintain user presence per prayer wall
- Auto-reconnect on connection loss
- Heartbeat/ping-pong for connection health

**Real-time Events:**

1. **Prayer Request Events**
   - `prayer:created` - New prayer posted to wall
   - `prayer:updated` - Prayer content edited (within time window)
   - `prayer:deleted` - Prayer soft-deleted by author
   - Payload: prayer data, author info (respecting anonymity), timestamp

2. **Response/Reply Events**
   - `prayer:response` - New response to a prayer
   - `prayer:reply` - Reply to a response (threading)
   - Payload: response data, parent prayer/response ID, author info, timestamp

3. **Typing Indicators**
   - `typing:start` - User started typing
   - `typing:stop` - User stopped typing
   - Scoped to specific prayer thread
   - Debounced (clear after 3 seconds of inactivity)

4. **Presence Indicators**
   - `user:online` - User joined wall
   - `user:offline` - User left wall
   - `user:away` - User inactive (5 minutes)
   - Payload: user ID, status, timestamp

5. **Read Receipts**
   - `prayer:read` - User read a prayer/response
   - Aggregate counts (e.g., "Read by 15 members")
   - Don't show individual read status unless requested

6. **Moderation Events**
   - `content:flagged` - Content flagged (pastors only)
   - `content:hidden` - Content auto-hidden (pastors only)
   - `content:restored` - Flagged content restored (all members)
   - `user:banned` - User banned from wall (all members)

7. **Membership Events**
   - `member:joined` - New member joined wall
   - `member:left` - Member left wall
   - `member:invited` - Member invited to wall

**Redis Integration:**
- Store active WebSocket connections (connection pool)
- Track user presence per wall (sorted sets with timestamps)
- Cache typing indicators (expire after 5 seconds)
- Pub/sub for multi-server WebSocket distribution

**Message Delivery Guarantees:**
- At-least-once delivery for critical events (prayers, responses)
- Best-effort for presence/typing (acceptable to lose)
- Fallback to polling if WebSocket unavailable
- Store missed events in user's notification queue

### Anonymity System

**Anonymity Levels:**

1. **Fully Identified (Default)**
   - Profile picture visible
   - Full name visible
   - All metadata visible (online status, read receipts)

2. **Anonymous to Members**
   - Display: "Anonymous Member"
   - Generic avatar/placeholder image
   - Pastors see: Full identity in backend/moderation view
   - Members see: Anonymous indicator
   - Online status: Hidden
   - Read receipts: Aggregated only

3. **Fully Anonymous**
   - Display: "Anonymous"
   - Generic avatar/placeholder image
   - Even pastors see: Anonymous (identity fully protected)
   - System logs: Identity recorded for audit (emergency use only)
   - Online status: Hidden
   - Read receipts: Aggregated only

**Implementation Details:**
- User sets anonymity level in their profile settings (global default)
- Can override per prayer wall (e.g., anonymous in "Mental Health" wall, identified in "Youth Group")
- Anonymity does NOT apply in private walls (always identified)
- Backend always stores author_id (for audit trail, abuse prevention)
- API responses conditionally include author details based on:
  - Requesting user's role (member vs pastor)
  - Author's anonymity setting
  - Wall type (private vs public)

**Abuse Prevention:**
- Flagged anonymous content triggers pastor review
- Pastors can see identity of "anonymous to members" prayers when flagged
- System logs retain full identity for "fully anonymous" prayers (emergency access only)
- Repeated abuse from anonymous accounts can lead to bans

### Moderation and Flagging Workflow

**Content Flagging:**

1. **Member Flags Content**
   - Any joined member can flag prayers/responses
   - Flagging options: "Inappropriate", "Spam", "Harassment", "Other"
   - Optional reason text field
   - Content immediately AUTO-HIDDEN from all members (except pastors)

2. **Pastor Notification**
   - Real-time notification to all pastors in the church
   - Notification includes: Content snippet, flagger info, wall name, timestamp
   - Pastors see flagged content in moderation queue

3. **Pastor Review**
   - Pastors access moderation dashboard
   - View flagged content (full context - thread, author identity if anonymous-to-members)
   - Three actions available:
     a. **Delete**: Soft-delete the content permanently (hidden from everyone)
     b. **Restore**: Unhide the content (make visible again to all members)
     c. **Ban User**: Remove user from wall and optionally ban church-wide

4. **Resolution Actions**

   **Delete:**
   - Content soft-deleted (deleted_at timestamp set)
   - Original author notified (if identifiable)
   - Flagger notified (optional)
   - Audit log entry created

   **Restore:**
   - Content unhidden (made visible to all members)
   - Flagger notified of decision (optional)
   - Audit log entry created

   **Ban User:**
   - User's PrayerWallMembership record updated (is_banned = true)
   - User removed from wall immediately
   - User cannot rejoin that wall
   - Optional: Church-wide ban (affects all walls)
   - User notified of ban
   - Audit log entry created

5. **Audit Trail**
   - All moderation actions logged in FlaggedContent entity
   - Tracks: Who flagged, who reviewed, action taken, reason, timestamp
   - Pastors can view full moderation history
   - Retention: Permanent (for accountability)

**Auto-Moderation (Future Enhancement):**
- Placeholder for ML-based content filtering
- Profanity detection
- Spam detection
- Auto-flag suspicious patterns

**Moderation Dashboard Requirements:**
- List all flagged content (pending review)
- Filter by wall, date, flagger
- View content in context (full thread)
- One-click actions (delete, restore, ban)
- View moderation history
- Stats: Total flags, resolution times, ban counts

### Notification System

**Notification Types:**

1. **Prayer Activity**
   - New prayer posted to walls user joined
   - Response to user's prayer
   - Reply to user's response
   - Prayer assigned to user (if assignment feature added)

2. **Membership Activity**
   - Invited to prayer wall
   - Invitation accepted by invitee
   - Member joined wall you created
   - Member left wall you created
   - Removed from wall

3. **Moderation Activity (Pastors Only)**
   - Content flagged in any wall
   - User banned from wall
   - Flagged content requires review

4. **Scheduled Events**
   - Upcoming scheduled prayer meeting (e.g., "Starts in 15 minutes")
   - Scheduled prayer meeting started (wall status = ongoing)

**Notification Preferences:**

Per-Wall Granularity:
```
Wall A (e.g., "Youth Prayers"):
  - New prayers: ON
  - Responses to my prayers: ON
  - Replies to my responses: ON
  - Member joined/left: OFF

Wall B (e.g., "Healing"):
  - New prayers: OFF (too noisy)
  - Responses to my prayers: ON
  - Replies to my responses: ON
  - Member joined/left: OFF

Global Settings:
  - Wall invitations: ON
  - Moderation actions (pastors): ON
```

**Notification Delivery Channels:**
- In-app notifications (primary)
- Push notifications (mobile apps)
- Email notifications (optional, configurable)
- WebSocket real-time notifications

**Implementation:**
- NotificationPreference entity stores user preferences
- Default preferences applied on wall join
- Users can modify preferences per wall
- Notification service checks preferences before sending
- Batch notifications (don't spam for rapid activity)

### Integration Points

**Existing System Integration:**

1. **Churches**
   - Prayer walls belong to churches (church_id foreign key)
   - Church members can access their church's walls
   - Church admin settings may affect prayer wall features
   - Integration point: `/churches/:churchId/prayer-walls`

2. **Users (Keycloak Authentication)**
   - All prayer wall access requires authentication
   - User roles (pastor, admin, member) from Keycloak
   - User identity used for authorship, membership, moderation
   - JWT tokens used for WebSocket authentication
   - Integration point: Keycloak user ID mapping

3. **Media/File Storage**
   - Prayer attachments use existing file upload infrastructure
   - Store in S3/R2 (same as other media)
   - File type validation (images, PDFs, documents)
   - File size limits (configurable, e.g., 10MB max)
   - Integration point: Existing media upload endpoints/services

4. **Notifications**
   - Leverage existing notification infrastructure (if any)
   - If not exists, build notification service for prayer walls
   - Integration point: Notification service/repository

5. **Caching (Redis)**
   - Cache wall membership for quick access checks
   - Cache user presence data
   - Cache typing indicators
   - Cache read receipts (aggregate counts)
   - Integration point: Existing Redis connection/cache repository

**New Components:**
- PrayerWall module with controllers, services, repositories
- WebSocket module for real-time features
- Moderation module for flagging workflow
- Notification preference module

### Technical Requirements

**Technology Stack:**
- Express 5 + TypeScript 5
- PostgreSQL for relational data (prayer walls, requests, memberships)
- Redis for real-time features (presence, typing, caching)
- Socket.io for WebSocket implementation
- Zod for request/response validation
- Pino for structured logging
- Keycloak for authentication/authorization

**Database Schema:**
- 9 core entities (see Data Models section)
- Indexes on:
  - wall_id (for querying prayers by wall)
  - author_id (for user's prayers)
  - parent_id (for threading queries)
  - deleted_at (for filtering soft-deleted content)
  - created_at (for chronological ordering)
- Composite indexes:
  - (wall_id, created_at) for paginated wall queries
  - (user_id, wall_id) for membership checks
  - (prayer_request_id, user_id) for read receipt checks

**API Design Patterns:**
- RESTful endpoints for CRUD operations
- WebSocket events for real-time features
- Repository pattern for data access (PrayerWallRepository, PrayerRequestRepository, etc.)
- Service layer for business logic (PrayerWallService, ModerationService, etc.)
- Handler factory pattern for endpoint controllers
- safeExecute for all async operations and error handling
- Zod schemas for request validation
- Structured logging with context (req.log in handlers, logger in services)
- EndpointRequest type for typed request objects

**Threading Implementation:**
- parent_id: Self-referential foreign key to PrayerRequest
- thread_depth: Computed field (0 = root, 1 = response, 2 = reply, 3 = max)
- Validation: Reject if parent.thread_depth >= 3
- Query optimization: Recursive CTE or application-level threading
- Ordering: Chronological within thread level

**WebSocket Architecture:**
- Socket.io for WebSocket server
- Redis adapter for multi-server scaling (Socket.io Redis adapter)
- Namespace per church (e.g., `/church/:churchId/prayer-walls`)
- Rooms per wall (e.g., `wall-{wallId}`)
- Middleware for JWT authentication
- Event handlers for each real-time event type
- Error handling and reconnection logic

**Performance Considerations:**
- Paginated queries for prayers (20-50 per page)
- Lazy load threaded responses (expand on demand)
- Cache wall membership checks (Redis)
- Index optimization for common queries
- WebSocket connection pooling
- Rate limiting on prayer submissions (prevent spam)
- Attachment size limits (10MB default)

**Security Requirements:**
- Keycloak JWT validation on all endpoints
- Row-level access control (user can only access joined walls)
- Anonymity enforcement in API responses
- XSS prevention (sanitize user content)
- CSRF protection (standard Express middleware)
- Rate limiting on flagging (prevent abuse)
- Audit logging for all moderation actions
- Secure WebSocket connections (WSS in production)

**Error Handling:**
- safeExecute for all promises and unsafe operations
- Structured error responses (Zod validation errors, business logic errors)
- Graceful degradation (WebSocket fails → polling fallback)
- User-friendly error messages
- Detailed logging for debugging (correlation IDs)

**Testing Requirements:**
- Unit tests for services and repositories
- Integration tests for endpoints
- WebSocket event tests
- Anonymity logic tests
- Moderation workflow tests
- Threading depth validation tests
- Load testing for WebSocket connections

### Functional Requirements

**Core Functionality:**

1. **Prayer Wall Management**
   - Create prayer walls (pastors/admins)
   - Edit wall details (name, description, schedule, video link)
   - List all available walls (church members)
   - View wall details (members, message count, schedule)
   - Archive walls (soft delete)
   - Set wall privacy (public/private)
   - Set access restrictions

2. **Prayer Wall Membership**
   - Join wall (opt-in for public walls)
   - Leave wall voluntarily
   - Invite members to wall
   - Accept/decline wall invitations
   - Remove members from wall (pastors)
   - Ban users from wall (pastors)
   - View member list with online status
   - Search/filter members for invitation

3. **Prayer Requests**
   - Submit prayer requests to joined walls
   - Add categories to prayers (optional, multiple)
   - Attach files to prayers (images, PDFs, documents)
   - Edit prayers (within time window, e.g., 5 minutes)
   - Soft-delete own prayers
   - View prayers in chronological order (paginated)
   - Filter prayers by category
   - Search prayers by content

4. **Prayer Threading**
   - Respond to prayers (1st level)
   - Reply to responses (2nd level)
   - Reply to replies (3rd level - max depth)
   - View threaded conversations (expand/collapse)
   - Navigate nested threads

5. **Anonymity Controls**
   - Set global anonymity preference (profile settings)
   - Override anonymity per wall
   - Three anonymity levels (identified, anonymous-to-members, fully-anonymous)
   - Privacy enforcement in API responses

6. **Real-time Communication**
   - WebSocket connection management
   - Receive new prayers instantly
   - Receive responses/replies instantly
   - Show typing indicators
   - Show online/presence indicators
   - Send/receive read receipts
   - Auto-scroll to new messages

7. **Moderation**
   - Flag inappropriate content
   - Review flagged content (pastors)
   - Delete flagged content (pastors)
   - Restore flagged content (pastors)
   - Ban users from walls (pastors)
   - View moderation audit trail (pastors)
   - Receive moderation notifications (pastors)

8. **Notifications**
   - Configure notification preferences (per-wall)
   - Receive in-app notifications
   - Receive push notifications (mobile)
   - Receive email notifications (optional)
   - Mark notifications as read
   - View notification history

9. **Scheduled Prayer Meetings (Nice-to-Have)**
   - Set recurring schedule for wall
   - Display upcoming meeting time
   - Notify members before meeting starts
   - Update wall status (ongoing, upcoming)
   - Join video call link

10. **Custom Categories**
    - Church admins can create custom categories
    - Predefined system categories available
    - Categorize prayers with multiple tags
    - Filter/browse by category

### Reusability Opportunities

No existing prayer wall features to reuse, but should leverage:

**Existing Patterns:**
- Repository pattern (e.g., existing repositories like `UserRepository`, `ChurchRepository`)
- Handler factory pattern for endpoints
- safeExecute utility for error handling
- Structured logging (Pino with req.log and logger)
- Zod validation schemas
- EndpointRequest type for typed requests
- Authentication middleware (Keycloak JWT validation)

**Existing Infrastructure:**
- PostgreSQL database connection
- Redis connection for caching
- S3/R2 for file storage (media/attachments)
- Keycloak authentication service
- Existing error handling middleware
- Request logging middleware

**Similar Features to Model After:**
- If the project has chat/messaging features, model threading and real-time updates after those
- If the project has notification system, integrate with existing notification infrastructure
- If the project has moderation/flagging in other contexts, reuse that pattern
- If the project has file upload features, reuse upload service for prayer attachments

### Scope Boundaries

**In Scope (This Phase):**

**Prayer Wall Core:**
- Create, edit, view, archive prayer walls
- Topic-based walls with descriptions
- Public and private wall types
- Wall membership (join, leave, invite, remove)
- Scheduled meetings support (date, time, recurrence)
- Video call link integration (external platform)

**Prayer Requests:**
- Submit, edit, soft-delete prayer requests
- Threaded conversations (max 3 levels)
- Optional categorization (multiple categories)
- File attachments (images, PDFs, documents)
- Anonymity system (3 levels)

**Real-time Features:**
- WebSocket implementation (Socket.io)
- New prayer/response notifications
- Typing indicators
- Online/presence indicators
- Read receipts

**Moderation:**
- Content flagging by members
- Auto-hide flagged content
- Pastor review workflow
- Delete, restore, ban actions
- Moderation audit trail

**Notifications:**
- Granular notification preferences (per-wall)
- In-app notifications
- Push notifications (mobile)
- Email notifications (optional)

**Integration:**
- Keycloak authentication
- Church/user integration
- File storage integration (S3/R2)
- Redis caching for real-time features

**Out of Scope (Future Phases):**

**Deferred to Future:**
- Native video call hosting (Phase 3)
- AI-powered content moderation (ML-based filtering)
- Prayer analytics (e.g., most prayed topics, response rates)
- Prayer reminders/follow-ups (e.g., "Prayed for this 2 weeks ago, any updates?")
- Prayer journaling (personal prayer history outside walls)
- Prayer chains (structured prayer relay)
- Wall templates (e.g., "Create a healing wall with preset categories")
- Advanced roles within walls (Admin, Moderator, Member roles)
- Ownership transfer for walls
- Prayer wall discovery (public walls across churches)
- Multimedia prayers (voice notes, video prayers)
- Prayer translations (multi-language support)
- Prayer wall widgets (embed on church website)
- Mobile app-specific features (camera integration, voice-to-text)
- Advanced search (full-text search with filters)
- Prayer bookmarking/saving
- Prayer sharing outside walls (export, print)

**Explicitly Excluded:**
- Hard delete of any content (all deletes are soft deletes)
- Anonymity in private walls (always identified)
- Unlimited threading depth (max 3 levels)
- Wall roles (Admin, Moderator, Member) - not in this phase
- Ownership transfer - deferred to future

### Technical Considerations

**1. WebSocket Implementation (Socket.io)**

**Why Socket.io:**
- Mature, well-documented library
- Built-in fallback to polling if WebSocket unavailable
- Room/namespace support for organizing connections
- Redis adapter for horizontal scaling
- Reconnection handling out-of-the-box
- Binary data support (for file notifications)

**Implementation Plan:**
- Install: `socket.io` and `@socket.io/redis-adapter`
- Create WebSocket server in Express app
- Namespace: `/churches/:churchId/prayer-walls`
- Rooms: `wall-{wallId}` for each prayer wall
- Middleware: JWT authentication (validate Keycloak token)
- Event handlers: prayer:created, prayer:response, typing:start, etc.
- Redis pub/sub for multi-server coordination

**Code Structure:**
```
src/websocket/
  ├── socket.server.ts          # Socket.io server setup
  ├── middleware/
  │   └── auth.middleware.ts    # JWT validation for WebSocket
  ├── handlers/
  │   ├── prayer.handler.ts     # Prayer events
  │   ├── presence.handler.ts   # Online/offline/typing
  │   └── moderation.handler.ts # Flagging events
  └── events.ts                 # Event type definitions
```

**2. Database Schema (PostgreSQL)**

**Schema Design:**
- Use UUIDs for all primary keys (consistent with existing pattern)
- Soft deletes with `deleted_at` timestamp
- Indexes on foreign keys and frequently queried fields
- JSONB for flexible data (e.g., schedule configuration)
- Timestamps: `created_at`, `updated_at` on all tables

**Migration Strategy:**
- Create migrations for all 9 entities
- Add indexes in separate migration (for rollback)
- Seed system categories (Healing, Guidance, Thanksgiving, Intercession, Family)
- Test migrations in development before production

**Sample Migration (PrayerWall):**
```sql
CREATE TABLE prayer_walls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  is_private BOOLEAN DEFAULT FALSE,
  has_restricted_access BOOLEAN DEFAULT FALSE,
  schedule JSONB,
  video_call_link VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_prayer_walls_church_id ON prayer_walls(church_id);
CREATE INDEX idx_prayer_walls_created_by ON prayer_walls(created_by);
CREATE INDEX idx_prayer_walls_deleted_at ON prayer_walls(deleted_at);
```

**3. Redis Usage**

**Use Cases:**
- **Connection Pool:** Store active WebSocket connections
- **Presence Tracking:** Sorted sets with user IDs and last-seen timestamps
- **Typing Indicators:** Keys with TTL (5 seconds)
- **Read Receipts Cache:** Aggregate counts per prayer
- **Membership Cache:** Quick access checks (wall_id:user_id)
- **Socket.io Pub/Sub:** Multi-server WebSocket coordination

**Cache Invalidation:**
- Membership cache: Invalidate on join/leave/ban
- Read receipts: Invalidate on new read
- Presence: Auto-expire with TTL
- Typing indicators: Auto-expire after 5 seconds

**4. Keycloak Integration**

**Authentication Flow:**
- Standard JWT validation on REST endpoints (existing middleware)
- WebSocket authentication: Extract JWT from handshake query/headers
- User roles: Map Keycloak roles to prayer wall permissions
  - `pastor` role → Can create walls, moderate content
  - `admin` role → Can create walls, manage church categories
  - Default (member) → Can join walls, submit prayers

**User Identity:**
- User ID from JWT `sub` claim
- Use existing pattern: `req.user?.[1]?.['payload']?.['sub']`
- Store Keycloak user ID in prayer wall entities (author_id, created_by, etc.)

**5. Threading Implementation**

**Approach:**
- Self-referential foreign key (`parent_id`)
- Computed `thread_depth` field (0-3)
- Validation in service layer: Reject if parent depth >= 3

**Query Strategy:**
- Fetch root prayers (parent_id IS NULL)
- Lazy load responses (fetch children on demand)
- Recursive CTE for full thread (if needed):
```sql
WITH RECURSIVE thread AS (
  SELECT *, 0 AS depth FROM prayer_requests WHERE id = $rootId
  UNION ALL
  SELECT pr.*, t.depth + 1
  FROM prayer_requests pr
  INNER JOIN thread t ON pr.parent_id = t.id
  WHERE t.depth < 3
)
SELECT * FROM thread ORDER BY created_at;
```

**UI Consideration:**
- API returns flat list with `parent_id` and `thread_depth`
- Frontend builds nested structure
- "Load more replies" for collapsed threads

**6. Anonymity Enforcement**

**Service Layer Logic:**
```typescript
function getAuthorInfo(prayer: PrayerRequest, requestingUser: User): AuthorInfo {
  if (prayer.anonymity_level === 'identified') {
    return { id: prayer.author_id, name: author.name, avatar: author.avatar };
  }

  if (prayer.anonymity_level === 'anonymous_to_members') {
    if (requestingUser.role === 'pastor') {
      return { id: prayer.author_id, name: author.name, avatar: author.avatar };
    }
    return { id: null, name: 'Anonymous Member', avatar: 'placeholder.png' };
  }

  if (prayer.anonymity_level === 'fully_anonymous') {
    return { id: null, name: 'Anonymous', avatar: 'placeholder.png' };
  }
}
```

**API Response:**
```json
{
  "id": "prayer-uuid",
  "content": "Please pray for my family...",
  "author": {
    "id": null,
    "name": "Anonymous Member",
    "avatar": "placeholder.png"
  },
  "created_at": "2025-10-24T10:30:00Z"
}
```

**7. Moderation Audit Trail**

**Retention Policy:** PERMANENT (for accountability)

**Audit Log Includes:**
- Flagger ID and timestamp
- Reviewer ID and timestamp
- Action taken (delete, restore, ban)
- Resolution notes
- Content snapshot (before deletion)

**Access Control:**
- Only pastors can view audit trail
- Searchable by wall, date, action type
- Exportable for church records

**8. File Upload (Attachments)**

**Existing Infrastructure:**
- Reuse existing S3/R2 upload service
- File validation: Type (images, PDFs, docs), size (10MB limit)
- Generate storage key (e.g., `prayer-attachments/{wallId}/{prayerId}/{filename}`)
- Return signed URL for download

**Attachment Flow:**
1. User uploads file to dedicated endpoint: `POST /api/prayer-walls/:wallId/prayers/upload`
2. Service validates and uploads to S3/R2
3. Returns attachment metadata (file_name, file_size, storage_key)
4. User includes attachment ID in prayer request creation
5. Link PrayerAttachment to PrayerRequest

**Security:**
- Validate user has access to wall before upload
- Scan files for malware (if service available)
- Expire unused attachments (uploaded but not linked to prayer)

**9. Notification Service**

**Architecture:**
- Notification queue (Redis or database table)
- Background worker processes notifications
- Check user preferences before sending
- Support multiple channels (in-app, push, email)

**Delivery:**
- In-app: Store in database, mark as read when viewed
- Push: Integrate with FCM (Firebase Cloud Messaging) or APNs (Apple Push Notification service)
- Email: Use existing email service (SendGrid, SES, etc.)

**Batching:**
- Don't send notification for every prayer in rapid succession
- Batch notifications: "5 new prayers in Youth Group"
- Debounce: Wait 30 seconds, collect events, send one notification

**10. Performance Optimization**

**Pagination:**
- Default: 20 prayers per page
- Use cursor-based pagination (last_created_at) for infinite scroll
- Avoid OFFSET (slow for large datasets)

**Caching Strategy:**
- Cache wall membership checks (5 minutes TTL)
- Cache user roles (5 minutes TTL)
- Cache wall details (1 minute TTL)
- Invalidate on updates

**Query Optimization:**
- Index all foreign keys
- Composite index: (wall_id, created_at) for paginated queries
- Use `SELECT` with specific columns (avoid `SELECT *`)
- Eager load necessary relations (wall, author) in single query

**WebSocket Scaling:**
- Redis adapter for multi-server WebSocket
- Sticky sessions (route user to same server) for connection stability
- Horizontal scaling: Add more servers, Redis handles pub/sub

**11. Rate Limiting**

**Prevent Abuse:**
- Prayer submissions: 5 per minute per user
- Flagging: 10 flags per hour per user
- Invitations: 20 invitations per hour per wall
- WebSocket messages: 100 per minute per connection

**Implementation:**
- Use `express-rate-limit` middleware
- Store rate limit counters in Redis
- Return 429 status with retry-after header

**12. Testing Strategy**

**Unit Tests:**
- Service layer logic (anonymity enforcement, threading validation)
- Repository CRUD operations
- Utility functions (safeExecute, formatting)

**Integration Tests:**
- API endpoints (CRUD prayer walls, prayers, responses)
- Authentication/authorization flows
- Moderation workflows (flag, review, delete, restore, ban)
- WebSocket events (connect, disconnect, emit, receive)

**E2E Tests:**
- Complete user flows (join wall → post prayer → receive response)
- Anonymity scenarios (member sees anonymous, pastor sees identity)
- Moderation scenarios (flag content → pastor reviews → deletes)

**Load Tests:**
- WebSocket connection capacity (how many concurrent connections?)
- Prayer submission throughput (how many prayers per second?)
- Database query performance (pagination, threading queries)

**Tools:**
- Jest for unit/integration tests
- Supertest for HTTP endpoint tests
- Socket.io-client for WebSocket tests
- K6 or Artillery for load testing

## Recommendations

Based on the requirements gathered, here are my recommendations for the uncertain items:

### 1. Soft-Delete Audit Trail Duration

**Recommendation: 2 YEARS (730 days)**

**Rationale:**
- **Legal/Compliance:** Some jurisdictions require retaining user-generated content for dispute resolution (typically 1-2 years)
- **Church Context:** Churches may need historical records for accountability, especially for sensitive content or moderation disputes
- **Storage Cost:** Text content is lightweight; 2 years of soft-deleted prayers won't significantly impact database size
- **Balance:** Long enough for meaningful audit trails, short enough to respect user privacy expectations

**Implementation:**
- Automated cleanup job: Archive soft-deleted content older than 2 years
- Archive to cold storage (S3 Glacier) if needed for compliance
- Retain moderation audit logs indefinitely (separate from content)

**Alternative Options:**
- 1 year (365 days): Shorter, better for privacy
- Indefinite: Best for full accountability, but privacy concerns
- 90 days: Too short for meaningful audit trail

### 2. Soft-Delete Restoration Rules

**Recommendation: TIERED RESTORATION**

**For Authors (Prayer Creators):**
- Can restore their own soft-deleted prayers within **24 hours**
- After 24 hours: Cannot restore (prevents abuse - delete, restore, delete cycle)
- "Undo delete" functionality in UI

**For Pastors/Admins:**
- Can restore any soft-deleted content within **30 days**
- After 30 days: Content permanently hidden (but retained in audit trail for 2 years)
- Use case: Accidental deletions by members, moderation errors

**For Flagged Content:**
- Pastors can restore flagged content anytime within the 2-year audit retention period
- Use case: False flags, content wrongly deleted

**Implementation Details:**
```typescript
// Restoration logic
function canRestore(prayer: PrayerRequest, user: User): boolean {
  const deletedAt = prayer.deleted_at;
  const now = new Date();
  const hoursSinceDelete = (now - deletedAt) / (1000 * 60 * 60);

  // Author can restore within 24 hours
  if (user.id === prayer.author_id && hoursSinceDelete <= 24) {
    return true;
  }

  // Pastors can restore within 30 days
  if (user.role === 'pastor' && hoursSinceDelete <= 30 * 24) {
    return true;
  }

  // Flagged content: pastors can restore within 2 years
  if (user.role === 'pastor' && prayer.was_flagged && hoursSinceDelete <= 730 * 24) {
    return true;
  }

  return false;
}
```

**Rationale:**
- **24 hours for authors:** Gives users a reasonable window to undo mistakes without enabling abuse
- **30 days for pastors:** Allows leadership to recover important content without indefinite restoration (which could undermine deletions)
- **Extended for flagged content:** Accountability for moderation decisions
- **Clear UX:** Show "Undo delete (23 hours remaining)" to authors

**Alternative Options:**
- No restoration: Too strict, users will want "undo"
- Indefinite restoration: Undermines soft-delete purpose
- 7 days for authors: Reasonable alternative

### 3. Additional Recommendation: Scheduled Prayer Meeting Status

**Recommendation: AUTOMATED STATUS UPDATES**

Since scheduling is a nice-to-have feature, implement automated status updates:

**Status Workflow:**
- **Upcoming:** Meeting scheduled but not started (> 15 minutes before start time)
- **Starting Soon:** 15 minutes before scheduled time (triggers notification)
- **Ongoing:** During scheduled time window (auto-start at scheduled time)
- **Ended:** After scheduled end time (or manually ended by pastor)

**Implementation:**
- Background cron job checks scheduled walls every minute
- Updates wall status based on current time vs scheduled time
- Sends notifications at status transitions
- Pastors can manually override status (e.g., end meeting early)

**Storage Format (JSONB schedule field):**
```json
{
  "frequency": "weekly",
  "day": "Saturday",
  "time": "06:00",
  "timezone": "Africa/Lagos",
  "duration_minutes": 60,
  "end_time": "07:00"
}
```

This provides a clear structure for recurring meetings with automatic status management.

---

## Summary

This requirements document captures:
- Hybrid prayer wall model (church-wide visibility + opt-in participation)
- Comprehensive user roles and permissions
- Detailed data models for 9 entities with relationships
- Real-time features using Socket.io and Redis
- Flexible 3-level anonymity system
- Complete moderation and flagging workflow
- Granular notification preferences
- Technical architecture aligned with existing project patterns
- Clear scope boundaries (in-scope vs future phases)
- Practical recommendations for uncertain requirements

The specification is ready for technical implementation planning.
