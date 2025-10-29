import type { MemberRole } from '../churches/schemas';
import { logger } from '../logging';

export interface ChurchMembership {
  churchId: string;
  role: MemberRole;
}

/**
 * Transform church membership array to Keycloak attribute format
 * @param memberships - Array of church memberships
 * @returns JSON string representation for Keycloak
 */
export function serializeChurchMemberships(
  memberships: ChurchMembership[]
): string {
  return JSON.stringify(memberships);
}

/**
 * Parse church membership attribute from Keycloak format
 * @param attribute - JSON string from Keycloak or array from Keycloak
 * @returns Typed array of church memberships
 */
export function deserializeChurchMemberships(
  attribute: string | string[] | undefined
): ChurchMembership[] {
  if (!attribute) {
    return [];
  }

  try {
    // Keycloak may return attributes as arrays with single JSON string element
    const jsonString = Array.isArray(attribute) ? attribute[0] : attribute;

    if (!jsonString) {
      return [];
    }

    const parsed = JSON.parse(jsonString);

    if (!Array.isArray(parsed)) {
      logger.warn(
        { attribute: jsonString },
        'Church membership attribute is not an array'
      );
      return [];
    }

    return parsed;
  } catch (error) {
    logger.error(
      { error, attribute },
      'Failed to parse church membership attribute'
    );
    return [];
  }
}

/**
 * Create Keycloak attributes object with church memberships
 * @param memberships - Array of church memberships
 * @returns Keycloak attributes object
 */
export function createChurchMembershipAttributes(
  memberships: ChurchMembership[]
): Record<string, string | string[]> {
  return {
    church_membership: [serializeChurchMemberships(memberships)],
  };
}
