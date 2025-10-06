import { z } from 'zod';

export const Gallery = z.object({
  id: z.uuid(),
  churchId: z.uuid(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const GalleryItem = z.object({
  id: z.uuid(),
  galleryId: z.uuid(),
  mediaId: z.uuid(),
  thumbnailId: z.uuid(),
  createdAt: z.date()
});

export const CreateGalleryInput = z.object({
  churchId: z.uuid(),
  mediaIds: z.array(z.uuid()).min(1, 'At least one media item is required')
});

export const AddMediaToGalleryInput = z.object({
  galleryId: z.uuid(),
  mediaIds: z.array(z.uuid()).min(1, 'At least one media item is required')
});

export const GalleryWithItems = Gallery.extend({
  items: z.array(GalleryItem)
});

export const GalleryFilters = z.object({
  churchId: z.uuid().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional()
});

export type Gallery = z.infer<typeof Gallery>;
export type GalleryItem = z.infer<typeof GalleryItem>;
export type CreateGalleryInput = z.infer<typeof CreateGalleryInput>;
export type AddMediaToGalleryInput = z.infer<typeof AddMediaToGalleryInput>;
export type GalleryWithItems = z.infer<typeof GalleryWithItems>;
export type GalleryFilters = z.infer<typeof GalleryFilters>;