import type { ILogger } from '../../logging';
import type { IUserInfoExtractor, SocketUserData } from '../types/user-info.types';

export class JwtUserInfoExtractor implements IUserInfoExtractor {
  constructor(private readonly logger: ILogger) {}

  /**
   * Extracts the full name from the JWT user payload.
   * Priority order:
   * 1. payload.name (if present and not empty/whitespace)
   * 2. Constructed from payload.given_name + ' ' + payload.family_name
   * 3. payload.given_name only (if family_name missing)
   * 4. payload.family_name only (if given_name missing)
   * 5. 'Unknown User' if all fields missing/empty
   */
  getFullName(user: SocketUserData | undefined | null): string {
    this.logger.debug({ user }, 'Extracting full name from user payload');

    // Handle null/undefined user
    if (!user || !user.payload) {
      return 'Unknown User';
    }

    const payload = user.payload;

    // 1. Check for name claim (highest priority)
    if (!this.isEmptyOrWhitespace(payload.name)) {
      return payload.name!.trim();
    }

    // 2. Construct from given_name and family_name
    const hasGivenName = !this.isEmptyOrWhitespace(payload.given_name);
    const hasFamilyName = !this.isEmptyOrWhitespace(payload.family_name);

    if (hasGivenName && hasFamilyName) {
      return `${payload.given_name!.trim()} ${payload.family_name!.trim()}`;
    }

    // 3. Return given_name only
    if (hasGivenName) {
      return payload.given_name!.trim();
    }

    // 4. Return family_name only
    if (hasFamilyName) {
      return payload.family_name!.trim();
    }

    // 5. Fallback to Unknown User
    return 'Unknown User';
  }

  /**
   * Extracts the first name from the JWT user payload.
   * Returns payload.given_name if present and not empty/whitespace.
   * Returns 'Unknown' if missing/empty/whitespace or user is null/undefined.
   */
  getFirstName(user: SocketUserData | undefined | null): string {
    this.logger.debug({ user }, 'Extracting first name from user payload');

    // Handle null/undefined user
    if (!user || !user.payload) {
      return 'Unknown';
    }

    const givenName = user.payload.given_name;

    // Check if given_name is present and not empty/whitespace
    if (this.isEmptyOrWhitespace(givenName)) {
      return 'Unknown';
    }

    return givenName!.trim();
  }

  /**
   * Extracts the last name from the JWT user payload.
   * Returns payload.family_name if present and not empty/whitespace.
   * Returns empty string if missing/empty/whitespace or user is null/undefined.
   */
  getLastName(user: SocketUserData | undefined | null): string {
    this.logger.debug({ user }, 'Extracting last name from user payload');

    // Handle null/undefined user
    if (!user || !user.payload) {
      return '';
    }

    const familyName = user.payload.family_name;

    // Check if family_name is present and not empty/whitespace
    if (this.isEmptyOrWhitespace(familyName)) {
      return '';
    }

    return familyName!.trim();
  }

  /**
   * Extracts the user ID from the JWT user payload.
   * Returns payload.sub if present, undefined otherwise.
   */
  getUserId(user: SocketUserData | undefined | null): string | undefined {
    this.logger.debug({ user }, 'Extracting user ID from user payload');

    // Handle null/undefined user
    if (!user || !user.payload) {
      return undefined;
    }

    return user.payload.sub;
  }

  /**
   * Helper method to check if a string is empty, whitespace-only, or null/undefined.
   * Treats '', '   ', null, and undefined as empty.
   */
  private isEmptyOrWhitespace(value: string | undefined | null): boolean {
    return !value || value.trim().length === 0;
  }
}
