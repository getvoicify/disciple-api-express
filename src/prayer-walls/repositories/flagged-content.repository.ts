import type { RawDb } from '../../utils/database';
import type { FlaggedContent, FlaggedContentStatus } from '../types/prayer-wall.types';

/**
 * Repository interface for Flagged Content data access operations
 * Manages the moderation workflow for flagged prayer requests
 */
export interface IFlaggedContentRepository {
  /**
   * Create a new flagged content record with pending status
   * @param requestId - The prayer request ID being flagged
   * @param flaggedBy - The user ID who is flagging the content
   * @param reason - The reason for flagging the content
   * @returns The created flagged content record
   */
  create(requestId: string, flaggedBy: string, reason: string): Promise<FlaggedContent>;

  /**
   * Find all pending flagged content for a specific church
   * @param churchId - The church ID to filter by
   * @returns Array of pending flagged content records
   */
  findPending(churchId: string): Promise<FlaggedContent[]>;

  /**
   * Update the status of a flagged content record
   * Sets reviewed_by and reviewed_at when status changes
   * @param flagId - The flagged content ID to update
   * @param status - The new status (reviewed, dismissed, actioned)
   * @param reviewedBy - The user ID of the moderator/pastor reviewing the flag
   * @param action - Optional resolution action (delete, restore, warn, ban)
   * @param notes - Optional resolution notes
   * @returns The updated flagged content record or null if not found
   */
  updateStatus(
    flagId: string,
    status: FlaggedContentStatus,
    reviewedBy: string,
    action?: string,
    notes?: string
  ): Promise<FlaggedContent | null>;

  /**
   * Find all flags for a specific prayer request
   * Multiple users can flag the same prayer request
   * @param requestId - The prayer request ID to find flags for
   * @returns Array of flagged content records for this request
   */
  findByRequestId(requestId: string): Promise<FlaggedContent[]>;
}

/**
 * PostgreSQL implementation of Flagged Content repository
 * Handles CRUD operations for the content moderation workflow
 */
export class FlaggedContentRepository implements IFlaggedContentRepository {
  constructor(private readonly db: RawDb) {}

  /**
   * Create a new flagged content record with pending status
   */
  async create(requestId: string, flaggedBy: string, reason: string): Promise<FlaggedContent> {
    return this.db.begin(async (tx) => {
      const id = crypto.randomUUID();
      const now = new Date();

      const result = await tx`
        INSERT INTO flagged_content (
          id,
          prayer_request_id,
          flagged_by,
          reason,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ${id},
          ${requestId},
          ${flaggedBy},
          ${reason},
          'pending',
          ${now},
          ${now}
        )
        RETURNING *
      `;

      return this.mapRowToFlaggedContent(result[0]);
    });
  }

  /**
   * Find all pending flagged content for a specific church
   * Joins with prayer_requests and prayer_walls to filter by church
   */
  async findPending(churchId: string): Promise<FlaggedContent[]> {
    const result = await this.db`
      SELECT fc.*
      FROM flagged_content fc
      INNER JOIN prayer_requests pr ON fc.prayer_request_id = pr.id
      INNER JOIN prayer_walls pw ON pr.wall_id = pw.id
      WHERE pw.church_id = ${churchId}
        AND fc.status = 'pending'
      ORDER BY fc.created_at DESC
    `;

    return result.map((row) => this.mapRowToFlaggedContent(row));
  }

  /**
   * Update the status of a flagged content record
   * Sets reviewed_by and reviewed_at when status changes
   */
  async updateStatus(
    flagId: string,
    status: FlaggedContentStatus,
    reviewedBy: string,
    action?: string,
    notes?: string
  ): Promise<FlaggedContent | null> {
    return this.db.begin(async (tx) => {
      const now = new Date();
      const resolutionAction = action !== undefined ? action : null;
      const resolutionNotes = notes !== undefined ? notes : null;

      const result = await tx`
        UPDATE flagged_content
        SET status = ${status},
            reviewed_by = ${reviewedBy},
            reviewed_at = ${now},
            resolution_action = ${resolutionAction},
            resolution_notes = ${resolutionNotes},
            updated_at = ${now}
        WHERE id = ${flagId}
        RETURNING *
      `;

      if (result.length === 0) {
        return null;
      }

      return this.mapRowToFlaggedContent(result[0]);
    });
  }

  /**
   * Find all flags for a specific prayer request
   * Multiple users can flag the same prayer request
   */
  async findByRequestId(requestId: string): Promise<FlaggedContent[]> {
    const result = await this.db`
      SELECT *
      FROM flagged_content
      WHERE prayer_request_id = ${requestId}
      ORDER BY created_at DESC
    `;

    return result.map((row) => this.mapRowToFlaggedContent(row));
  }

  /**
   * Map database row to FlaggedContent domain model
   */
  private mapRowToFlaggedContent(row: any): FlaggedContent {
    return {
      id: row.id,
      prayer_request_id: row.prayer_request_id,
      flagged_by: row.flagged_by,
      reason: row.reason,
      status: row.status as FlaggedContentStatus,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at
        ? row.reviewed_at instanceof Date
          ? row.reviewed_at
          : new Date(row.reviewed_at)
        : null,
      resolution_action: row.resolution_action,
      resolution_notes: row.resolution_notes,
      created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    };
  }
}
