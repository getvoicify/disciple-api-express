import type { PrayerRequest, PrayerWall } from '../types/prayer-wall.types';
import type { EndpointRequest } from '../../types/endpoint-handler';
import type { AuthorInfo, RequestingUser } from './anonymity.util';
import type { ChurchMembershipService } from '../../churches/membership-service';
import { getAuthorInfo } from './anonymity.util';
import { safeExecute } from '../../utils/handle-async';

/**
 * Anonymized prayer response type with author info instead of author_id
 */
export type AnonymizedPrayerResponse = Omit<PrayerRequest, 'author_id' | 'author'> & {
  author: AuthorInfo;
};

/**
 * Transforms a single prayer request with anonymity applied.
 * Removes author_id and adds an author object with anonymity rules applied.
 *
 * @param prayer - The prayer request to transform
 * @param requestingUser - User requesting the information (with role)
 * @param wall - The prayer wall (specifically whether it's private)
 * @returns Anonymized prayer response
 */
export function applyAnonymityToPrayer(
  prayer: PrayerRequest,
  requestingUser: RequestingUser,
  wall: Pick<PrayerWall, 'is_private'>
): AnonymizedPrayerResponse {
  // Get anonymized author info using the core utility
  const author = getAuthorInfo(prayer, requestingUser, wall);

  // Destructure to remove author_id, keep everything else
  const { author_id: _author_id, ...prayerWithoutAuthorId } = prayer;

  // Return the prayer with author object instead of author_id
  return {
    ...prayerWithoutAuthorId,
    author,
  };
}

/**
 * Transforms an array of prayer requests with anonymity applied.
 *
 * @param prayers - Array of prayer requests to transform
 * @param requestingUser - User requesting the information (with role)
 * @param wall - The prayer wall (specifically whether it's private)
 * @returns Array of anonymized prayer responses
 */
export function applyAnonymityToPrayers(
  prayers: PrayerRequest[],
  requestingUser: RequestingUser,
  wall: Pick<PrayerWall, 'is_private'>
): AnonymizedPrayerResponse[] {
  // Map each prayer through the single-prayer anonymization function
  return prayers.map(prayer => applyAnonymityToPrayer(prayer, requestingUser, wall));
}

/**
 * Helper to extract user role information from an Express request by querying church membership.
 *
 * Determines if a user is a pastor (Owner or Manager with Active status) for a specific church
 * by querying the church membership service instead of relying on Keycloak realm roles.
 *
 * @param req - Express request with authenticated user
 * @param churchId - The church ID to check membership for
 * @param membershipService - Church membership service to query user's role
 * @returns Promise resolving to RequestingUser with userId and isPastor status
 */
export async function getUserRoleFromRequest(
  req: EndpointRequest,
  churchId: string,
  membershipService: ChurchMembershipService
): Promise<RequestingUser> {
  // Extract user payload from authenticated request
  const user = req.user?.[1]?.payload;
  const userId = (user?.sub as string) || '';

  // Early return if no userId - cannot be a pastor without authentication
  if (!userId) {
    return { userId: '', isPastor: false };
  }

  // Query membership service with error handling
  const [error, membership] = await safeExecute(
    membershipService.getMembershipByUserAndChurch(userId, churchId)
  );

  // Handle errors gracefully - treat as regular user on error
  if (error) {
    return { userId, isPastor: false };
  }

  // No membership found - user is not a member
  if (!membership) {
    return { userId, isPastor: false };
  }

  // User is considered a pastor if they are an Owner or Manager with Active status
  const isPastor =
    membership.status === 'Active' &&
    (membership.role === 'Owner' || membership.role === 'Manager');

  return {
    userId,
    isPastor,
  };
}
