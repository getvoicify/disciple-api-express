import type { PrayerRequest, PrayerWall } from '../types/prayer-wall.types';
import { AnonymityLevel } from '../types/prayer-wall.types';

/**
 * Author information returned after applying anonymity rules
 */
export type AuthorInfo = {
  authorId?: string;
  authorName?: string;
  isAnonymous: boolean;
};

/**
 * Requesting user context for anonymity evaluation
 */
export type RequestingUser = {
  userId: string;
  isPastor: boolean;
};

/**
 * Determines author information based on anonymity level, wall type, and user role.
 *
 * Anonymity Rules:
 * 1. Private walls ALWAYS show identity (anonymity doesn't apply)
 * 2. IDENTIFIED: Full name and profile visible to everyone
 * 3. ANONYMOUS_TO_MEMBERS: Identity hidden from members, visible to pastors
 * 4. FULLY_ANONYMOUS: Identity hidden from everyone including pastors
 *
 * @param prayer - The prayer request with anonymity settings
 * @param requestingUser - User requesting the information (with role)
 * @param wall - The prayer wall (specifically whether it's private)
 * @returns Author information with anonymity applied
 */
export function getAuthorInfo(
  prayer: PrayerRequest,
  requestingUser: RequestingUser,
  wall: Pick<PrayerWall, 'is_private'>
): AuthorInfo {
  // Rule 1: Private walls ALWAYS show identity (anonymity doesn't apply)
  if (wall.is_private) {
    return {
      authorId: prayer.author_id,
      isAnonymous: false,
    };
  }

  // Rule 2: IDENTIFIED - Full identity visible to everyone
  if (prayer.anonymity_level === AnonymityLevel.IDENTIFIED) {
    return {
      authorId: prayer.author_id,
      isAnonymous: false,
    };
  }

  // Rule 3: ANONYMOUS_TO_MEMBERS - Identity hidden from members, visible to pastors
  if (prayer.anonymity_level === AnonymityLevel.ANONYMOUS_TO_MEMBERS) {
    if (requestingUser.isPastor) {
      return {
        authorId: prayer.author_id,
        isAnonymous: false,
      };
    }
    return {
      authorName: 'Anonymous Member',
      isAnonymous: true,
    };
  }

  // Rule 4: FULLY_ANONYMOUS - Identity hidden from everyone including pastors
  if (prayer.anonymity_level === AnonymityLevel.FULLY_ANONYMOUS) {
    return {
      authorName: 'Anonymous',
      isAnonymous: true,
    };
  }

  // Default fallback (should never reach here if all enum values are handled)
  return {
    authorId: prayer.author_id,
    isAnonymous: false,
  };
}
