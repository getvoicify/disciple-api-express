# Product Roadmap

## Current State (MVP - Complete)

These foundational features are already built and operational:

- [x] **Church Management** — Multi-church support, membership administration, and role-based access control enabling churches to onboard and manage their communities `Complete`
- [x] **Devotional Content System** — Churches create and manage devotional posts with rich media support, organized by date for daily engagement `Complete`
- [x] **Series Management** — Group devotional content into themed series for structured discipleship journeys with sequenced learning paths `Complete`
- [x] **Notes System** — Members capture personal scripture insights and reflections, building a searchable spiritual journal tied to their devotional engagement `Complete`
- [x] **Media Management** — S3/R2 cloud storage integration with automatic image processing, optimization, and secure delivery for enriched content `Complete`
- [x] **Authentication & Security** — Enterprise-grade Keycloak integration with JOSE JWT validation, ensuring secure member authentication and data privacy `Complete`
- [x] **Structured Logging** — Request-scoped logging with correlation IDs using Pino for comprehensive observability and debugging across the platform `Complete`
- [x] **Caching Layer** — Redis-based caching for optimized performance on frequently accessed devotional content and user data `Complete`

## Phase 2: Social Engagement & Community Interaction (Next 8-12 weeks)

These features transform Disciple API from a content platform into a vibrant community space:

1. [ ] **Prayer Wall Foundation** — Create church-wide prayer walls where members submit prayer requests (with name or anonymously) and pastors/members respond with encouragement and intercession. Includes real-time updates, prayer threading, and moderation tools for church leadership. `L`

2. [ ] **Private Prayer Rooms** — Enable members to create and manage private prayer walls, inviting specific members to share prayers in intimate small group settings. Includes invitation system, access control, and privacy settings. `M`

3. [ ] **Multi-Purpose Prayer Walls** — Allow churches to create multiple named prayer walls for different ministries or purposes (youth, missions, healing, etc.), each with customizable settings and member permissions. `M`

4. [ ] **Video Call Integration** — Add video call link attachment to prayer walls, enabling churches to include Zoom/Meet links for deeper connection during prayer sessions or pastoral counseling. `S`

5. [ ] **User Profile System** — Comprehensive user profile management including spiritual journey tracking, content preferences, engagement history, and personalized dashboard showing recent notes, prayers, and devotional progress. `L`

6. [ ] **Notification & Reminders** — Smart notification system for devotional content updates, prayer wall responses, and engagement reminders via email and push notifications. Includes user-configurable preferences and notification scheduling. `M`

7. [ ] **Prayer Analytics Dashboard** — Church leadership dashboard showing prayer wall engagement metrics, response times, active prayer requests, and member participation trends to measure pastoral care effectiveness. `M`

8. [ ] **Content Engagement Metrics** — Track and display devotional completion rates, note-taking frequency, series progression, and member engagement patterns to help churches optimize content strategy. `S`

## Phase 3: Advanced Community & Native Features (3-6 months)

These features deepen engagement and create sticky, long-term platform value:

9. [ ] **Native Video Calls** — Built-in video conferencing within prayer walls eliminating need for external links, with features like prayer room hosting, recording permissions, and participant management. `XL`

10. [ ] **Discussion Threads** — Add threaded discussions to devotional posts enabling members to share insights, ask questions, and engage in Bible study conversations directly on daily content. `L`

11. [ ] **Member-to-Member Prayer Requests** — Direct prayer request feature allowing members to privately request prayer from specific individuals or small groups outside of prayer walls. `M`

12. [ ] **Content Collaboration** — Enable multiple church leaders to co-author devotional series with draft reviews, approval workflows, and collaborative editing before publication. `L`

13. [ ] **Mobile API Optimization** — Enhanced mobile-specific endpoints with optimized payloads, offline-first capabilities, and background sync for seamless mobile app experiences. `M`

14. [ ] **Search & Discovery** — Comprehensive search across devotionals, personal notes, prayer history, and series with filters, tags, and smart recommendations based on spiritual interests. `L`

15. [ ] **Member Milestones** — Celebrate spiritual growth with automatic milestone recognition (devotional streaks, notes created, prayers offered) and shareable achievements to encourage consistent engagement. `M`

16. [ ] **Small Group Management** — Formal small group creation with dedicated spaces for group devotionals, shared prayer walls, group notes, and attendance tracking integrated with church management. `L`

## Notes

**Effort Scale:**
- `XS`: 1 day
- `S`: 2-3 days
- `M`: 1 week
- `L`: 2 weeks
- `XL`: 3+ weeks

**Strategic Ordering Rationale:**
- Phase 2 focuses on the core social engagement differentiator (Prayer Wall) as the highest priority
- User profiles and notifications support both existing features and new prayer functionality
- Analytics features are positioned after core Prayer Wall implementation to measure impact
- Phase 3 builds long-term stickiness through native features and deeper community tools
- Mobile optimization comes after feature stabilization to ensure optimal mobile experience
- Search and discovery features leverage the accumulated content and engagement data from earlier phases

**Technical Dependencies:**
- Prayer Wall features require WebSocket or SSE integration for real-time updates (not yet in tech stack)
- Native video calls require significant infrastructure (WebRTC, TURN servers, bandwidth management)
- Mobile optimization assumes parallel native mobile app development
- Advanced features assume database schema extensions for relationships and metadata

**Success Milestones:**
- **End of Phase 2:** 60% of active members using Prayer Wall weekly, 40% DAU rate
- **End of Phase 3:** 75% member retention at 90 days, 50% using discussion threads
- **Long-term:** Platform becomes indispensable spiritual growth tool with 70%+ DAU rate