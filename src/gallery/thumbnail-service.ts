import type { Media } from '../media/schemas';
import type { CloudflareR2Service } from '../media/cloudflare-r2-service';
import type { MediaRepository } from '../media/repository';
import type { HttpClient } from '../utils/http-client';
import type { ThumbnailGenerator } from './thumbnail-generator';
import { safeExecute } from '../utils/handle-async';
import {
  ThumbnailGenerationError,
  UnsupportedMediaTypeError,
  ImageFetchError,
  ThumbnailUploadError,
  ThumbnailMetadataSaveError
} from './errors';

export interface ThumbnailService {
  generateThumbnail(media: Media): Promise<Media>;
}

export const ThumbnailService = {
  name: 'ThumbnailService',
  methods: ['generateThumbnail']
} as const;

export class ThumbnailServiceImpl implements ThumbnailService {
  private static readonly THUMBNAIL_WIDTH = 300;
  private static readonly THUMBNAIL_HEIGHT = 300;
  private static readonly THUMBNAIL_QUALITY = 80;
  private static readonly SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff'];
  private static readonly SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

  constructor(
    private readonly r2Service: CloudflareR2Service,
    private readonly mediaRepository: MediaRepository,
    private readonly httpClient: HttpClient,
    private readonly thumbnailGenerator: ThumbnailGenerator
  ) {}

  async generateThumbnail(media: Media): Promise<Media> {
    this.validateMediaType(media.mimeType);

    if (this.isImageType(media.mimeType)) {
      return this.generateImageThumbnail(media);
    } else {
      return this.generateVideoThumbnail(media);
    }
  }

  private validateMediaType(mimeType: string): void {
    const allSupportedTypes = [
      ...ThumbnailServiceImpl.SUPPORTED_IMAGE_TYPES,
      ...ThumbnailServiceImpl.SUPPORTED_VIDEO_TYPES
    ];

    if (!allSupportedTypes.includes(mimeType)) {
      throw new UnsupportedMediaTypeError(mimeType, allSupportedTypes);
    }
  }

  private isImageType(mimeType: string): boolean {
    return ThumbnailServiceImpl.SUPPORTED_IMAGE_TYPES.includes(mimeType);
  }

  private async generateImageThumbnail(media: Media): Promise<Media> {
    const [fetchError, imageBuffer] = await safeExecute(
      this.httpClient.fetchAsBuffer(media.r2Url)
    );

    if (fetchError) {
      throw new ImageFetchError(media.r2Url, fetchError.message, fetchError);
    }

    const thumbnailBuffer = await this.resizeImage(imageBuffer!, media.id);
    const thumbnailFilename = this.generateThumbnailFilename(media.filename);

    return this.uploadAndSaveThumbnail(
      thumbnailBuffer,
      thumbnailFilename,
      media.uploadedBy
    );
  }

  private async generateVideoThumbnail(media: Media): Promise<Media> {
    const placeholderBuffer = await this.createVideoPlaceholder(media.id);
    const thumbnailFilename = this.generateThumbnailFilename(media.filename, 'jpg');

    return this.uploadAndSaveThumbnail(
      placeholderBuffer,
      thumbnailFilename,
      media.uploadedBy
    );
  }

  private async resizeImage(imageBuffer: Buffer, mediaId: string): Promise<Buffer> {
    const config = {
      width: ThumbnailServiceImpl.THUMBNAIL_WIDTH,
      height: ThumbnailServiceImpl.THUMBNAIL_HEIGHT,
      quality: ThumbnailServiceImpl.THUMBNAIL_QUALITY,
      fit: 'cover' as const,
      position: 'center' as const
    };

    const [resizeError, thumbnailBuffer] = await safeExecute(
      this.thumbnailGenerator.generateFromImage(imageBuffer, config)
    );

    if (resizeError) {
      throw new ThumbnailGenerationError(mediaId, `Image resize failed: ${resizeError.message}`, resizeError);
    }

    return thumbnailBuffer!;
  }

  private async createVideoPlaceholder(mediaId: string): Promise<Buffer> {
    const config = {
      width: ThumbnailServiceImpl.THUMBNAIL_WIDTH,
      height: ThumbnailServiceImpl.THUMBNAIL_HEIGHT,
      quality: ThumbnailServiceImpl.THUMBNAIL_QUALITY
    };

    const [placeholderError, placeholderBuffer] = await safeExecute(
      this.thumbnailGenerator.generateVideoPlaceholder(config)
    );

    if (placeholderError) {
      throw new ThumbnailGenerationError(
        mediaId,
        `Failed to create video placeholder: ${placeholderError.message}`,
        placeholderError
      );
    }

    return placeholderBuffer!;
  }

  private async uploadAndSaveThumbnail(
    thumbnailBuffer: Buffer,
    filename: string,
    uploadedBy: string
  ): Promise<Media> {
    const uploadResult = await this.uploadThumbnail(thumbnailBuffer, filename);
    return this.saveThumbnailMetadata(
      filename,
      thumbnailBuffer.length,
      uploadResult.r2Url,
      uploadResult.r2Key,
      uploadedBy
    );
  }

  private async uploadThumbnail(
    buffer: Buffer,
    filename: string
  ): Promise<{ r2Url: string; r2Key: string }> {
    const [uploadError, uploadResult] = await safeExecute(
      this.r2Service.uploadFile(buffer, filename, 'image/jpeg')
    );

    if (uploadError) {
      throw new ThumbnailUploadError(filename, uploadError.message, uploadError);
    }

    return uploadResult!;
  }

  private async saveThumbnailMetadata(
    filename: string,
    fileSize: number,
    r2Url: string,
    r2Key: string,
    uploadedBy: string
  ): Promise<Media> {
    const [createError, thumbnailMedia] = await safeExecute(
      this.mediaRepository.create(
        {
          filename,
          originalFilename: filename,
          mimeType: 'image/jpeg',
          fileSize,
          r2Url,
          r2Key
        },
        uploadedBy
      )
    );

    if (createError) {
      throw new ThumbnailMetadataSaveError(filename, createError.message, createError);
    }

    return thumbnailMedia!;
  }

  private generateThumbnailFilename(originalFilename: string, extension = 'jpg'): string {
    const nameParts = originalFilename.split('.');
    const baseName = nameParts.slice(0, -1).join('.');
    return `${baseName}_thumb.${extension}`;
  }
}
