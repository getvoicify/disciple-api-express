import type { RawDb } from '../../utils/database';
import type { PrayerAttachment, CreateAttachmentInput } from '../prayer-attachment.entity';

/**
 * Interface for prayer attachment repository operations
 */
export interface IPrayerAttachmentRepository {
  findById(id: string): Promise<PrayerAttachment | null>;
  findByPrayerId(prayerId: string): Promise<PrayerAttachment[]>;
  create(data: CreateAttachmentInput): Promise<PrayerAttachment>;
  delete(id: string): Promise<void>;
  findOrphanedAttachments(olderThan: Date): Promise<PrayerAttachment[]>;
}

/**
 * Repository for managing prayer attachments
 * Handles CRUD operations for file attachments on prayer requests
 */
export class PrayerAttachmentRepository implements IPrayerAttachmentRepository {
  constructor(private readonly db: RawDb) {}

  /**
   * Find an attachment by ID
   * Excludes soft-deleted attachments
   */
  async findById(id: string): Promise<PrayerAttachment | null> {
    const result = await this.db`
      SELECT *
      FROM prayer_attachments
      WHERE id = ${id}
        AND deleted_at IS NULL
    `;

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToAttachment(result[0]);
  }

  /**
   * Find all attachments for a specific prayer request
   * Excludes soft-deleted attachments
   */
  async findByPrayerId(prayerId: string): Promise<PrayerAttachment[]> {
    const result = await this.db`
      SELECT *
      FROM prayer_attachments
      WHERE prayer_request_id = ${prayerId}
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;

    return result.map((row) => this.mapRowToAttachment(row));
  }

  /**
   * Create a new prayer attachment record
   */
  async create(data: CreateAttachmentInput): Promise<PrayerAttachment> {
    const id = crypto.randomUUID();
    const now = new Date();

    const result = await this.db`
      INSERT INTO prayer_attachments (
        id,
        prayer_request_id,
        file_name,
        file_size,
        file_type,
        storage_key,
        uploaded_by,
        created_at
      )
      VALUES (
        ${id},
        ${data.prayerRequestId},
        ${data.fileName},
        ${data.fileSize},
        ${data.fileType},
        ${data.storageKey},
        ${data.uploadedBy},
        ${now}
      )
      RETURNING *
    `;

    return this.mapRowToAttachment(result[0]);
  }

  /**
   * Soft-delete an attachment by setting deleted_at
   */
  async delete(id: string): Promise<void> {
    const now = new Date();

    await this.db`
      UPDATE prayer_attachments
      SET deleted_at = ${now}
      WHERE id = ${id}
        AND deleted_at IS NULL
    `;
  }

  /**
   * Find attachments that are orphaned (linked to deleted prayers older than specified date)
   * Returns attachments where prayer_request_id links to prayers with deleted_at < olderThan
   */
  async findOrphanedAttachments(olderThan: Date): Promise<PrayerAttachment[]> {
    const result = await this.db`
      SELECT a.*
      FROM prayer_attachments a
      INNER JOIN prayer_requests p ON a.prayer_request_id = p.id
      WHERE p.deleted_at IS NOT NULL
        AND p.deleted_at < ${olderThan}
        AND a.deleted_at IS NULL
    `;

    return result.map((row) => this.mapRowToAttachment(row));
  }

  /**
   * Map a database row to a PrayerAttachment domain model
   */
  private mapRowToAttachment(row: any): PrayerAttachment {
    return {
      id: row.id,
      prayerRequestId: row.prayer_request_id,
      fileName: row.file_name,
      fileSize: row.file_size,
      fileType: row.file_type,
      storageKey: row.storage_key,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      deletedAt: row.deleted_at
        ? row.deleted_at instanceof Date
          ? row.deleted_at
          : new Date(row.deleted_at)
        : undefined,
    };
  }
}
