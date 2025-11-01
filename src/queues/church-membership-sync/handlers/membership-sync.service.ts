import type { IChurchMembershipQueryService } from '../../../churches/church-membership-query.service';
import type { KeycloakAdminClient } from '../../../keycloak/types';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';

/**
 * Shared service for syncing user church memberships to Keycloak
 * Used by all church membership event handlers
 */
export class MembershipSyncService {
  constructor(
    private readonly membershipService: IChurchMembershipQueryService,
    private readonly keycloakClient: KeycloakAdminClient
  ) {}

  /**
   * Sync a single user's church memberships to Keycloak
   * @param userId - The user ID to sync
   */
  async syncUserMemberships(userId: string): Promise<void> {
    logger.debug({ userId }, 'Syncing user church memberships to Keycloak');

    const [membershipError, memberships] = await safeExecute(
      this.membershipService.getUserChurchMemberships(userId)
    );

    if (membershipError) {
      logger.error({ error: membershipError, userId }, 'Failed to query user memberships');
      throw membershipError;
    }

    const [getAttrError] = await safeExecute(this.keycloakClient.getUserAttributes(userId));

    if (getAttrError) {
      if (this.isGracefulError(getAttrError)) {
        logger.warn(
          { error: getAttrError.message, userId },
          'User not found in Keycloak, skipping sync'
        );
        throw getAttrError;
      }

      logger.error({ error: getAttrError, userId }, 'Failed to get user attributes from Keycloak');
      throw getAttrError;
    }

    const churchMembershipAttribute = JSON.stringify(memberships);

    const [updateError] = await safeExecute(
      this.keycloakClient.updateUserAttributes(userId, {
        church_membership: churchMembershipAttribute,
      })
    );

    if (updateError) {
      if (this.isGracefulError(updateError)) {
        logger.warn(
          { error: updateError.message, userId },
          'User not found in Keycloak during update, skipping sync'
        );
        throw updateError;
      }

      logger.error(
        { error: updateError, userId },
        'Failed to update user attributes in Keycloak'
      );
      throw updateError;
    }

    logger.info(
      { userId, membershipCount: memberships.length },
      'Successfully synced user church memberships to Keycloak'
    );
  }

  /**
   * Determine if an error should be handled gracefully (no retry)
   */
  isGracefulError(error: Error): boolean {
    const gracefulErrorNames = ['UserNotFoundError'];
    const gracefulErrorMessages = ['user not found', 'does not exist'];

    return (
      gracefulErrorNames.includes(error.name) ||
      gracefulErrorMessages.some((msg) => error.message?.toLowerCase().includes(msg))
    );
  }
}
