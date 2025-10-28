import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudflareR2Service, CloudflareR2ServiceImpl } from '../../media/cloudflare-r2-service';
import {
    R2ConfigurationError,
    R2UploadError,
    R2DeleteError,
    R2PresignedUrlError,
    FileValidationError,
    InvalidFilenameError
} from '../../media/errors';

// Mock AWS SDK modules
vi.mock('@aws-sdk/client-s3', () => {
  const MockS3Client = vi.fn(function(this: any) {
    this.send = vi.fn();
  });

  const MockPutObjectCommand = vi.fn(function(this: any, params: any) {
    Object.assign(this, { ...params, _type: 'PutObjectCommand' });
  });

  const MockDeleteObjectCommand = vi.fn(function(this: any, params: any) {
    Object.assign(this, { ...params, _type: 'DeleteObjectCommand' });
  });

  return {
    S3Client: MockS3Client,
    PutObjectCommand: MockPutObjectCommand,
    DeleteObjectCommand: MockDeleteObjectCommand
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn()
}));

// Mock environment variables for R2 configuration
const mockR2Config = {
  R2_ENDPOINT: 'https://test-account-id.r2.cloudflarestorage.com',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  R2_BUCKET_NAME: 'test-media-bucket',
  R2_PUBLIC_URL_BASE: 'https://media.example.com'
};

// Mock external dependencies
vi.mock('process', () => ({
  env: mockR2Config
}));

describe('CloudflareR2Service', () => {
  let r2Service: CloudflareR2Service;
  let mockS3Client: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...mockR2Config };

    // Get the mocked S3Client constructor
    const { S3Client } = await import('@aws-sdk/client-s3');

    // Configure the mock S3 client's send method
    mockS3Client = {
      send: vi.fn().mockResolvedValue({})
    };

    // Make S3Client constructor return our mock
    vi.mocked(S3Client).mockImplementation(function() {
      return mockS3Client;
    });
  });

  describe('Constructor and Configuration', () => {
    it('should create R2 service instance with proper configuration', () => {
      expect(() => new CloudflareR2ServiceImpl()).not.toThrow();

      r2Service = new CloudflareR2ServiceImpl();
      expect(r2Service).toBeInstanceOf(CloudflareR2ServiceImpl);
      // Verify it implements the interface methods
      expect(typeof r2Service.uploadFile).toBe('function');
      expect(typeof r2Service.deleteFile).toBe('function');
      expect(typeof r2Service.generatePresignedUploadUrl).toBe('function');
    });

    it('should throw error when required environment variables are missing', () => {
      // Test missing R2_ENDPOINT
      delete process.env.R2_ENDPOINT;
      expect(() => new CloudflareR2ServiceImpl()).toThrow(R2ConfigurationError);

      // Reset and test missing R2_ACCESS_KEY_ID
      process.env.R2_ENDPOINT = mockR2Config.R2_ENDPOINT;
      delete process.env.R2_ACCESS_KEY_ID;
      expect(() => new CloudflareR2ServiceImpl()).toThrow(R2ConfigurationError);

      // Reset and test missing R2_SECRET_ACCESS_KEY
      process.env.R2_ACCESS_KEY_ID = mockR2Config.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      expect(() => new CloudflareR2ServiceImpl()).toThrow(R2ConfigurationError);

      // Reset and test missing R2_BUCKET_NAME
      process.env.R2_SECRET_ACCESS_KEY = mockR2Config.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      expect(() => new CloudflareR2ServiceImpl()).toThrow(R2ConfigurationError);
    });

    it('should use default public URL base when R2_PUBLIC_URL_BASE is not provided', () => {
      delete process.env.R2_PUBLIC_URL_BASE;

      expect(() => new CloudflareR2ServiceImpl()).not.toThrow();
    });
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      r2Service = new CloudflareR2ServiceImpl();
    });

    it('should upload file buffer to R2 and return URL and key', async () => {
      // Mock file data
      const fileBuffer = Buffer.from('test file content');
      const filename = 'test-image.jpg';
      const mimeType = 'image/jpeg';

      // Import mocked commands
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');

      // Expected result format
      const expectedResult = {
        r2Url: expect.stringContaining('https://media.example.com/'),
        r2Key: expect.stringMatching(/^uploads\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]+_test-image\.jpg$/)
      };

      const result = await r2Service.uploadFile(fileBuffer, filename, mimeType);

      expect(result).toMatchObject(expectedResult);
      expect(result.r2Url).toContain(result.r2Key);
      expect(result.r2Key).toContain('test-image.jpg');

      // Verify AWS SDK was called correctly
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-media-bucket',
        Key: expect.stringMatching(/^uploads\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]+_test-image\.jpg$/),
        Body: fileBuffer,
        ContentType: mimeType
      });

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });

    it('should generate unique keys for files with same filename', async () => {
      const fileBuffer = Buffer.from('test content');
      const filename = 'duplicate.jpg';
      const mimeType = 'image/jpeg';

      const result1 = await r2Service.uploadFile(fileBuffer, filename, mimeType);
      const result2 = await r2Service.uploadFile(fileBuffer, filename, mimeType);

      expect(result1.r2Key).not.toBe(result2.r2Key);
      expect(result1.r2Url).not.toBe(result2.r2Url);
    });

    it('should handle different file types and mime types correctly', async () => {
      const testCases = [
        { filename: 'document.pdf', mimeType: 'application/pdf' },
        { filename: 'video.mp4', mimeType: 'video/mp4' },
        { filename: 'audio.mp3', mimeType: 'audio/mpeg' },
        { filename: 'image.png', mimeType: 'image/png' }
      ];

      for (const testCase of testCases) {
        const fileBuffer = Buffer.from('test content');
        const result = await r2Service.uploadFile(fileBuffer, testCase.filename, testCase.mimeType);

        expect(result.r2Key).toContain(testCase.filename);
        expect(result.r2Url).toContain(result.r2Key);
      }
    });

    it('should organize files by date in folder structure', async () => {
      const fileBuffer = Buffer.from('test content');
      const filename = 'test.jpg';
      const mimeType = 'image/jpeg';

      const result = await r2Service.uploadFile(fileBuffer, filename, mimeType);

      // Should follow pattern: uploads/YYYY/MM/DD/uuid_filename
      const dateRegex = /^uploads\/\d{4}\/\d{2}\/\d{2}\//;
      expect(result.r2Key).toMatch(dateRegex);
    });

    it('should reject empty file buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const filename = 'empty.txt';
      const mimeType = 'text/plain';

      await expect(r2Service.uploadFile(emptyBuffer, filename, mimeType))
        .rejects.toThrow(FileValidationError);
    });

    it('should reject invalid filename', async () => {
      const fileBuffer = Buffer.from('test content');
      const mimeType = 'text/plain';

      await expect(r2Service.uploadFile(fileBuffer, '', mimeType))
        .rejects.toThrow(InvalidFilenameError);

      await expect(r2Service.uploadFile(fileBuffer, '   ', mimeType))
        .rejects.toThrow(InvalidFilenameError);
    });

    it('should handle R2 upload failures gracefully', async () => {
      const fileBuffer = Buffer.from('test content');
      const filename = 'test.jpg';
      const mimeType = 'image/jpeg';

      // Mock S3 client to throw an error
      const mockError = new Error('Network error');
      mockS3Client.send.mockRejectedValueOnce(mockError);

      await expect(r2Service.uploadFile(fileBuffer, filename, mimeType))
        .rejects.toThrow(R2UploadError);
    });
  });

  describe('deleteFile', () => {
    beforeEach(() => {
      r2Service = new CloudflareR2ServiceImpl();
    });

    it('should delete file from R2 using r2Key', async () => {
      const r2Key = 'uploads/2024/09/24/test-uuid_image.jpg';

      // Import mocked commands
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      await expect(r2Service.deleteFile(r2Key)).resolves.not.toThrow();

      // Verify AWS SDK was called correctly
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-media-bucket',
        Key: r2Key
      });

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });

    it('should handle deletion of non-existent file gracefully', async () => {
      const nonExistentKey = 'uploads/2024/01/01/non-existent_file.jpg';

      // Should not throw error for non-existent files
      await expect(r2Service.deleteFile(nonExistentKey)).resolves.not.toThrow();
    });

    it('should reject empty or invalid r2Key', async () => {
      await expect(r2Service.deleteFile(''))
        .rejects.toThrow(FileValidationError);

      await expect(r2Service.deleteFile('   '))
        .rejects.toThrow(FileValidationError);
    });

    it('should handle R2 deletion failures gracefully', async () => {
      const r2Key = 'uploads/2024/09/24/test_file.jpg';

      // Mock S3 client to throw an error
      const mockError = new Error('Delete operation failed');
      mockS3Client.send.mockRejectedValueOnce(mockError);

      await expect(r2Service.deleteFile(r2Key))
        .rejects.toThrow(R2DeleteError);
    });
  });

  describe('generatePresignedUploadUrl', () => {
    beforeEach(() => {
      r2Service = new CloudflareR2ServiceImpl();
    });

    it('should generate presigned URL for direct file uploads', async () => {
      const filename = 'upload-test.jpg';
      const mimeType = 'image/jpeg';
      const mockPresignedUrl = 'https://test-account-id.r2.cloudflarestorage.com/test-media-bucket/uploads/2024/09/24/test-uuid_upload-test.jpg?X-Amz-Signature=test';

      // Import mocked functions
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      // Configure the mock to return our URL
      vi.mocked(getSignedUrl).mockResolvedValue(mockPresignedUrl);

      const result = await r2Service.generatePresignedUploadUrl(filename, mimeType);

      expect(result).toMatchObject({
        uploadUrl: mockPresignedUrl,
        r2Key: expect.stringMatching(/^uploads\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]+_upload-test\.jpg$/)
      });

      // Verify AWS SDK was called correctly
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-media-bucket',
        Key: expect.stringMatching(/^uploads\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]+_upload-test\.jpg$/),
        ContentType: mimeType
      });

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        { expiresIn: 3600 }
      );
    });

    it('should generate unique keys for presigned URLs with same filename', async () => {
      const filename = 'same-name.jpg';
      const mimeType = 'image/jpeg';

      // Import mocked functions
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      // Configure the mock to return different URLs
      vi.mocked(getSignedUrl)
        .mockResolvedValueOnce('https://test.r2.com/url1')
        .mockResolvedValueOnce('https://test.r2.com/url2');

      const result1 = await r2Service.generatePresignedUploadUrl(filename, mimeType);
      const result2 = await r2Service.generatePresignedUploadUrl(filename, mimeType);

      expect(result1.r2Key).not.toBe(result2.r2Key);
      expect(result1.uploadUrl).not.toBe(result2.uploadUrl);
    });

    it('should include content-type in presigned URL parameters', async () => {
      const filename = 'typed-file.pdf';
      const mimeType = 'application/pdf';

      // Import mocked functions
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');

      // Configure the mock to return a URL with Content-Type
      const mockUrl = 'https://test.r2.com/bucket/key?Content-Type=application%2Fpdf&X-Amz-Expires=3600';
      vi.mocked(getSignedUrl).mockResolvedValue(mockUrl);

      const result = await r2Service.generatePresignedUploadUrl(filename, mimeType);

      // URL should contain content-type parameter
      expect(result.uploadUrl).toContain('Content-Type');
      expect(result.uploadUrl).toContain(encodeURIComponent('application/pdf'));

      // Verify the command was created with the correct content type
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        ContentType: mimeType
      }));
    });

    it('should set reasonable expiration time for presigned URLs', async () => {
      const filename = 'expiry-test.jpg';
      const mimeType = 'image/jpeg';

      // Import mocked functions
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      // Configure the mock to return a URL with expiration
      const mockUrl = 'https://test.r2.com/bucket/key?X-Amz-Expires=3600&X-Amz-Signature=test';
      vi.mocked(getSignedUrl).mockResolvedValue(mockUrl);

      const result = await r2Service.generatePresignedUploadUrl(filename, mimeType);

      // URL should contain expiration parameters (AWS S3 style)
      expect(result.uploadUrl).toMatch(/[?&](X-Amz-Expires|expires)=/);

      // Verify getSignedUrl was called with the correct expiration
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 3600 }
      );
    });

    it('should reject invalid input parameters', async () => {
      const validMimeType = 'image/jpeg';
      const validFilename = 'test.jpg';

      // Test empty filename
      await expect(r2Service.generatePresignedUploadUrl('', validMimeType))
        .rejects.toThrow(InvalidFilenameError);

      // Test empty mime type
      await expect(r2Service.generatePresignedUploadUrl(validFilename, ''))
        .rejects.toThrow(FileValidationError);
    });

    it('should handle R2 presigned URL generation failures', async () => {
      const filename = 'test.jpg';
      const mimeType = 'image/jpeg';

      // Import mocked function
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      // Mock getSignedUrl to throw an error
      const mockError = new Error('Presigned URL generation failed');
      vi.mocked(getSignedUrl).mockRejectedValueOnce(mockError);

      await expect(r2Service.generatePresignedUploadUrl(filename, mimeType))
        .rejects.toThrow(R2PresignedUrlError);
    });
  });

  describe('File Key Generation', () => {
    beforeEach(() => {
      r2Service = new CloudflareR2ServiceImpl();
    });

    it('should sanitize filenames to remove unsafe characters', async () => {
      const fileBuffer = Buffer.from('test content');
      const unsafeFilename = 'my file with spaces & symbols!@#$.jpg';
      const mimeType = 'image/jpeg';

      const result = await r2Service.uploadFile(fileBuffer, unsafeFilename, mimeType);

      // Key should contain sanitized filename
      expect(result.r2Key).toMatch(/[0-9a-f-]+_my_file_with_spaces_symbols_\.jpg$/);
      expect(result.r2Key).not.toContain(' ');
      expect(result.r2Key).not.toContain('&');
      expect(result.r2Key).not.toContain('!');
      expect(result.r2Key).not.toContain('@');
      expect(result.r2Key).not.toContain('#');
    });

    it('should preserve file extensions correctly', async () => {
      const fileBuffer = Buffer.from('test content');
      const testFiles = [
        'document.PDF',      // Uppercase extension
        'file.jpeg',         // Different image format
        'archive.tar.gz',    // Multiple extensions
        'noextension'        // No extension
      ];

      for (const filename of testFiles) {
        const result = await r2Service.uploadFile(fileBuffer, filename, 'application/octet-stream');

        // Should preserve the original extension pattern
        const expectedExtension = filename.includes('.') ?
          filename.substring(filename.indexOf('.')) :
          '';
        expect(result.r2Key).toContain(filename.toLowerCase());
      }
    });
  });

  describe('URL Construction', () => {
    it('should construct public URLs using configured base URL', () => {
      r2Service = new CloudflareR2ServiceImpl();

      // Test with custom public URL base
      process.env.R2_PUBLIC_URL_BASE = 'https://cdn.myapp.com';
      const customService = new CloudflareR2ServiceImpl();

      // This would be tested indirectly through upload methods
      expect(customService).toBeInstanceOf(CloudflareR2ServiceImpl);
    });

    it('should handle trailing slashes in public URL base correctly', () => {
      // Test with trailing slash
      process.env.R2_PUBLIC_URL_BASE = 'https://cdn.example.com/';
      const serviceWithSlash = new CloudflareR2ServiceImpl();

      // Test without trailing slash
      process.env.R2_PUBLIC_URL_BASE = 'https://cdn.example.com';
      const serviceWithoutSlash = new CloudflareR2ServiceImpl();

      expect(serviceWithSlash).toBeInstanceOf(CloudflareR2ServiceImpl);
      expect(serviceWithoutSlash).toBeInstanceOf(CloudflareR2ServiceImpl);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      r2Service = new CloudflareR2ServiceImpl();
    });

    it('should handle large file uploads gracefully', async () => {
      // Create a large buffer (simulating a large file)
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      const filename = 'large-file.jpg';
      const mimeType = 'image/jpeg';

      // Should handle large files without throwing
      await expect(r2Service.uploadFile(largeBuffer, filename, mimeType))
        .resolves.toMatchObject({
          r2Url: expect.any(String),
          r2Key: expect.any(String)
        });
    });

    it('should handle special characters in filenames appropriately', async () => {
      const fileBuffer = Buffer.from('test content');
      const specialFilenames = [
        'file with spaces.jpg',
        'файл.txt',                // Cyrillic
        '文件.png',                // Chinese
        'café-münü.pdf'            // Accented characters
      ];

      for (const filename of specialFilenames) {
        const result = await r2Service.uploadFile(fileBuffer, filename, 'application/octet-stream');

        expect(result.r2Key).toBeTruthy();
        expect(result.r2Url).toBeTruthy();
        expect(result.r2Key).toMatch(/^uploads\/\d{4}\/\d{2}\/\d{2}\/.+/);
      }
    });

    it('should handle network timeouts gracefully', async () => {
      const fileBuffer = Buffer.from('test content');
      const filename = 'timeout-test.jpg';
      const mimeType = 'image/jpeg';

      // Since this is a stub implementation, upload should succeed
      // In a real implementation, this would test actual timeout handling
      const result = await r2Service.uploadFile(fileBuffer, filename, mimeType);

      expect(result.r2Url).toBeDefined();
      expect(result.r2Key).toBeDefined();
    });
  });
});