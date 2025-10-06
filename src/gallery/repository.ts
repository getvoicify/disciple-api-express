import type { Gallery, GalleryWithItems } from './schemas';

export interface GalleryItemInput {
  mediaId: string;
  thumbnailId: string;
}

export interface GalleryRepository {
  create(churchId: string): Promise<Gallery>;
  findByChurchId(churchId: string): Promise<Gallery | null>;
  addMediaItems(galleryId: string, items: GalleryItemInput[]): Promise<string[]>;
  findById(id: string): Promise<Gallery | null>;
  removeMediaItem(galleryId: string, mediaId: string): Promise<boolean>;
  getGalleryWithItems(galleryId: string): Promise<GalleryWithItems | null>;
}

// Export for testing
export const GalleryRepository = {
  name: 'GalleryRepository',
  methods: ['create', 'findByChurchId', 'addMediaItems', 'findById', 'removeMediaItem', 'getGalleryWithItems']
} as const;