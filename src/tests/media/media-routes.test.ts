import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { MediaRepository } from '../../media/repository';
import { CloudflareR2Service } from '../../media/cloudflare-r2-service';
import { MediaUploadService } from '../../media/media-upload-service';

// This import will FAIL in RED phase because the router doesn't exist yet
import { mediaRouter } from '../../media/routes/routes';

// Mock dependencies
vi.mock('../../media/repository');
vi.mock('../../media/cloudflare-r2-service');

const mockMediaRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findAll: vi.fn(),
  findByUploadedBy: vi.fn()
} as unknown as MediaRepository;

const mockR2Service = {
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  generatePresignedUploadUrl: vi.fn()
} as unknown as CloudflareR2Service;

describe('Media Router', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Mock environment variables for validateToken middleware
    process.env.IAM_ENDPOINT = 'https://mock-iam.example.com';
    process.env.IAM_REALM = 'test-realm';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Router Factory Function', () => {
    it('should be a function that takes dependencies and returns a router', () => {
      // TDD RED: This will fail because mediaRouter doesn't exist
      expect(typeof mediaRouter).toBe('function');

      const uploadService = new MediaUploadService(mockMediaRepository, mockR2Service);
      const router = mediaRouter(mockMediaRepository, uploadService);

      expect(router).toBeDefined();
      // Express routers should have these methods
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
    });
  });

  describe('Media Upload Route', () => {
    it('should have POST /upload route with multer and authentication middleware', async () => {
      // This test verifies the route exists and has proper middleware chain
      const uploadService = new MediaUploadService(mockMediaRepository, mockR2Service);
      const router = mediaRouter(mockMediaRepository, uploadService);

      app.use('/media', router);

      // This test just checks that the route exists and is properly configured
      // It will return 401 because we don't have proper JWT token, which is expected
      const response = await request(app)
        .post('/media/upload')
        .attach('file', Buffer.from('fake image'), 'test.jpg')
        .expect(401); // Expects 401 because no valid authentication

      // The fact that we get a structured error response means the route exists
      // and the authentication middleware is working
      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject upload without authentication', async () => {
      // TDD RED: This will fail because the route doesn't exist
      const uploadService = new MediaUploadService(mockMediaRepository, mockR2Service);
      const router = mediaRouter(mockMediaRepository, uploadService);

      app.use('/media', router);

      const response = await request(app)
        .post('/media/upload')
        .attach('file', Buffer.from('fake image'), 'test.jpg')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Media Proxy Route', () => {
    it('should have GET /serve/:id route with validation middleware (public endpoint)', async () => {
      // This test verifies the route exists and has proper validation middleware
      const uploadService = new MediaUploadService(mockMediaRepository, mockR2Service);
      const router = mediaRouter(mockMediaRepository, uploadService);

      app.use('/media', router);

      // Mock the repository to return null (media not found)
      (mockMediaRepository.findById as any).mockResolvedValue(null);

      // This test checks that the route exists and is public (no auth required)
      const response = await request(app)
        .get('/media/serve/123e4567-e89b-12d3-a456-426614174000')
        .expect(404); // Expects 404 because media doesn't exist

      // The fact that we get a structured error response means the route exists
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Media not found');
    });

    it('should validate UUID format for media ID parameter', async () => {
      // This test verifies that UUID validation happens before the endpoint
      // Since the endpoint is public, validation errors should be returned directly
      const uploadService = new MediaUploadService(mockMediaRepository, mockR2Service);
      const router = mediaRouter(mockMediaRepository, uploadService);

      app.use('/media', router);

      // With invalid UUID format, validation middleware should return 400
      const response = await request(app)
        .get('/media/serve/invalid-uuid-format')
        .expect(400);

      // Validation middleware returns an error structure
      expect(response.body).toHaveProperty('error');
    });

    it('should allow public access to media files', async () => {
      // Media proxy endpoint is public - no authentication required
      const uploadService = new MediaUploadService(mockMediaRepository, mockR2Service);
      const router = mediaRouter(mockMediaRepository, uploadService);

      app.use('/media', router);

      // Mock the repository to return a media object
      const mockMedia = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        filename: 'test.jpg',
        originalFilename: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        r2Url: 'https://example.com/test.jpg',
        r2Key: 'test.jpg',
        uploadedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      (mockMediaRepository.findById as any).mockResolvedValue(mockMedia);

      const response = await request(app)
        .get('/media/serve/123e4567-e89b-12d3-a456-426614174000')
        .expect(302); // Should redirect to R2 URL

      expect(response.headers.location).toBe(mockMedia.r2Url);
    });
  });

  describe('Router Configuration', () => {
    it('should use validateToken middleware for authentication', async () => {
      // TDD RED: This documents that we need validateToken middleware
      const uploadService = new MediaUploadService(mockMediaRepository, mockR2Service);
      const router = mediaRouter(mockMediaRepository, uploadService);

      expect(router).toBeDefined();

      // The router should be configured with authentication middleware
      // This will be verified by the integration tests above
    });

    it('should use validate middleware for parameter validation', async () => {
      // TDD RED: This documents that we need validate middleware with MediaIdInput
      const uploadService = new MediaUploadService(mockMediaRepository, mockR2Service);
      const router = mediaRouter(mockMediaRepository, uploadService);

      expect(router).toBeDefined();

      // The router should be configured with validation middleware
      // This will be verified by the UUID validation test above
    });
  });
});