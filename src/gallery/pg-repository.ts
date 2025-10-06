import type { Sql } from 'postgres';
import type { GalleryRepository, GalleryItemInput } from './repository';
import type { Gallery, GalleryWithItems } from './schemas';

export class PostgresGalleryRepository implements GalleryRepository {
  constructor(private readonly db: Sql) {}

  async create(churchId: string): Promise<Gallery> {
    const [gallery] = await this.db<Gallery[]>`
      INSERT INTO galleries (church_id)
      VALUES (${churchId})
      RETURNING id, church_id as "churchId", created_at as "createdAt", updated_at as "updatedAt"
    `;
    return gallery;
  }

  async findByChurchId(churchId: string): Promise<Gallery | null> {
    const [gallery] = await this.db<Gallery[]>`
      SELECT id, church_id as "churchId", created_at as "createdAt", updated_at as "updatedAt"
      FROM galleries
      WHERE church_id = ${churchId}
    `;
    return gallery || null;
  }

  async addMediaItems(galleryId: string, items: GalleryItemInput[]): Promise<string[]> {
    if (items.length === 0) return [];

    const insertedItems = await this.db<{ id: string }[]>`
      INSERT INTO gallery_items (gallery_id, media_id, thumbnail_id)
      SELECT * FROM ${this.db(items.map(item => ({
        gallery_id: galleryId,
        media_id: item.mediaId,
        thumbnail_id: item.thumbnailId
      })))}
      ON CONFLICT (gallery_id, media_id) DO NOTHING
      RETURNING id
    `;

    return insertedItems.map(item => item.id);
  }

  async findById(id: string): Promise<Gallery | null> {
    const [gallery] = await this.db<Gallery[]>`
      SELECT id, church_id as "churchId", created_at as "createdAt", updated_at as "updatedAt"
      FROM galleries
      WHERE id = ${id}
    `;
    return gallery || null;
  }

  async removeMediaItem(galleryId: string, mediaId: string): Promise<boolean> {
    const result = await this.db`
      DELETE FROM gallery_items
      WHERE gallery_id = ${galleryId} AND media_id = ${mediaId}
    `;
    return result.count > 0;
  }

  async getGalleryWithItems(galleryId: string): Promise<GalleryWithItems | null> {
    const gallery = await this.findById(galleryId);
    if (!gallery) return null;

    const items = await this.db<Array<{
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
  }
}