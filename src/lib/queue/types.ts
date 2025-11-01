import { z } from 'zod';

/**
 * Generic job metadata extracted from job data for logging and monitoring
 *
 * This type is used internally by the SyncProcessor to extract standardized
 * metadata from any job type for structured logging. It does not replace or
 * validate the actual job data - it only provides a consistent logging format.
 *
 * @property eventType - The type of event being processed (e.g., 'owner-created')
 * @property entityId - The primary entity ID related to this job (e.g., churchId)
 */
export type JobData = { eventType: string; entityId: string };

/**
 * Function type that maps job-specific data to generic job metadata
 *
 * This mapper is used by the SyncProcessor to extract logging metadata from
 * strongly-typed job data. The mapper preserves type safety at the job level
 * while providing a consistent logging interface across different queue types.
 *
 * @template T - The strongly-typed job data (e.g., ChurchMembershipSyncJobData)
 * @param data - The job data to extract metadata from
 * @returns Generic metadata for logging (eventType and entityId)
 *
 * @example
 * ```typescript
 * const mapper: JobDataMapper<ChurchMembershipSyncJobData> = (data) => ({
 *   eventType: data.eventType,
 *   entityId: data.churchId, // Maps churchId to generic entityId
 * });
 * ```
 */
export type JobDataMapper<T> = (data: T) => JobData;

/**
 * Queue configuration with retry and backoff settings
 */
export const QueueConfig = z.object({
  attempts: z.number().default(5),
  backoff: z.object({
    type: z.literal('exponential'),
    delay: z.number().default(1000), // 1 second initial delay
  }),
});

export type QueueConfig = z.infer<typeof QueueConfig>;
