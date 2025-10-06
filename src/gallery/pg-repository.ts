import type { RawDb } from '../utils/database';
import type { GalleryRepository, GalleryItemInput } from './repository';
import type { Gallery, GalleryWithItems } from './schemas';
import { safeExecute } from '../utils/handle-async';

export class PostgresGalleryRepository implements GalleryRepository {
  constructor(private readonly db: RawDb) {}

  async create(churchId: string): Promise<Gallery> {
    const [error, result] = await safeExecute(
      this.db<Gallery[]>`
        INSERT INTO galleries (church_id)
        VALUES (${churchId})
        RETURNING id, church_id as "churchId", created_at as "createdAt", updated_at as "updatedAt"
      `
    );

    if (error) {
      throw new Error(`Failed to create gallery: ${error.message}`);
    }

    const [gallery] = result;
    if (!gallery) {
      throw new Error('Gallery creation returned no data');
    }

    return gallery;
  }

  async findByChurchId(churchId: string): Promise<Gallery | null> {
    const [error, result] = await safeExecute(
      this.db<Gallery[]>`
        SELECT id, church_id as "churchId", created_at as "createdAt", updated_at as "updatedAt"
        FROM galleries
        WHERE church_id = ${churchId}
      `
    );

    if (error) {
      throw new Error(`Failed to find gallery by church ID: ${error.message}`);
    }

    const [gallery] = result;
    return gallery || null;
  }

  async addMediaItems(galleryId: string, items: GalleryItemInput[]): Promise<string[]> {
    if (items.length === 0) return [];

    const [error, insertedItems] = await safeExecute(
      this.db.begin(async (tx) => {
        return tx<{ id: string }[]>`
          INSERT INTO gallery_items (gallery_id, media_id, thumbnail_id)
          SELECT * FROM ${tx(items.map(item => ({
            gallery_id: galleryId,
            media_id: item.mediaId,
            thumbnail_id: item.thumbnailId
          })))}
          ON CONFLICT (gallery_id, media_id) DO NOTHING
          RETURNING id
        `;
      })
    );

    if (error) {
      throw new Error(`Failed to add media items: ${error.message}`);
    }

    return insertedItems.map(item => item.id);
  }

  async findById(id: string): Promise<Gallery | null> {
    const [error, result] = await safeExecute(
      this.db<Gallery[]>`
        SELECT id, church_id as "churchId", created_at as "createdAt", updated_at as "updatedAt"
        FROM galleries
        WHERE id = ${id}
      `
    );

    if (error) {
      throw new Error(`Failed to find gallery by ID: ${error.message}`);
    }

    const [gallery] = result;
    return gallery || null;
  }

  async removeMediaItem(galleryId: string, mediaId: string): Promise<boolean> {
    const [error, result] = await safeExecute(
      this.db`
        DELETE FROM gallery_items
        WHERE gallery_id = ${galleryId} AND media_id = ${mediaId}
      `
    );

    if (error) {
      throw new Error(`Failed to remove media item: ${error.message}`);
    }

    return result.count > 0;
  }

  async getGalleryWithItems(galleryId: string): Promise<GalleryWithItems | null> {
    const [error, result] = await safeExecute(
      this.db.begin(async (tx) => {
        const gallery = await this.findById(galleryId);
        if (!gallery) return null;

        const items = await tx<Array<{
          id: string;
          galleryId: string;
          mediaId: string;
          thumbnailId: string;
          createdAt: Date;
        }>>`
          SELECT
            id,
            gallery_id as "galleryId",
            media_id as "mediaId",
            thumbnail_id as "thumbnailId",
            created_at as "createdAt"
          FROM gallery_items
          WHERE gallery_id = ${galleryId}
          ORDER BY created_at DESC
        `;

        return {
          ...gallery,
          items
        };
      })
    );

    if (error) {
      throw new Error(`Failed to get gallery with items: ${error.message}`);
    }

    return result;
  }
}