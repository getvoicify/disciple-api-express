# WebSocket Event Handlers - Read Receipts & Membership

## Implementation Summary

This document details the implementation of WebSocket event handlers for read receipts and membership events in the Prayer Wall Foundation feature.

## What Was Implemented

### 1. Broadcast Functions

Added 4 new broadcast functions to `/src/websocket/handlers/prayer.handler.ts`:

#### `broadcastPrayerRead(io, prayerId, wallId, userId, readCount)`
Broadcasts when a user marks a prayer as read. Includes:
- Prayer ID and wall ID
- User ID who read the prayer
- Read timestamp (ISO format)
- **Read count** - total number of users who have read the prayer

#### `broadcastMemberJoined(io, wallId, userId, userName, role)`
Broadcasts when a user joins a prayer wall. Includes:
- Wall ID
- User ID and name of the member who joined
- Role (member, moderator, admin)
- Timestamp (ISO format)

#### `broadcastMemberLeft(io, wallId, userId)`
Broadcasts when a user leaves a prayer wall. Includes:
- Wall ID
- User ID of the member who left
- Timestamp (ISO format)

#### `broadcastMemberInvited(io, wallId, inviteeId, inviterId)`
Broadcasts to all wall members when someone is invited. Includes:
- Wall ID
- Invitee ID (user being invited)
- Inviter ID (user sending the invitation)
- Timestamp (ISO format)

### 2. Event Payload Updates

Updated `/src/websocket/events.ts`:
- Added `readCount` field to `PrayerReadPayload` to allow clients to display how many users have read each prayer

### 3. Comprehensive Test Suite

Created `/src/tests/websocket/read-receipt-membership.handler.test.ts` with 24 passing tests covering:
- Prayer read event broadcasting
- Read count aggregation
- Multiple concurrent readers
- Member joined/left/invited events
- Edge cases and error scenarios
- Repository integration verification

## How to Integrate with REST API Endpoints

### Prerequisites

1. Get the Socket.io server instance (usually stored in app.locals or passed to services)
2. Import the broadcast functions from `/src/websocket/handlers/prayer.handler.ts`
3. Import `PrayerReadReceiptRepository` for read receipt tracking

### Integration Examples

See the full document for detailed integration examples with actual code snippets.

## Event Payload Structures

All events include properly formatted timestamps and relevant IDs for client-side handling.

## Testing

All functionality has been tested with 24 comprehensive tests. Run tests with:

```bash
npm test -- src/tests/websocket/read-receipt-membership.handler.test.ts
```

## References

- Event Types: `/src/websocket/events.ts`
- Broadcast Handlers: `/src/websocket/handlers/prayer.handler.ts`
- Test Suite: `/src/tests/websocket/read-receipt-membership.handler.test.ts`
- Repository: `/src/prayer-walls/repositories/prayer-read-receipt.repository.ts`
