import type { WorkerConfig, WorkerCommonDeps } from '../../lib/queue/worker-loader';
import { createKeycloakOutboxWorker } from './worker';
import type { KeycloakOutboxWorkerDeps } from './worker';
import { setupKeycloakAdapter } from '../../keycloak/setup';
import type { KeycloakAdminConfig } from '../../keycloak/admin-client';

/**
 * Worker configuration for Keycloak outbox processing
 *
 * This configuration is automatically discovered by the WorkerLoader.
 * The worker processes pending Keycloak synchronization events from the outbox.
 * Events are triggered either:
 * - When new events are added to the outbox (event-driven)
 * - By a fallback repeatable job (every 5-10 seconds) to catch missed events
 */
export const workerConfig: WorkerConfig<KeycloakOutboxWorkerDeps> = {
  name: 'keycloak-outbox',

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
   * Creates the outbox instance that the worker will use to process events
   */
  getDependencies: (commonDeps: WorkerCommonDeps): KeycloakOutboxWorkerDeps => {
    const { IAM_ENDPOINT, IAM_REALM, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET } = commonDeps.env;

    if (!IAM_ENDPOINT || !IAM_REALM || !KEYCLOAK_CLIENT_ID || !KEYCLOAK_CLIENT_SECRET) {
      throw new Error(
        'Keycloak outbox worker requires IAM_ENDPOINT, IAM_REALM, KEYCLOAK_CLIENT_ID, and KEYCLOAK_CLIENT_SECRET'
      );
    }

    // Extract base URL from IAM_ENDPOINT (e.g., https://auth.example.com/realms/myrealm -> https://auth.example.com/)
    const keycloakUrl = IAM_ENDPOINT.replace(/\/realms\/.*/, '/');
    const keycloakConfig: KeycloakAdminConfig = {
      realm: IAM_REALM,
      keycloakUrl,
      clientId: KEYCLOAK_CLIENT_ID,
      clientSecret: KEYCLOAK_CLIENT_SECRET,
    };

    // Create the Keycloak adapter and outbox
    const { outbox } = setupKeycloakAdapter(commonDeps.db, keycloakConfig);

    return {
      outbox,
      redisUrl: commonDeps.redisUrl,
    };
  },

  /**
   * Create the worker instance
   */
  createWorker: (deps: KeycloakOutboxWorkerDeps) => {
    return createKeycloakOutboxWorker(deps);
  },
};
