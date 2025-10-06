import {describe, expect, it, vi} from 'vitest';
import type {Media} from '../../media/schemas';

// Helper to create a minimal valid JPEG buffer for testing (1x1 pixel)
function createMockImageBuffer(): ArrayBuffer {
  // Minimal valid 1x1 black pixel JPEG
  const buffer = new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x03, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03, 0x02, 0x02, 0x02, 0x03,
    0x03, 0x03, 0x03, 0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06,
    0x06, 0x05, 0x06, 0x09, 0x08, 0x0A, 0x0A, 0x09, 0x08, 0x09, 0x09, 0x0A,
    0x0C, 0x0F, 0x0C, 0x0A, 0x0B, 0x0E, 0x0B, 0x09, 0x09, 0x0D, 0x11, 0x0D,
    0x0E, 0x0F, 0x10, 0x10, 0x11, 0x10, 0x0A, 0x0C, 0x12, 0x13, 0x12, 0x10,
    0x13, 0x0F, 0x10, 0x10, 0x10, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x09, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
    0x7F, 0x80, 0xFF, 0xD9
  ]);
  return buffer.buffer;
}

describe('Thumbnail Service', () => {
  describe('ThumbnailService Interface', () => {
    it('should import ThumbnailService interface', async () => {
      const { ThumbnailService } = await import('../../gallery/thumbnail-service');
      expect(ThumbnailService).toBeDefined();
    });

    it('should have generateThumbnail method', async () => {
      const { ThumbnailService } = await import('../../gallery/thumbnail-service');

      type ThumbnailServiceType = import('../../gallery/thumbnail-service').ThumbnailService;

      const mockService: ThumbnailServiceType = {
        generateThumbnail: async (_media) => ({
          id: 'thumbnail-id',
          filename: 'thumbnail.jpg',
          originalFilename: 'thumbnail.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          r2Url: 'https://r2.example.com/thumbnails/thumbnail.jpg',
          r2Key: 'thumbnails/thumbnail.jpg',
          uploadedBy: 'user-id',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      };

      expect(typeof mockService.generateThumbnail).toBe('function');
      expect(ThumbnailService.name).toBe('ThumbnailService');
      expect(ThumbnailService.methods).toContain('generateThumbnail');
    });
  });

  describe('ThumbnailServiceImpl', () => {
    it('should create thumbnails for images', async () => {
      const { ThumbnailServiceImpl } = await import('../../gallery/thumbnail-service');

      const mockMedia: Media = {
        id: 'media-id',
        filename: 'test.jpg',
        originalFilename: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024000,
        r2Url: 'https://r2.example.com/test.jpg',
        r2Key: 'uploads/test.jpg',
        uploadedBy: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockR2Service = {
        uploadFile: vi.fn().mockResolvedValue({
          r2Url: 'https://r2.example.com/thumbnails/test_thumb.jpg',
          r2Key: 'thumbnails/test_thumb.jpg'
        }),
        deleteFile: vi.fn(),
        generatePresignedUploadUrl: vi.fn()
      };

      const mockMediaRepo = {
        create: vi.fn().mockResolvedValue({
          id: 'thumbnail-id',
          filename: 'test_thumb.jpg',
          originalFilename: 'test_thumb.jpg',
          mimeType: 'image/jpeg',
          fileSize: 5000,
          r2Url: 'https://r2.example.com/thumbnails/test_thumb.jpg',
          r2Key: 'thumbnails/test_thumb.jpg',
          uploadedBy: 'user-id',
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        update: vi.fn(),
        delete: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      // Mock HTTP client
      const mockHttpClient = {
        fetchAsBuffer: vi.fn().mockResolvedValue(Buffer.from(createMockImageBuffer()))
      };

      // Mock thumbnail generator
      const mockThumbnailGenerator = {
        generateFromImage: vi.fn().mockResolvedValue(Buffer.from(createMockImageBuffer())),
        generateVideoPlaceholder: vi.fn()
      };

      const service = new ThumbnailServiceImpl(mockR2Service, mockMediaRepo, mockHttpClient, mockThumbnailGenerator);
      const thumbnail = await service.generateThumbnail(mockMedia);

      expect(thumbnail).toBeDefined();
      expect(thumbnail.id).toBe('thumbnail-id');
      expect(mockR2Service.uploadFile).toHaveBeenCalled();
      expect(mockMediaRepo.create).toHaveBeenCalled();
    });

    it('should create thumbnails for videos', async () => {
      const { ThumbnailServiceImpl } = await import('../../gallery/thumbnail-service');

      const mockMedia: Media = {
        id: 'media-id',
        filename: 'test.mp4',
        originalFilename: 'test.mp4',
        mimeType: 'video/mp4',
        fileSize: 5024000,
        r2Url: 'https://r2.example.com/test.mp4',
        r2Key: 'uploads/test.mp4',
        uploadedBy: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockR2Service = {
        uploadFile: vi.fn().mockResolvedValue({
          r2Url: 'https://r2.example.com/thumbnails/test_thumb.jpg',
          r2Key: 'thumbnails/test_thumb.jpg'
        }),
        deleteFile: vi.fn(),
        generatePresignedUploadUrl: vi.fn()
      };

      const mockMediaRepo = {
        create: vi.fn().mockResolvedValue({
          id: 'thumbnail-id',
          filename: 'test_thumb.jpg',
          originalFilename: 'test_thumb.jpg',
          mimeType: 'image/jpeg',
          fileSize: 5000,
          r2Url: 'https://r2.example.com/thumbnails/test_thumb.jpg',
          r2Key: 'thumbnails/test_thumb.jpg',
          uploadedBy: 'user-id',
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        update: vi.fn(),
        delete: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      const mockHttpClient = {
        fetchAsBuffer: vi.fn()
      };

      // Mock thumbnail generator
      const mockThumbnailGenerator = {
        generateFromImage: vi.fn(),
        generateVideoPlaceholder: vi.fn().mockResolvedValue(Buffer.from(createMockImageBuffer()))
      };

      const service = new ThumbnailServiceImpl(mockR2Service, mockMediaRepo, mockHttpClient, mockThumbnailGenerator);
      const thumbnail = await service.generateThumbnail(mockMedia);

      expect(thumbnail).toBeDefined();
      expect(thumbnail.id).toBe('thumbnail-id');
      expect(mockR2Service.uploadFile).toHaveBeenCalled();
      expect(mockMediaRepo.create).toHaveBeenCalled();
    });

    it('should throw error for unsupported media types', async () => {
      const { ThumbnailServiceImpl } = await import('../../gallery/thumbnail-service');
      const { UnsupportedMediaTypeError } = await import('../../gallery/errors');

      const mockMedia: Media = {
        id: 'media-id',
        filename: 'test.pdf',
        originalFilename: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024000,
        r2Url: 'https://r2.example.com/test.pdf',
        r2Key: 'uploads/test.pdf',
        uploadedBy: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockR2Service = {
        uploadFile: vi.fn(),
        deleteFile: vi.fn(),
        generatePresignedUploadUrl: vi.fn()
      };

      const mockMediaRepo = {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      const mockHttpClient = {
        fetchAsBuffer: vi.fn()
      };

      const mockThumbnailGenerator = {
        generateFromImage: vi.fn(),
        generateVideoPlaceholder: vi.fn()
      };

      const service = new ThumbnailServiceImpl(mockR2Service, mockMediaRepo, mockHttpClient, mockThumbnailGenerator);

      await expect(service.generateThumbnail(mockMedia)).rejects.toThrow(UnsupportedMediaTypeError);
    });

    it('should throw ImageFetchError when fetching image fails', async () => {
      const { ThumbnailServiceImpl } = await import('../../gallery/thumbnail-service');
      const { ImageFetchError } = await import('../../gallery/errors');

      const mockMedia: Media = {
        id: 'media-id',
        filename: 'test.jpg',
        originalFilename: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024000,
        r2Url: 'https://r2.example.com/test.jpg',
        r2Key: 'uploads/test.jpg',
        uploadedBy: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockR2Service = {
        uploadFile: vi.fn(),
        deleteFile: vi.fn(),
        generatePresignedUploadUrl: vi.fn()
      };

      const mockMediaRepo = {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      // Mock HTTP client to fail
      const mockHttpClient = {
        fetchAsBuffer: vi.fn().mockRejectedValue(new Error('Network error'))
      };

      const mockThumbnailGenerator = {
        generateFromImage: vi.fn(),
        generateVideoPlaceholder: vi.fn()
      };

      const service = new ThumbnailServiceImpl(mockR2Service, mockMediaRepo, mockHttpClient, mockThumbnailGenerator);

      await expect(service.generateThumbnail(mockMedia)).rejects.toThrow(ImageFetchError);
    });

    it('should throw ThumbnailUploadError when upload fails', async () => {
      const { ThumbnailServiceImpl } = await import('../../gallery/thumbnail-service');
      const { ThumbnailUploadError } = await import('../../gallery/errors');

      const mockMedia: Media = {
        id: 'media-id',
        filename: 'test.jpg',
        originalFilename: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024000,
        r2Url: 'https://r2.example.com/test.jpg',
        r2Key: 'uploads/test.jpg',
        uploadedBy: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockR2Service = {
        uploadFile: vi.fn().mockRejectedValue(new Error('Upload failed')),
        deleteFile: vi.fn(),
        generatePresignedUploadUrl: vi.fn()
      };

      const mockMediaRepo = {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      // Mock HTTP client
      const mockHttpClient = {
        fetchAsBuffer: vi.fn().mockResolvedValue(Buffer.from(createMockImageBuffer()))
      };

      const mockThumbnailGenerator = {
        generateFromImage: vi.fn().mockResolvedValue(Buffer.from(createMockImageBuffer())),
        generateVideoPlaceholder: vi.fn()
      };

      const service = new ThumbnailServiceImpl(mockR2Service, mockMediaRepo, mockHttpClient, mockThumbnailGenerator);

      await expect(service.generateThumbnail(mockMedia)).rejects.toThrow(ThumbnailUploadError);
    });

    it('should throw ThumbnailMetadataSaveError when saving metadata fails', async () => {
      const { ThumbnailServiceImpl } = await import('../../gallery/thumbnail-service');
      const { ThumbnailMetadataSaveError } = await import('../../gallery/errors');

      const mockMedia: Media = {
        id: 'media-id',
        filename: 'test.jpg',
        originalFilename: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024000,
        r2Url: 'https://r2.example.com/test.jpg',
        r2Key: 'uploads/test.jpg',
        uploadedBy: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockR2Service = {
        uploadFile: vi.fn().mockResolvedValue({
          r2Url: 'https://r2.example.com/thumbnails/test_thumb.jpg',
          r2Key: 'thumbnails/test_thumb.jpg'
        }),
        deleteFile: vi.fn(),
        generatePresignedUploadUrl: vi.fn()
      };

      const mockMediaRepo = {
        create: vi.fn().mockRejectedValue(new Error('Database error')),
        update: vi.fn(),
        delete: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      // Mock HTTP client
      const mockHttpClient = {
        fetchAsBuffer: vi.fn().mockResolvedValue(Buffer.from(createMockImageBuffer()))
      };

      const mockThumbnailGenerator = {
        generateFromImage: vi.fn().mockResolvedValue(Buffer.from(createMockImageBuffer())),
        generateVideoPlaceholder: vi.fn()
      };

      const service = new ThumbnailServiceImpl(mockR2Service, mockMediaRepo, mockHttpClient, mockThumbnailGenerator);

      await expect(service.generateThumbnail(mockMedia)).rejects.toThrow(ThumbnailMetadataSaveError);
    });

    it('should throw ThumbnailGenerationError when image resize fails', async () => {
      const { ThumbnailServiceImpl } = await import('../../gallery/thumbnail-service');
      const { ThumbnailGenerationError } = await import('../../gallery/errors');

      const mockMedia: Media = {
        id: 'media-id',
        filename: 'test.jpg',
        originalFilename: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024000,
        r2Url: 'https://r2.example.com/test.jpg',
        r2Key: 'uploads/test.jpg',
        uploadedBy: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockR2Service = {
        uploadFile: vi.fn(),
        deleteFile: vi.fn(),
        generatePresignedUploadUrl: vi.fn()
      };

      const mockMediaRepo = {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      const mockHttpClient = {
        fetchAsBuffer: vi.fn().mockResolvedValue(Buffer.from(createMockImageBuffer()))
      };

      // Mock thumbnail generator to fail on image resize
      const mockThumbnailGenerator = {
        generateFromImage: vi.fn().mockRejectedValue(new Error('Image processing failed')),
        generateVideoPlaceholder: vi.fn()
      };

      const service = new ThumbnailServiceImpl(mockR2Service, mockMediaRepo, mockHttpClient, mockThumbnailGenerator);

      await expect(service.generateThumbnail(mockMedia)).rejects.toThrow(ThumbnailGenerationError);
    });

    it('should throw ThumbnailGenerationError when video placeholder generation fails', async () => {
      const { ThumbnailServiceImpl } = await import('../../gallery/thumbnail-service');
      const { ThumbnailGenerationError } = await import('../../gallery/errors');

      const mockMedia: Media = {
        id: 'media-id',
        filename: 'test.mp4',
        originalFilename: 'test.mp4',
        mimeType: 'video/mp4',
        fileSize: 5024000,
        r2Url: 'https://r2.example.com/test.mp4',
        r2Key: 'uploads/test.mp4',
        uploadedBy: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockR2Service = {
        uploadFile: vi.fn(),
        deleteFile: vi.fn(),
        generatePresignedUploadUrl: vi.fn()
      };

      const mockMediaRepo = {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        findByUploadedBy: vi.fn()
      };

      const mockHttpClient = {
        fetchAsBuffer: vi.fn()
      };

      // Mock thumbnail generator to fail on video placeholder
      const mockThumbnailGenerator = {
        generateFromImage: vi.fn(),
        generateVideoPlaceholder: vi.fn().mockRejectedValue(new Error('Placeholder generation failed'))
      };

      const service = new ThumbnailServiceImpl(mockR2Service, mockMediaRepo, mockHttpClient, mockThumbnailGenerator);

      await expect(service.generateThumbnail(mockMedia)).rejects.toThrow(ThumbnailGenerationError);
    });
  });
});
