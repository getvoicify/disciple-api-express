import type { GalleryRepository } from './repository';
import type { MediaRepository } from '../media/repository';
import type { ThumbnailService } from './thumbnail-service';
import type {
  CreateGalleryInput,
  AddMediaToGalleryInput,
  Gallery,
  GalleryWithItems
} from './schemas';
import {
  CreateGalleryInput as CreateGallerySchema,
  AddMediaToGalleryInput as AddMediaToGallerySchema
} from './schemas';
import { GalleryAlreadyExistsError, GalleryNotFoundError } from './errors';
import { safeExecute } from '../utils/handle-async';
import { z } from 'zod';

export interface GalleryService {
  createGallery(input: CreateGalleryInput): Promise<Gallery>;
  addMediaToGallery(input: AddMediaToGalleryInput): Promise<GalleryWithItems>;
  getGalleryByChurchId(churchId: string): Promise<Gallery | null>;
  removeMediaFromGallery(galleryId: string, mediaId: string): Promise<void>;
}

export const GalleryService = {
  name: 'GalleryService',
  methods: ['createGallery', 'addMediaToGallery', 'getGalleryByChurchId', 'removeMediaFromGallery']
} as const;

export class GalleryServiceImpl implements GalleryService {
  constructor(
    private readonly galleryRepository: GalleryRepository,
    private readonly mediaRepository: MediaRepository,
    private readonly thumbnailService: ThumbnailService
  ) {}

  async createGallery(input: CreateGalleryInput): Promise<Gallery> {
    const validated = CreateGallerySchema.parse(input);

    // Check if gallery already exists for this church
    const existing = await this.galleryRepository.findByChurchId(validated.churchId);
    if (existing) {
      throw new GalleryAlreadyExistsError(validated.churchId);
    }

    // Create gallery
    const gallery = await this.galleryRepository.create(validated.churchId);

    // Process media items and generate thumbnails
    const items = await this.processMediaItems(validated.mediaIds);

    // Add items to gallery
    await this.galleryRepository.addMediaItems(gallery.id, items);

    return gallery;
  }

  async addMediaToGallery(input: AddMediaToGalleryInput): Promise<GalleryWithItems> {
    const validated = AddMediaToGallerySchema.parse(input);

    // Verify gallery exists
    const gallery = await this.galleryRepository.findById(validated.galleryId);
    if (!gallery) {
      throw new GalleryNotFoundError(validated.galleryId);
    }

    // Process media items and generate thumbnails
    const items = await this.processMediaItems(validated.mediaIds);

    // Add items to gallery
    await this.galleryRepository.addMediaItems(validated.galleryId, items);

    // Return gallery with items
    const galleryWithItems = await this.galleryRepository.getGalleryWithItems(validated.galleryId);
    if (!galleryWithItems) {
      throw new GalleryNotFoundError(validated.galleryId);
    }

    return galleryWithItems;
  }

  async getGalleryByChurchId(churchId: string): Promise<Gallery | null> {
    this.validateUUID(churchId);
    return this.galleryRepository.findByChurchId(churchId);
  }

  async removeMediaFromGallery(galleryId: string, mediaId: string): Promise<void> {
    this.validateUUID(galleryId);
    this.validateUUID(mediaId);

    await this.galleryRepository.removeMediaItem(galleryId, mediaId);
  }

  private async processMediaItems(mediaIds: string[]): Promise<Array<{ mediaId: string; thumbnailId: string }>> {
    const items: Array<{ mediaId: string; thumbnailId: string }> = [];

    for (const mediaId of mediaIds) {
      const [mediaError, media] = await safeExecute(
        this.mediaRepository.findById(mediaId)
      );

      if (mediaError || !media) {
        throw new Error(`Media not found: ${mediaId}`);
      }

      const [thumbnailError, thumbnail] = await safeExecute(
        this.thumbnailService.generateThumbnail(media)
      );

      if (thumbnailError || !thumbnail) {
        throw new Error(`Failed to generate thumbnail for media: ${mediaId}`);
      }

      items.push({
        mediaId: media.id,
        thumbnailId: thumbnail.id
      });
    }

    return items;
  }

  private validateUUID(id: string): void {
    const uuidSchema = z.uuid();
    uuidSchema.parse(id);
  }
}