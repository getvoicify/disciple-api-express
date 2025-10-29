import type { RawDb } from '../../utils/database';
import type {
  PrayerWall,
  CreatePrayerWallData,
  UpdatePrayerWallData,
  PaginationParams,
  PrayerWallRow,
  WallStatus,
} from '../types/prayer-wall.types';

/**
 * Repository interface for Prayer Wall data access operations
 */
export interface IPrayerWallRepository {
  create(data: CreatePrayerWallData): Promise<PrayerWall>;
  findById(id: string, churchId?: string): Promise<PrayerWall | null>;
  findByChurchId(churchId: string, pagination?: PaginationParams): Promise<PrayerWall[]>;
  update(id: string, data: UpdatePrayerWallData): Promise<PrayerWall | null>;
  softDelete(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
}

/**
 * PostgreSQL implementation of Prayer Wall repository
 * Handles CRUD operations for prayer walls with soft-delete support
 */
export class PrayerWallRepository implements IPrayerWallRepository {
  constructor(private readonly db: RawDb) {}

  /**
   * Create a new prayer wall
   */
  async create(data: CreatePrayerWallData): Promise<PrayerWall> {
    return this.db.begin(async (tx) => {
      const id = crypto.randomUUID();
      const now = new Date();

      const result = await tx`
        INSERT INTO prayer_walls (
          id,
          church_id,
          name,
          description,
          created_by,
          is_private,
          has_restricted_access,
          schedule,
          video_call_link,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ${id},
          ${data.church_id},
          ${data.name},
          ${data.description || null},
          ${data.created_by},
          ${data.is_private !== undefined ? data.is_private : false},
          ${data.has_restricted_access !== undefined ? data.has_restricted_access : false},
          ${data.schedule ? JSON.stringify(data.schedule) : null},
          ${data.video_call_link || null},
          ${data.status || 'active'},
          ${now},
          ${now}
        )
        RETURNING *
      `;

      return this.mapRowToPrayerWall(result[0] as PrayerWallRow);
    });
  }

  /**
   * Find a prayer wall by ID
   * Optionally filter by church_id for security (ensure user can only access their church's walls)
   */
  async findById(id: string, churchId?: string): Promise<PrayerWall | null> {
    let result;

    if (churchId) {
      result = await this.db`
        SELECT *
        FROM prayer_walls
        WHERE id = ${id}
          AND church_id = ${churchId}
          AND deleted_at IS NULL
      `;
    } else {
      result = await this.db`
        SELECT *
        FROM prayer_walls
        WHERE id = ${id}
          AND deleted_at IS NULL
      `;
    }

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToPrayerWall(result[0]);
  }

  /**
   * Find all prayer walls for a specific church
   * Supports pagination with limit and offset
   */
  async findByChurchId(
    churchId: string,
    pagination?: PaginationParams
  ): Promise<PrayerWall[]> {
    let result;

    if (pagination) {
      const limit = pagination.limit || 20;
      const offset = pagination.offset || 0;

      result = await this.db`
        SELECT *
        FROM prayer_walls
        WHERE church_id = ${churchId}
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      result = await this.db`
        SELECT *
        FROM prayer_walls
        WHERE church_id = ${churchId}
          AND deleted_at IS NULL
        ORDER BY created_at DESC
      `;
    }

    return result.map((row) => this.mapRowToPrayerWall(row));
  }

  /**
   * Update a prayer wall's details
   * Returns null if the wall doesn't exist
   */
  async update(id: string, data: UpdatePrayerWallData): Promise<PrayerWall | null> {
    return this.db.begin(async (tx) => {
      // If no data to update, just return the current wall
      if (Object.keys(data).length === 0) {
        return this.findById(id);
      }

      // Build update fields dynamically
      const updateFields: Record<string, any> = {};

      if (data.name !== undefined) {
        updateFields.name = data.name;
      }
      if (data.description !== undefined) {
        updateFields.description = data.description || null;
      }
      if (data.is_private !== undefined) {
        updateFields.is_private = data.is_private;
      }
      if (data.has_restricted_access !== undefined) {
        updateFields.has_restricted_access = data.has_restricted_access;
      }
      if (data.schedule !== undefined) {
        updateFields.schedule = data.schedule ? JSON.stringify(data.schedule) : null;
      }
      if (data.video_call_link !== undefined) {
        updateFields.video_call_link = data.video_call_link || null;
      }
      if (data.status !== undefined) {
        updateFields.status = data.status;
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
        UPDATE prayer_walls
        SET ${setClause}
        WHERE id = $${values.length}
          AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await tx.unsafe(query, values);

      if (result.length === 0) {
        return null;
      }

      return this.mapRowToPrayerWall(result[0] as unknown as PrayerWallRow);
    });
  }

  /**
   * Soft-delete a prayer wall by setting deleted_at timestamp
   * Returns true if wall was deleted, false if not found
   */
  async softDelete(id: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const now = new Date();

      const result = await tx`
        UPDATE prayer_walls
        SET deleted_at = ${now},
            updated_at = ${now}
        WHERE id = ${id}
          AND deleted_at IS NULL
        RETURNING id
      `;

      return result.length > 0;
    });
  }

  /**
   * Restore a soft-deleted prayer wall by clearing deleted_at timestamp
   * Returns true if wall was restored, false if not found or not deleted
   */
  async restore(id: string): Promise<boolean> {
    return this.db.begin(async (tx) => {
      const now = new Date();

      const result = await tx`
        UPDATE prayer_walls
        SET deleted_at = NULL,
            updated_at = ${now}
        WHERE id = ${id}
          AND deleted_at IS NOT NULL
        RETURNING id
      `;

      return result.length > 0;
    });
  }

  /**
   * Map a database row to a PrayerWall domain model
   * Handles type conversion for dates and JSONB fields
   */
  private mapRowToPrayerWall(row: PrayerWallRow): PrayerWall {
    return {
      id: row.id,
      church_id: row.church_id,
      name: row.name,
      description: row.description,
      created_by: row.created_by,
      is_private: row.is_private,
      has_restricted_access: row.has_restricted_access,
      schedule:
        typeof row.schedule === 'string'
          ? JSON.parse(row.schedule)
          : row.schedule || null,
      video_call_link: row.video_call_link,
      status: row.status as WallStatus,
      created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
      deleted_at: row.deleted_at
        ? row.deleted_at instanceof Date
          ? row.deleted_at
          : new Date(row.deleted_at)
        : null,
    };
  }
}
