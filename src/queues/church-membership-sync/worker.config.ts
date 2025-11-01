import type { WorkerConfig, WorkerCommonDeps } from '../../lib/queue/worker-loader';
import type { KeycloakAdminConfig } from '../../keycloak/admin-client';
import { createChurchMembershipSyncWorker } from './worker';
import type { ChurchMembershipSyncWorkerDeps } from './worker';

/**
 * Worker configuration for church membership synchronization
 *
 * This configuration is automatically discovered by the WorkerLoader.
 * The worker syncs church membership changes to Keycloak for JWT claims.
 */
export const workerConfig: WorkerConfig<ChurchMembershipSyncWorkerDeps> = {
  name: 'church-membership-sync',

  /**
   * Check if this worker should be enabled
   * Requires Keycloak configuration to be present
   */
  enabled: (env) => {
    const { IAM_ENDPOINT, IAM_REALM, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET } = env;
    return !!(IAM_ENDPOINT && IAM_REALM && KEYCLOAK_CLIENT_ID && KEYCLOAK_CLIENT_SECRET);
  },

  /**
   * Extract worker-specific dependencies from common dependencies
   */
  getDependencies: (commonDeps: WorkerCommonDeps): ChurchMembershipSyncWorkerDeps => {
    const { IAM_ENDPOINT, IAM_REALM, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET } = commonDeps.env;

    if (!IAM_ENDPOINT || !IAM_REALM || !KEYCLOAK_CLIENT_ID || !KEYCLOAK_CLIENT_SECRET) {
      throw new Error(
        'Church membership sync worker requires IAM_ENDPOINT, IAM_REALM, KEYCLOAK_CLIENT_ID, and KEYCLOAK_CLIENT_SECRET'
      );
    }

    const keycloakConfig: KeycloakAdminConfig = {
      realm: IAM_REALM,
      keycloakUrl: IAM_ENDPOINT.replace('realms', ''),
      clientId: KEYCLOAK_CLIENT_ID,
      clientSecret: KEYCLOAK_CLIENT_SECRET,
    };

    return {
      db: commonDeps.db,
      redisUrl: commonDeps.redisUrl,
      keycloakConfig,
    };
  },

  /**
   * Create the worker instance
   */
  createWorker: (deps: ChurchMembershipSyncWorkerDeps) => {
    return createChurchMembershipSyncWorker(deps);
  },
};
