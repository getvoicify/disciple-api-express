import { describe, it, expect } from 'vitest';

describe('Gallery Schemas', () => {
  describe('Gallery Schema Validation', () => {
    it('should import and use CreateGalleryInput type', async () => {
      const { CreateGalleryInput } = await import('../../gallery/schemas');

      const mockInput = {
        churchId: '123e4567-e89b-12d3-a456-426614174000',
        mediaIds: [
          '456e7890-e89b-12d3-a456-426614174001',
          '789e0123-e89b-12d3-a456-426614174002'
        ]
      };

      const result = CreateGalleryInput.parse(mockInput);
      expect(result.churchId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.mediaIds).toHaveLength(2);
    });

    it('should import and use AddMediaToGalleryInput type', async () => {
      const { AddMediaToGalleryInput } = await import('../../gallery/schemas');

      const mockInput = {
        galleryId: '123e4567-e89b-12d3-a456-426614174000',
        mediaIds: [
          '456e7890-e89b-12d3-a456-426614174001'
        ]
      };

      const result = AddMediaToGalleryInput.parse(mockInput);
      expect(result.galleryId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.mediaIds).toHaveLength(1);
    });

    it('should import and use Gallery type', async () => {
      const { Gallery } = await import('../../gallery/schemas');

      const mockGallery = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        churchId: '456e7890-e89b-12d3-a456-426614174001',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = Gallery.parse(mockGallery);
      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.churchId).toBe('456e7890-e89b-12d3-a456-426614174001');
    });

    it('should import and use GalleryItem type', async () => {
      const { GalleryItem } = await import('../../gallery/schemas');

      const mockGalleryItem = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        galleryId: '456e7890-e89b-12d3-a456-426614174001',
        mediaId: '789e0123-e89b-12d3-a456-426614174002',
        thumbnailId: '012e3456-e89b-12d3-a456-426614174003',
        createdAt: new Date()
      };

      const result = GalleryItem.parse(mockGalleryItem);
      expect(result.galleryId).toBe('456e7890-e89b-12d3-a456-426614174001');
      expect(result.mediaId).toBe('789e0123-e89b-12d3-a456-426614174002');
      expect(result.thumbnailId).toBe('012e3456-e89b-12d3-a456-426614174003');
    });

    it('should import and use GalleryWithItems type', async () => {
      const { GalleryWithItems } = await import('../../gallery/schemas');

      const mockGalleryWithItems = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        churchId: '456e7890-e89b-12d3-a456-426614174001',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: '789e0123-e89b-12d3-a456-426614174002',
            galleryId: '123e4567-e89b-12d3-a456-426614174000',
            mediaId: '012e3456-e89b-12d3-a456-426614174003',
            thumbnailId: '345e6789-e89b-12d3-a456-426614174004',
            createdAt: new Date()
          }
        ]
      };

      const result = GalleryWithItems.parse(mockGalleryWithItems);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].thumbnailId).toBe('345e6789-e89b-12d3-a456-426614174004');
    });

    it('should reject CreateGalleryInput with empty mediaIds array', async () => {
      const { CreateGalleryInput } = await import('../../gallery/schemas');

      const mockInput = {
        churchId: '123e4567-e89b-12d3-a456-426614174000',
        mediaIds: []
      };

      expect(() => CreateGalleryInput.parse(mockInput)).toThrow();
    });

    it('should reject CreateGalleryInput with invalid UUID in mediaIds', async () => {
      const { CreateGalleryInput } = await import('../../gallery/schemas');

      const mockInput = {
        churchId: '123e4567-e89b-12d3-a456-426614174000',
        mediaIds: ['invalid-uuid']
      };

      expect(() => CreateGalleryInput.parse(mockInput)).toThrow();
    });

    it('should reject AddMediaToGalleryInput with empty mediaIds array', async () => {
      const { AddMediaToGalleryInput } = await import('../../gallery/schemas');

      const mockInput = {
        galleryId: '123e4567-e89b-12d3-a456-426614174000',
        mediaIds: []
      };

      expect(() => AddMediaToGalleryInput.parse(mockInput)).toThrow();
    });
  });
});