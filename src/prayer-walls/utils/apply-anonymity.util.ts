import type { PrayerRequest, PrayerWall } from '../types/prayer-wall.types';
import type { EndpointRequest } from '../../types/endpoint-handler';
import type { AuthorInfo, RequestingUser } from './anonymity.util';
import { getAuthorInfo } from './anonymity.util';

/**
 * Anonymized prayer response type with author info instead of author_id
 */
export type AnonymizedPrayerResponse = Omit<PrayerRequest, 'author_id'> & {
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
  const { author_id, ...prayerWithoutAuthorId } = prayer;

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
 * Helper to extract user role information from an Express request.
 *
 * @param req - Express request with authenticated user
 * @returns RequestingUser with userId and isPastor
 */
export function getUserRoleFromRequest(req: EndpointRequest): RequestingUser {
  // Extract user payload from authenticated request
  const user = req.user?.[1]?.payload;
  const userId = (user?.sub as string) || '';

  // Extract roles from Keycloak token
  const roles = user?.realm_access?.roles || [];

  // User is considered a pastor if they have 'pastor' or 'admin' role
  const isPastor = roles.includes('pastor') || roles.includes('admin');

  return {
    userId,
    isPastor,
  };
}
