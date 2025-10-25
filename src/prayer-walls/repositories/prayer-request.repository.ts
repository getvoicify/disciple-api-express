import type { RawDb } from '../../utils/database';
import type {
  PrayerRequest,
  CreatePrayerRequestData,
  UpdatePrayerRequestData,
  CursorPaginationParams,
} from '../types/prayer-wall.types';

/**
 * Repository interface for prayer request operations
 * Handles CRUD operations for prayer requests with threading support
 */
export interface IPrayerRequestRepository {
  create(data: CreatePrayerRequestData): Promise<PrayerRequest>;
  findById(id: string): Promise<PrayerRequest | null>;
  findByWallId(wallId: string, pagination?: CursorPaginationParams): Promise<PrayerRequest[]>;
  findThreadChildren(parentId: string): Promise<PrayerRequest[]>;
  update(id: string, data: UpdatePrayerRequestData): Promise<PrayerRequest | null>;
  softDelete(id: string, deletedBy: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  validateThreadDepth(parentId: string | null): Promise<number>;
}

/**
 * PostgreSQL implementation of Prayer Request repository
 * Handles CRUD operations for prayer requests with threading support (max depth 3)
 */
export class PrayerRequestRepository implements IPrayerRequestRepository {
  constructor(private readonly db: RawDb) {}

  /**
   * Validate and get thread depth for a parent prayer request
   * Returns the parent's current depth
   * Used by create() to calculate new child depth (parent depth + 1)
   */
  async validateThreadDepth(parentId: string | null): Promise<number> {
    if (!parentId) {
      return 0; // Root level request (no parent, so return 0)
    }

    const result = await this.db`
      SELECT thread_depth
      FROM prayer_requests
      WHERE id = ${parentId}
        AND deleted_at IS NULL
    `;

    if (result.length === 0) {
      throw new Error('Parent prayer request not found');
    }

    return result[0].thread_depth;
  }

  /**
   * Create a new prayer request
   * Automatically calculates thread_depth based on parent_id
   */
  async create(data: CreatePrayerRequestData): Promise<PrayerRequest> {
    return this.db.begin(async (tx) => {
      const id = crypto.randomUUID();
      const now = new Date();

      // Normalize optional fields to avoid undefined values
      const parentId = data.parent_id !== undefined ? data.parent_id : null;
      const anonymityLevel = data.anonymity_level || 'identified';
      const hasAttachment = data.has_attachment !== undefined ? data.has_attachment : false;

      // Get parent depth and calculate new thread depth
      const parentDepth = await this.validateThreadDepth(parentId);
      const threadDepth = parentId ? parentDepth + 1 : 0;

      // Validate max depth
      if (threadDepth > 3) {
        throw new Error('Maximum thread depth of 3 exceeded');
      }

      const result = await tx`
        INSERT INTO prayer_requests (
          id,
          wall_id,
          author_id,
          content,
          anonymity_level,
          parent_id,
          thread_depth,
          has_attachment,
          created_at,
          updated_at
        )
        VALUES (
          ${id},
          ${data.wall_id},
          ${data.author_id},
          ${data.content},
          ${anonymityLevel},
          ${parentId},
          ${threadDepth},
          ${hasAttachment},
          ${now},
          ${now}
        )
        RETURNING *
      `;

      return this.mapRowToPrayerRequest(result[0]);
    });
  }

  /**
   * Find a prayer request by ID
   * Excludes soft-deleted requests
   */
  async findById(id: string): Promise<PrayerRequest | null> {
    const result = await this.db`
      SELECT *
      FROM prayer_requests
      WHERE id = ${id}
        AND deleted_at IS NULL
    `;

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToPrayerRequest(result[0]);
  }

  /**
   * Find all prayer requests for a specific wall
   * Supports cursor-based pagination for efficient infinite scrolling
   * Results ordered by created_at DESC (newest first)
   */
  async findByWallId(
    wallId: string,
    pagination?: CursorPaginationParams
  ): Promise<PrayerRequest[]> {
    let result;

    if (pagination) {
      const limit = pagination.limit || 20;
      const cursor = pagination.cursor;

      if (cursor) {
        // Cursor-based pagination: find cursor's timestamp, then get older records
        const cursorRecord = await this.db`
          SELECT created_at
          FROM prayer_requests
          WHERE id = ${cursor}
        `;

        if (cursorRecord.length === 0) {
          // Invalid cursor, return empty results
          return [];
        }

        const cursorTimestamp = cursorRecord[0].created_at;

        result = await this.db`
          SELECT *
          FROM prayer_requests
          WHERE wall_id = ${wallId}
            AND deleted_at IS NULL
            AND (
              created_at < ${cursorTimestamp}
              OR (created_at = ${cursorTimestamp} AND id < ${cursor})
            )
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit}
        `;
      } else {
        // First page
        result = await this.db`
          SELECT *
          FROM prayer_requests
          WHERE wall_id = ${wallId}
            AND deleted_at IS NULL
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit}
        `;
      }
    } else {
      // No pagination - return all
      result = await this.db`
        SELECT *
        FROM prayer_requests
        WHERE wall_id = ${wallId}
          AND deleted_at IS NULL
        ORDER BY created_at DESC, id DESC
      `;
    }

    return result.map((row) => this.mapRowToPrayerRequest(row));
  }

  /**
   * Find all children in a thread using recursive CTE
   * Returns all descendants of the given parent, ordered by created_at
   */
  async findThreadChildren(parentId: string): Promise<PrayerRequest[]> {
    const result = await this.db`
      WITH RECURSIVE thread_tree AS (
        -- Base case: direct children of the parent
        SELECT *
        FROM prayer_requests
        WHERE parent_id = ${parentId}
          AND deleted_at IS NULL

        UNION ALL

        -- Recursive case: children of children
        SELECT pr.*
        FROM prayer_requests pr
        INNER JOIN thread_tree tt ON pr.parent_id = tt.id
        WHERE pr.deleted_at IS NULL
      )
      SELECT * FROM thread_tree
      ORDER BY created_at ASC
    `;

    return result.map((row) => this.mapRowToPrayerRequest(row));
  }

  /**
   * Update a prayer request's details
   * Only updates provided fields
   * Returns null if the request doesn't exist or is soft-deleted
   */
  async update(id: string, data: UpdatePrayerRequestData): Promise<PrayerRequest | null> {
    return this.db.begin(async (tx) => {
      // If no data to update, just return the current request
      if (Object.keys(data).length === 0) {
        return this.findById(id);
      }

      // Build update fields dynamically
      const updateFields: Record<string, any> = {};

      if (data.content !== undefined) {
        updateFields.content = data.content;
      }
      if (data.has_attachment !== undefined) {
        updateFields.has_attachment = data.has_attachment;
      }

      // Always update the updated_at timestamp
      updateFields.updated_at = new Date();

      // Build SET clause dynamically
      const setClause = Object.keys(updateFields)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');

      const values = Object.values(updateFields);
      values.push(id); // Add id as the last parameter for WHERE clause

      const query = `
        UPDATE prayer_requests
        SET ${setClause}
        WHERE id = $${values.length}
          AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await tx.unsafe(query, values);

      if (result.length === 0) {
        return null;
      }

      return this.mapRowToPrayerRequest(result[0]);
    });
  }

  /**
   * Soft-delete a prayer request by setting deleted_at and deleted_by
   * Returns true if request was deleted, false if not found
   */
  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const now = new Date();

      const result = await tx`
        UPDATE prayer_requests
        SET deleted_at = ${now},
            deleted_by = ${deletedBy},
            updated_at = ${now}
        WHERE id = ${id}
          AND deleted_at IS NULL
        RETURNING id
      `;

      return result.length > 0;
    });
  }

  /**
   * Restore a soft-deleted prayer request
   * Clears deleted_at and deleted_by timestamps
   * Returns true if request was restored, false if not found or not deleted
   */
  async restore(id: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const now = new Date();

      const result = await tx`
        UPDATE prayer_requests
        SET deleted_at = NULL,
            deleted_by = NULL,
            updated_at = ${now}
        WHERE id = ${id}
          AND deleted_at IS NOT NULL
        RETURNING id
      `;

      return result.length > 0;
    });
  }

  /**
   * Map a database row to a PrayerRequest domain model
   * Handles type conversion for dates and enums
   */
  private mapRowToPrayerRequest(row: any): PrayerRequest {
    return {
      id: row.id,
      wall_id: row.wall_id,
      author_id: row.author_id,
      parent_id: row.parent_id,
      thread_depth: row.thread_depth,
      content: row.content,
      anonymity_level: row.anonymity_level,
      has_attachment: row.has_attachment || false,
      created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
      deleted_at: row.deleted_at
        ? row.deleted_at instanceof Date
          ? row.deleted_at
          : new Date(row.deleted_at)
        : null,
      deleted_by: row.deleted_by,
    };
  }
}
