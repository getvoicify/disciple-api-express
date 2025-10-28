/**
 * WebSocket Event Types and Payloads
 *
 * This module defines all event types and their corresponding payload structures
 * for the Prayer Wall real-time communication system.
 */

// Prayer-related events
export const PRAYER_EVENTS = {
  CREATED: 'prayer:created',
  UPDATED: 'prayer:updated',
  DELETED: 'prayer:deleted',
  RESPONSE: 'prayer:response',
  REPLY: 'prayer:reply',
  READ: 'prayer:read',
} as const;

// Typing indicator events
export const TYPING_EVENTS = {
  START: 'typing:start',
  STOP: 'typing:stop',
} as const;

// User presence events
export const USER_EVENTS = {
  ONLINE: 'user:online',
  OFFLINE: 'user:offline',
  AWAY: 'user:away',
} as const;

// Content moderation events
export const CONTENT_EVENTS = {
  FLAGGED: 'content:flagged',
  HIDDEN: 'content:hidden',
  RESTORED: 'content:restored',
} as const;

// Membership events
export const MEMBER_EVENTS = {
  JOINED: 'member:joined',
  LEFT: 'member:left',
  INVITED: 'member:invited',
  BANNED: 'user:banned',
} as const;

// Room management events
export const ROOM_EVENTS = {
  JOIN: 'join-room',
  LEAVE: 'leave-room',
  JOINED: 'room-joined',
  LEFT: 'room-left',
} as const;

// Event payload type definitions

export interface PrayerCreatedPayload {
  prayerId: string;
  wallId: string;
  content: string;
  authorId?: string;
  authorName?: string;
  isAnonymous: boolean;
  createdAt: string;
}

export interface PrayerUpdatedPayload {
  prayerId: string;
  wallId: string;
  content: string;
  updatedAt: string;
}

export interface PrayerDeletedPayload {
  prayerId: string;
  wallId: string;
  deletedAt: string;
}

export interface PrayerResponsePayload {
  responseId: string;
  prayerId: string;
  wallId: string;
  content: string;
  authorId?: string;
  authorName?: string;
  isAnonymous: boolean;
  createdAt: string;
}

export interface PrayerReplyPayload {
  replyId: string;
  responseId: string;
  prayerId: string;
  wallId: string;
  content: string;
  authorId?: string;
  authorName?: string;
  isAnonymous: boolean;
  createdAt: string;
}

export interface PrayerReadPayload {
  prayerId: string;
  wallId: string;
  userId: string;
  readAt: string;
}

export interface TypingStartPayload {
  wallId: string;
  userId: string;
  userName?: string;
  prayerId?: string;
}

export interface TypingStopPayload {
  wallId: string;
  userId: string;
  prayerId?: string;
}

export interface UserOnlinePayload {
  userId: string;
  userName?: string;
  wallId: string;
  timestamp: string;
}

export interface UserOfflinePayload {
  userId: string;
  wallId: string;
  timestamp: string;
}

export interface UserAwayPayload {
  userId: string;
  wallId: string;
  timestamp: string;
}

export interface ContentFlaggedPayload {
  contentId: string;
  contentType: 'prayer' | 'response' | 'reply';
  wallId: string;
  flaggedBy: string;
  reason: string;
  timestamp: string;
}

export interface ContentHiddenPayload {
  contentId: string;
  contentType: 'prayer' | 'response' | 'reply';
  wallId: string;
  hiddenBy: string;
  reason: string;
  timestamp: string;
}

export interface ContentRestoredPayload {
  contentId: string;
  contentType: 'prayer' | 'response' | 'reply';
  wallId: string;
  restoredBy: string;
  timestamp: string;
}

export interface MemberJoinedPayload {
  userId: string;
  userName?: string;
  wallId: string;
  role: string;
  timestamp: string;
}

export interface MemberLeftPayload {
  userId: string;
  wallId: string;
  timestamp: string;
}

export interface MemberInvitedPayload {
  userId: string;
  invitedBy: string;
  wallId: string;
  timestamp: string;
}

export interface UserBannedPayload {
  userId: string;
  wallId: string;
  bannedBy: string;
  reason: string;
  timestamp: string;
}

export interface RoomJoinPayload {
  roomId: string;
}

export interface RoomLeavePayload {
  roomId: string;
}

// Type for all event payloads
export type EventPayload =
  | PrayerCreatedPayload
  | PrayerUpdatedPayload
  | PrayerDeletedPayload
  | PrayerResponsePayload
  | PrayerReplyPayload
  | PrayerReadPayload
  | TypingStartPayload
  | TypingStopPayload
  | UserOnlinePayload
  | UserOfflinePayload
  | UserAwayPayload
  | ContentFlaggedPayload
  | ContentHiddenPayload
  | ContentRestoredPayload
  | MemberJoinedPayload
  | MemberLeftPayload
  | MemberInvitedPayload
  | UserBannedPayload
  | RoomJoinPayload
  | RoomLeavePayload;

// All event types combined
export const ALL_EVENTS = {
  ...PRAYER_EVENTS,
  ...TYPING_EVENTS,
  ...USER_EVENTS,
  ...CONTENT_EVENTS,
  ...MEMBER_EVENTS,
  ...ROOM_EVENTS,
} as const;

export type EventType = typeof ALL_EVENTS[keyof typeof ALL_EVENTS];
