import type { RawDb } from '../../utils/database';
import type { PrayerReadReceipt } from '../types/prayer-wall.types';

/**
 * Repository interface for Prayer Read Receipt data access operations
 */
export interface IPrayerReadReceiptRepository {
  /**
   * Mark a prayer request as read by a user
   * Idempotent operation - will return existing receipt if already marked as read
   */
  markAsRead(requestId: string, userId: string): Promise<PrayerReadReceipt>;

  /**
   * Get the count of users who have read a prayer request
   */
  getReadCount(requestId: string): Promise<number>;

  /**
   * Check if a user has read a prayer request
   */
  hasRead(requestId: string, userId: string): Promise<boolean>;

  /**
   * Find all read receipts for a prayer request
   */
  findByRequestId(requestId: string): Promise<PrayerReadReceipt[]>;
}

/**
 * PostgreSQL implementation of Prayer Read Receipt repository
 * Handles read receipt tracking for prayer requests
 */
export class PrayerReadReceiptRepository implements IPrayerReadReceiptRepository {
  constructor(private readonly db: RawDb) {}

  /**
   * Mark a prayer request as read by a user
   * Idempotent operation - returns existing receipt if already marked as read
   */
  async markAsRead(requestId: string, userId: string): Promise<PrayerReadReceipt> {
    return this.db.begin(async (tx) => {
      // Check if receipt already exists
      const existing = await tx`
        SELECT *
        FROM prayer_read_receipts
        WHERE prayer_request_id = ${requestId}
          AND user_id = ${userId}
      `;

      if (existing.length > 0) {
        return this.mapRowToReceipt(existing[0]);
      }

      // Create new receipt
      const id = crypto.randomUUID();
      const now = new Date();

      const result = await tx`
        INSERT INTO prayer_read_receipts (
          id,
          prayer_request_id,
          user_id,
          read_at,
          created_at
        )
        VALUES (
          ${id},
          ${requestId},
          ${userId},
          ${now},
          ${now}
        )
        RETURNING *
      `;

      return this.mapRowToReceipt(result[0]);
    });
  }

  /**
   * Get the count of users who have read a prayer request
   */
  async getReadCount(requestId: string): Promise<number> {
    const result = await this.db`
      SELECT COUNT(*) as count
      FROM prayer_read_receipts
      WHERE prayer_request_id = ${requestId}
    `;

    return Number(result[0].count);
  }

  /**
   * Check if a user has read a prayer request
   */
  async hasRead(requestId: string, userId: string): Promise<boolean> {
    const result = await this.db`
      SELECT id
      FROM prayer_read_receipts
      WHERE prayer_request_id = ${requestId}
        AND user_id = ${userId}
    `;

    return result.length > 0;
  }

  /**
   * Find all read receipts for a prayer request
   */
  async findByRequestId(requestId: string): Promise<PrayerReadReceipt[]> {
    const result = await this.db`
      SELECT *
      FROM prayer_read_receipts
      WHERE prayer_request_id = ${requestId}
      ORDER BY read_at DESC
    `;

    return result.map((row) => this.mapRowToReceipt(row));
  }

  /**
   * Map database row to PrayerReadReceipt domain model
   */
  private mapRowToReceipt(row: any): PrayerReadReceipt {
    return {
      id: row.id,
      prayer_request_id: row.prayer_request_id,
      user_id: row.user_id,
      read_at: row.read_at instanceof Date ? row.read_at : new Date(row.read_at),
      created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    };
  }
}
