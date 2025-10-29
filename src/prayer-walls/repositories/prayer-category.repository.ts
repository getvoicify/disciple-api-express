import type { RawDb } from '../../utils/database';
import type { PrayerCategory } from '../types/prayer-wall.types';

/**
 * Repository interface for Prayer Category data access operations
 */
export interface IPrayerCategoryRepository {
  /**
   * Find all system-wide categories (available to all churches)
   */
  findSystemCategories(): Promise<PrayerCategory[]>;

  /**
   * Find all categories for a specific church (system categories + church-specific custom categories)
   */
  findAll(churchId: string): Promise<PrayerCategory[]>;

  /**
   * Create a custom category for a specific church
   */
  create(name: string, churchId: string): Promise<PrayerCategory>;

  /**
   * Assign categories to a prayer request (idempotent - ignores duplicates)
   */
  assignToRequest(requestId: string, categoryIds: string[]): Promise<void>;

  /**
   * Find all categories assigned to a specific prayer request
   */
  findByRequestId(requestId: string): Promise<PrayerCategory[]>;
}

/**
 * PostgreSQL implementation of Prayer Category repository
 * Handles operations for both system-wide and church-specific categories
 */
export class PrayerCategoryRepository implements IPrayerCategoryRepository {
  constructor(private readonly db: RawDb) {}

  /**
   * Find all system-wide categories (available to all churches)
   */
  async findSystemCategories(): Promise<PrayerCategory[]> {
    const result = await this.db`
      SELECT *
      FROM prayer_categories
      WHERE is_system_category = true
      ORDER BY name ASC
    `;

    return result.map((row) => this.mapRowToCategory(row));
  }

  /**
   * Find all categories for a specific church (system categories + church-specific custom categories)
   */
  async findAll(churchId: string): Promise<PrayerCategory[]> {
    const result = await this.db`
      SELECT *
      FROM prayer_categories
      WHERE is_system_category = true
         OR church_id = ${churchId}
      ORDER BY name ASC
    `;

    return result.map((row) => this.mapRowToCategory(row));
  }

  /**
   * Create a custom category for a specific church
   */
  async create(name: string, churchId: string): Promise<PrayerCategory> {
    return this.db.begin(async (tx) => {
      const id = crypto.randomUUID();
      const now = new Date();

      const result = await tx`
        INSERT INTO prayer_categories (
          id,
          name,
          church_id,
          is_system_category,
          created_at,
          updated_at
        )
        VALUES (
          ${id},
          ${name},
          ${churchId},
          false,
          ${now},
          ${now}
        )
        RETURNING *
      `;

      return this.mapRowToCategory(result[0]);
    });
  }

  /**
   * Assign categories to a prayer request (idempotent - ignores duplicates)
   * Uses ON CONFLICT DO NOTHING to prevent duplicate assignments
   */
  async assignToRequest(requestId: string, categoryIds: string[]): Promise<void> {
    if (categoryIds.length === 0) {
      return;
    }

    return this.db.begin(async (tx) => {
      const now = new Date();

      // Insert all category assignments, ignoring duplicates
      for (const categoryId of categoryIds) {
        const id = crypto.randomUUID();

        await tx`
          INSERT INTO prayer_request_categories (
            id,
            prayer_request_id,
            category_id,
            created_at
          )
          VALUES (
            ${id},
            ${requestId},
            ${categoryId},
            ${now}
          )
          ON CONFLICT (prayer_request_id, category_id) DO NOTHING
        `;
      }
    });
  }

  /**
   * Find all categories assigned to a specific prayer request
   */
  async findByRequestId(requestId: string): Promise<PrayerCategory[]> {
    const result = await this.db`
      SELECT c.*
      FROM prayer_categories c
      INNER JOIN prayer_request_categories prc ON c.id = prc.category_id
      WHERE prc.prayer_request_id = ${requestId}
      ORDER BY c.name ASC
    `;

    return result.map((row) => this.mapRowToCategory(row));
  }

  /**
   * Map database row to PrayerCategory domain model
   */
  private mapRowToCategory(row: any): PrayerCategory {
    return {
      id: row.id,
      name: row.name,
      church_id: row.church_id,
      is_system_category: row.is_system_category || false,
      created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    };
  }
}
