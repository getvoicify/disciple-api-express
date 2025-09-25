import type { MediaRepository } from './repository';
import type { CloudflareR2Service } from './cloudflare-r2-service';
import type { CreateMediaInput, Media } from './schemas';
import { FileSizeExceededError, UnsupportedFileTypeError, FileValidationError } from './errors';

export interface FileUpload {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
}

export interface UploadResult {
  success: boolean;
  media?: Media;
  error?: string;
}

export class MediaUploadService {
  constructor(
    private mediaRepository: MediaRepository,
    private r2Service: CloudflareR2Service
  ) {}

  async uploadFile(file: FileUpload, uploadedBy: string): Promise<UploadResult> {
    try {
      // Validate file
      this.validateFile(file);

      // Upload to R2
      const { r2Url, r2Key } = await this.r2Service.uploadFile(
        file.buffer,
        file.originalFilename,
        file.mimeType
      );

      // Create database record
      const mediaInput: CreateMediaInput = {
        filename: file.originalFilename,
        originalFilename: file.originalFilename,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        r2Url,
        r2Key
      };

      const media = await this.mediaRepository.create(mediaInput, uploadedBy);

      return {
        success: true,
        media
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private validateFile(file: FileUpload): void {
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const ALLOWED_MIME_TYPES = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'audio/mpeg'
    ];

    if (file.fileSize > MAX_FILE_SIZE) {
      throw new FileSizeExceededError(MAX_FILE_SIZE, file.fileSize, file.originalFilename);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
      throw new UnsupportedFileTypeError(file.mimeType, ALLOWED_MIME_TYPES, file.originalFilename);
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new FileValidationError('File buffer is empty', file.originalFilename);
    }

    if (!file.originalFilename || file.originalFilename.trim() === '') {
      throw new FileValidationError('Filename is required');
    }
  }
}