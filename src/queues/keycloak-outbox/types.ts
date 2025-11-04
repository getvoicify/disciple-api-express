/**
 * Job data for Keycloak outbox processing
 *
 * This is a trigger job with no specific data payload.
 * The job processor will call outbox.processDue() to pull and process
 * pending Keycloak synchronization events from the outbox store.
 */
export interface KeycloakOutboxJobData {
  /**
   * Timestamp when the job was triggered (for tracking purposes)
   */
  triggeredAt: number;

  /**
   * Optional limit on number of events to process in this job
   * If not specified, uses the outbox's default limit
   */
  limit?: number;
}
