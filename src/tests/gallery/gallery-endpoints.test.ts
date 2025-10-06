import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import express from 'express';

describe('Gallery Endpoints', () => {
  describe('POST /api/churches/:churchId/galleries', () => {
    it('should create a gallery for a church', async () => {
      const { galleryCreateEndpoint } = await import('../../gallery/routes/galleryCreate.endpoint');

      const churchId = randomUUID();
      const mediaId1 = randomUUID();
      const mediaId2 = randomUUID();

      const mockService = {
        createGallery: vi.fn().mockResolvedValue({
          id: randomUUID(),
          churchId,
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        addMediaToGallery: vi.fn(),
        getGalleryByChurchId: vi.fn(),
        removeMediaFromGallery: vi.fn()
      };

      const req = {
        params: { churchId },
        body: { mediaIds: [mediaId1, mediaId2] },
        user: [{ sub: randomUUID() }]
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      await galleryCreateEndpoint(mockService)(req, res);

      expect(mockService.createGallery).toHaveBeenCalledWith({
        churchId,
        mediaIds: [mediaId1, mediaId2]
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          gallery: expect.any(Object)
        })
      );
    });

    it('should return 401 if user is not authenticated', async () => {
      const { galleryCreateEndpoint } = await import('../../gallery/routes/galleryCreate.endpoint');

      const mockService = {
        createGallery: vi.fn(),
        addMediaToGallery: vi.fn(),
        getGalleryByChurchId: vi.fn(),
        removeMediaFromGallery: vi.fn()
      };

      const req = {
        params: { churchId: randomUUID() },
        body: { mediaIds: [randomUUID()] },
        user: undefined
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      await galleryCreateEndpoint(mockService)(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String)
        })
      );
    });
  });

  describe('POST /api/churches/:churchId/galleries/:galleryId/media', () => {
    it('should add media to existing gallery', async () => {
      const { galleryAddMediaEndpoint } = await import('../../gallery/routes/galleryAddMedia.endpoint');

      const churchId = randomUUID();
      const galleryId = randomUUID();
      const mediaId = randomUUID();

      const mockService = {
        createGallery: vi.fn(),
        addMediaToGallery: vi.fn().mockResolvedValue({
          id: galleryId,
          churchId,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [
            {
              id: randomUUID(),
              galleryId,
              mediaId,
              thumbnailId: randomUUID(),
              createdAt: new Date()
            }
          ]
        }),
        getGalleryByChurchId: vi.fn(),
        removeMediaFromGallery: vi.fn()
      };

      const req = {
        params: { churchId, galleryId },
        body: { mediaIds: [mediaId] },
        user: [{ sub: randomUUID() }]
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      await galleryAddMediaEndpoint(mockService)(req, res);

      expect(mockService.addMediaToGallery).toHaveBeenCalledWith({
        galleryId,
        mediaIds: [mediaId]
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          gallery: expect.any(Object)
        })
      );
    });
  });

  describe('GET /api/churches/:churchId/galleries', () => {
    it('should get gallery for a church', async () => {
      const { galleryFetchEndpoint } = await import('../../gallery/routes/galleryFetch.endpoint');

      const churchId = randomUUID();
      const galleryId = randomUUID();

      const mockService = {
        createGallery: vi.fn(),
        addMediaToGallery: vi.fn(),
        getGalleryByChurchId: vi.fn().mockResolvedValue({
          id: galleryId,
          churchId,
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        removeMediaFromGallery: vi.fn()
      };

      const req = {
        params: { churchId },
        user: [{ sub: randomUUID() }]
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      await galleryFetchEndpoint(mockService)(req, res);

      expect(mockService.getGalleryByChurchId).toHaveBeenCalledWith(churchId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          gallery: expect.any(Object)
        })
      );
    });

    it('should return 404 if gallery not found', async () => {
      const { galleryFetchEndpoint } = await import('../../gallery/routes/galleryFetch.endpoint');

      const mockService = {
        createGallery: vi.fn(),
        addMediaToGallery: vi.fn(),
        getGalleryByChurchId: vi.fn().mockResolvedValue(null),
        removeMediaFromGallery: vi.fn()
      };

      const req = {
        params: { churchId: randomUUID() },
        user: [{ sub: randomUUID() }]
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      await galleryFetchEndpoint(mockService)(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String)
        })
      );
    });
  });

  describe('DELETE /api/churches/:churchId/galleries/:galleryId/media/:mediaId', () => {
    it('should remove media from gallery', async () => {
      const { galleryRemoveMediaEndpoint } = await import('../../gallery/routes/galleryRemoveMedia.endpoint');

      const churchId = randomUUID();
      const galleryId = randomUUID();
      const mediaId = randomUUID();

      const mockService = {
        createGallery: vi.fn(),
        addMediaToGallery: vi.fn(),
        getGalleryByChurchId: vi.fn(),
        removeMediaFromGallery: vi.fn().mockResolvedValue(undefined)
      };

      const req = {
        params: { churchId, galleryId, mediaId },
        user: [{ sub: randomUUID() }]
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      await galleryRemoveMediaEndpoint(mockService)(req, res);

      expect(mockService.removeMediaFromGallery).toHaveBeenCalledWith(galleryId, mediaId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });
  });

  describe('Gallery Routes', () => {
    it('should export gallery router', async () => {
      const { galleryRouter } = await import('../../gallery/routes/routes');
      expect(galleryRouter).toBeDefined();
      expect(typeof galleryRouter).toBe('function');
    });
  });
});