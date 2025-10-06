import { describe, it, expect, vi } from 'vitest';
import type { CreateGalleryInput, AddMediaToGalleryInput } from '../../gallery/schemas';
import { randomUUID } from 'crypto';

describe('Gallery Service', () => {
  describe('GalleryService Interface', () => {
    it('should import GalleryService interface', async () => {
      const { GalleryService } = await import('../../gallery/service');
      expect(GalleryService).toBeDefined();
    });

    it('should have required methods', async () => {
      const { GalleryService } = await import('../../gallery/service');

      expect(GalleryService.name).toBe('GalleryService');
      expect(GalleryService.methods).toContain('createGallery');
      expect(GalleryService.methods).toContain('addMediaToGallery');
      expect(GalleryService.methods).toContain('getGalleryByChurchId');
      expect(GalleryService.methods).toContain('removeMediaFromGallery');
    });
  });

  describe('GalleryServiceImpl', () => {
    it('should create a new gallery with media items', async () => {
      const { GalleryServiceImpl } = await import('../../gallery/service');

      const galleryId = randomUUID();
      const churchId = randomUUID();
      const mediaId1 = randomUUID();
      const mediaId2 = randomUUID();

      const mockGalleryRepo = {
        create: vi.fn().mockResolvedValue({
          id: galleryId,
          churchId: churchId,
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        findByChurchId: vi.fn().mockResolvedValue(null),
        addMediaItems: vi.fn().mockResolvedValue([randomUUID(), randomUUID()]),
        findById: vi.fn(),
        removeMediaItem: vi.fn(),
        getGalleryWithItems: vi.fn()
      };

      const mockMediaRepo = {
        findById: vi.fn().mockImplementation((id: string) => Promise.resolve({
          id,
          filename: 'test.jpg',
          originalFilename: 'test.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          r2Url: 'https://r2.example.com/test.jpg',
          r2Key: 'uploads/test.jpg',
          uploadedBy: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date()
        })),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      const mockThumbnailService = {
        generateThumbnail: vi.fn().mockImplementation((media) => Promise.resolve({
          id: randomUUID(),
          filename: 'thumb.jpg',
          originalFilename: 'thumb.jpg',
          mimeType: 'image/jpeg',
          fileSize: 512,
          r2Url: 'https://r2.example.com/thumb.jpg',
          r2Key: 'thumbnails/thumb.jpg',
          uploadedBy: media.uploadedBy,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      };

      const service = new GalleryServiceImpl(
        mockGalleryRepo,
        mockMediaRepo,
        mockThumbnailService
      );

      const input: CreateGalleryInput = {
        churchId: churchId,
        mediaIds: [mediaId1, mediaId2]
      };

      const result = await service.createGallery(input);

      expect(result).toBeDefined();
      expect(result.id).toBe(galleryId);
      expect(mockGalleryRepo.create).toHaveBeenCalledWith(churchId);
      expect(mockMediaRepo.findById).toHaveBeenCalledTimes(2);
      expect(mockThumbnailService.generateThumbnail).toHaveBeenCalledTimes(2);
      expect(mockGalleryRepo.addMediaItems).toHaveBeenCalled();
    });

    it('should throw error if gallery already exists for church', async () => {
      const { GalleryServiceImpl } = await import('../../gallery/service');
      const { GalleryAlreadyExistsError } = await import('../../gallery/errors');

      const churchId = randomUUID();

      const mockGalleryRepo = {
        create: vi.fn(),
        findByChurchId: vi.fn().mockResolvedValue({
          id: randomUUID(),
          churchId: churchId,
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        addMediaItems: vi.fn(),
        findById: vi.fn(),
        removeMediaItem: vi.fn(),
        getGalleryWithItems: vi.fn()
      };

      const mockMediaRepo = {
        findById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      const mockThumbnailService = {
        generateThumbnail: vi.fn()
      };

      const service = new GalleryServiceImpl(
        mockGalleryRepo,
        mockMediaRepo,
        mockThumbnailService
      );

      const input: CreateGalleryInput = {
        churchId: churchId,
        mediaIds: [randomUUID()]
      };

      await expect(service.createGallery(input)).rejects.toThrow(GalleryAlreadyExistsError);
    });

    it('should add media to existing gallery', async () => {
      const { GalleryServiceImpl } = await import('../../gallery/service');

      const galleryId = randomUUID();
      const churchId = randomUUID();
      const mediaId = randomUUID();
      const thumbnailId = randomUUID();
      const itemId = randomUUID();

      const mockGalleryRepo = {
        create: vi.fn(),
        findByChurchId: vi.fn(),
        addMediaItems: vi.fn().mockResolvedValue([itemId]),
        findById: vi.fn().mockResolvedValue({
          id: galleryId,
          churchId: churchId,
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        removeMediaItem: vi.fn(),
        getGalleryWithItems: vi.fn().mockResolvedValue({
          id: galleryId,
          churchId: churchId,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [{ id: itemId, galleryId: galleryId, mediaId: mediaId, thumbnailId: thumbnailId, createdAt: new Date() }]
        })
      };

      const mockMediaRepo = {
        findById: vi.fn().mockResolvedValue({
          id: mediaId,
          filename: 'test3.jpg',
          originalFilename: 'test3.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          r2Url: 'https://r2.example.com/test3.jpg',
          r2Key: 'uploads/test3.jpg',
          uploadedBy: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      const mockThumbnailService = {
        generateThumbnail: vi.fn().mockResolvedValue({
          id: thumbnailId,
          filename: 'thumb3.jpg',
          originalFilename: 'thumb3.jpg',
          mimeType: 'image/jpeg',
          fileSize: 512,
          r2Url: 'https://r2.example.com/thumb3.jpg',
          r2Key: 'thumbnails/thumb3.jpg',
          uploadedBy: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date()
        })
      };

      const service = new GalleryServiceImpl(
        mockGalleryRepo,
        mockMediaRepo,
        mockThumbnailService
      );

      const input: AddMediaToGalleryInput = {
        galleryId: galleryId,
        mediaIds: [mediaId]
      };

      const result = await service.addMediaToGallery(input);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(mockGalleryRepo.findById).toHaveBeenCalledWith(galleryId);
      expect(mockMediaRepo.findById).toHaveBeenCalledWith(mediaId);
      expect(mockThumbnailService.generateThumbnail).toHaveBeenCalled();
      expect(mockGalleryRepo.addMediaItems).toHaveBeenCalled();
    });

    it('should throw error when adding media to non-existent gallery', async () => {
      const { GalleryServiceImpl } = await import('../../gallery/service');
      const { GalleryNotFoundError } = await import('../../gallery/errors');

      const mockGalleryRepo = {
        create: vi.fn(),
        findByChurchId: vi.fn(),
        addMediaItems: vi.fn(),
        findById: vi.fn().mockResolvedValue(null),
        removeMediaItem: vi.fn(),
        getGalleryWithItems: vi.fn()
      };

      const mockMediaRepo = {
        findById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      const mockThumbnailService = {
        generateThumbnail: vi.fn()
      };

      const service = new GalleryServiceImpl(
        mockGalleryRepo,
        mockMediaRepo,
        mockThumbnailService
      );

      const input: AddMediaToGalleryInput = {
        galleryId: randomUUID(),
        mediaIds: [randomUUID()]
      };

      await expect(service.addMediaToGallery(input)).rejects.toThrow(GalleryNotFoundError);
    });

    it('should get gallery by church ID', async () => {
      const { GalleryServiceImpl } = await import('../../gallery/service');

      const galleryId = randomUUID();
      const churchId = randomUUID();

      const mockGalleryRepo = {
        create: vi.fn(),
        findByChurchId: vi.fn().mockResolvedValue({
          id: galleryId,
          churchId: churchId,
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        addMediaItems: vi.fn(),
        findById: vi.fn(),
        removeMediaItem: vi.fn(),
        getGalleryWithItems: vi.fn()
      };

      const mockMediaRepo = {
        findById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      const mockThumbnailService = {
        generateThumbnail: vi.fn()
      };

      const service = new GalleryServiceImpl(
        mockGalleryRepo,
        mockMediaRepo,
        mockThumbnailService
      );

      const result = await service.getGalleryByChurchId(churchId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(galleryId);
      expect(mockGalleryRepo.findByChurchId).toHaveBeenCalledWith(churchId);
    });

    it('should remove media from gallery', async () => {
      const { GalleryServiceImpl } = await import('../../gallery/service');

      const galleryId = randomUUID();
      const mediaId = randomUUID();

      const mockGalleryRepo = {
        create: vi.fn(),
        findByChurchId: vi.fn(),
        addMediaItems: vi.fn(),
        findById: vi.fn(),
        removeMediaItem: vi.fn().mockResolvedValue(true),
        getGalleryWithItems: vi.fn()
      };

      const mockMediaRepo = {
        findById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      const mockThumbnailService = {
        generateThumbnail: vi.fn()
      };

      const service = new GalleryServiceImpl(
        mockGalleryRepo,
        mockMediaRepo,
        mockThumbnailService
      );

      await service.removeMediaFromGallery(galleryId, mediaId);

      expect(mockGalleryRepo.removeMediaItem).toHaveBeenCalledWith(galleryId, mediaId);
    });
  });
});
