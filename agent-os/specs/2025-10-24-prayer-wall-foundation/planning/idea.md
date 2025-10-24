# Prayer Wall Foundation - Feature Description

**Prayer Wall Foundation** is the highest priority Phase 2 feature for Disciple API.

## Overview

Create church-wide prayer walls where members submit prayer requests (with name or anonymously) and pastors/members respond with encouragement and intercession. Includes real-time updates, prayer threading, and moderation tools for church leadership.

## Key Capabilities

- Members can submit prayer requests to the church
- Prayers can be submitted with their name or anonymously
- Pastors and members can respond with encouragement and prayers
- Real-time updates for new prayers and responses
- Prayer threading/conversation support
- Moderation tools for church leadership
- Church-wide visibility for prayer walls

## Context from Product Planning

- This is a chat room-like feature where members can send prayers to the pastor
- Members can create private prayer walls to share prayers with other members (future phase)
- Church prayer walls available to all members
- A church can have multiple prayer walls, each with different names and purposes (future phase)
- Prayer walls can have links to video calls (future phase)
- Future vision: Native video call hosting within prayer walls (Phase 3)

## Effort Estimate

Large (2 weeks)

## Project Tech Stack

- Express 5 + TypeScript 5
- PostgreSQL for data persistence
- Redis for caching/real-time features
- Zod for validation
- safeExecute pattern for error handling
- Pino for structured logging