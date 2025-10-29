import type { IPrayerAttachmentRepository } from '../repositories/prayer-attachment.repository';
import type { IPrayerRequestRepository } from '../repositories/prayer-request.repository';
import type { IPrayerWallMembershipRepository } from '../repositories/prayer-wall-membership.repository';
import type { CloudflareR2Service } from '../../media/cloudflare-r2-service';
import type { PrayerAttachment } from '../prayer-attachment.entity';
import { logger } from '../../logging';
import { safeExecute } from '../../utils/handle-async';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  FileSizeExceededError,
  UnsupportedFileTypeError,
  FileValidationError,
  InvalidFilenameError,
  R2ConfigurationError
} from '../../media/errors';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  InternalServerError
} from '../../utils/errors';

/**
 * Allowed MIME types for attachments
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Service interface for managing prayer attachments
 */
export interface IPrayerAttachmentService {
  uploadAttachment(
    prayerId: string,
    data: {
      fileBuffer: Buffer;
      fileName: string;
      mimeType: string;
      uploadedBy: string;
    }
  ): Promise<PrayerAttachment>;
  getAttachment(
    attachmentId: string,
    userId: string
  ): Promise<{ attachment: PrayerAttachment; signedUrl: string }>;
  deleteAttachment(attachmentId: string, userId: string): Promise<void>;
  cleanupOrphanedAttachments(): Promise<number>;
}

/**
 * Service for managing prayer attachments with business logic enforcement
 * Handles file validation, storage, and access control
 */
export class PrayerAttachmentService implements IPrayerAttachmentService {
  constructor(
    private readonly attachmentRepository: IPrayerAttachmentRepository,
    private readonly prayerRepository: IPrayerRequestRepository,
    private readonly membershipRepository: IPrayerWallMembershipRepository,
    private readonly r2Service: CloudflareR2Service,
    private readonly s3Client?: S3Client
  ) {}

  /**
   * Validates file before upload
   * @param fileName - Name of the file
   * @param fileBuffer - File buffer data
   * @param mimeType - MIME type of the file
   * @throws {FileValidationError} If file validation fails
   * @throws {FileSizeExceededError} If file size exceeds limit
   * @throws {UnsupportedFileTypeError} If file type is not allowed
   * @private
   */
  private validateFile(fileName: string, fileBuffer: Buffer, mimeType: string): void {
    // 1. File name validation
    if (!fileName || fileName.trim().length === 0) {
      throw new FileValidationError('File name is required');
    }

    // 2. File buffer validation
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new FileValidationError('File buffer is empty', fileName);
    }

    // 3. File size validation
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new FileSizeExceededError(MAX_FILE_SIZE, fileBuffer.length, fileName);
    }

    // 4. File type validation
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new UnsupportedFileTypeError(mimeType, ALLOWED_MIME_TYPES, fileName);
    }
  }

  /**
   * Upload an attachment for a prayer request
   * Validates file size, type, and user permissions
   */
  async uploadAttachment(
    prayerId: string,
    data: {
      fileBuffer: Buffer;
      fileName: string;
      mimeType: string;
      uploadedBy: string;
    }
  ): Promise<PrayerAttachment> {
    const { fileBuffer, fileName, mimeType, uploadedBy } = data;

    // Validate file
    this.validateFile(fileName, fileBuffer, mimeType);

    // Get prayer request to determine wall
    const [prayerError, prayer] = await safeExecute(this.prayerRepository.findById(prayerId));

    if (prayerError) {
      logger.error({ error: prayerError, prayerId }, 'Error fetching prayer request');
      throw new InternalServerError('Failed to fetch prayer request');
    }

    if (!prayer) {
      throw new NotFoundError('Prayer request', prayerId);
    }

    // Check if user is a member of the wall
    const [memberError, isMember] = await safeExecute(
      this.membershipRepository.isMember(prayer.wall_id, uploadedBy)
    );

    if (memberError) {
      logger.error({ error: memberError, wallId: prayer.wall_id, userId: uploadedBy }, 'Error checking membership');
      throw new InternalServerError('Failed to verify wall membership');
    }

    if (!isMember) {
      throw new ForbiddenError('User is not a member of this prayer wall');
    }

    // Sanitize fileName to prevent path traversal
    const sanitizedFileName = fileName
      .replace(/\.\./g, '_')               // Replace .. sequences first
      .replace(/[^a-zA-Z0-9._-]/g, '_')    // Allow only safe characters
      .replace(/^\.+/, '')                 // Remove leading dots
      .replace(/_{2,}/g, '_')              // Replace multiple underscores with single
      .slice(0, 255);                      // Limit length

    if (!sanitizedFileName) {
      throw new InvalidFilenameError(fileName, 'Filename contains only invalid characters');
    }

    // Generate storage key with format: prayer-attachments/{wallId}/{prayerId}/{filename}
    const storageKey = `prayer-attachments/${prayer.wall_id}/${prayerId}/${sanitizedFileName}`;

    // Upload to R2
    const [uploadError, uploadResult] = await safeExecute(
      this.r2Service.uploadFile(fileBuffer, storageKey, mimeType)
    );

    if (uploadError) {
      logger.error({ error: uploadError, fileName, prayerId }, 'Error uploading file to R2');
      throw new InternalServerError('Failed to upload file');
    }

    logger.info({ prayerId, fileName, fileSize: fileBuffer.length }, 'File uploaded to R2');

    // Create attachment record
    const [createError, attachment] = await safeExecute(
      this.attachmentRepository.create({
        prayerRequestId: prayerId,
        fileName,
        fileSize: fileBuffer.length,
        fileType: mimeType,
        storageKey: uploadResult!.r2Key,
        uploadedBy,
      })
    );

    if (createError) {
      logger.error({ error: createError, prayerId }, 'Error creating attachment record');
      // Attempt to clean up uploaded file
      await safeExecute(this.r2Service.deleteFile(uploadResult!.r2Key));
      throw new InternalServerError('Failed to create attachment record');
    }

    logger.info({ attachmentId: attachment!.id, prayerId }, 'Attachment created successfully');

    return attachment!;
  }

  /**
   * Get an attachment and generate a signed URL for download
   * Validates user has access to the wall
   */
  async getAttachment(
    attachmentId: string,
    userId: string
  ): Promise<{ attachment: PrayerAttachment; signedUrl: string }> {
    // Get attachment
    const [attachmentError, attachment] = await safeExecute(
      this.attachmentRepository.findById(attachmentId)
    );

    if (attachmentError) {
      logger.error({ error: attachmentError, attachmentId }, 'Error fetching attachment');
      throw new InternalServerError('Failed to fetch attachment');
    }

    if (!attachment) {
      throw new NotFoundError('Attachment', attachmentId);
    }

    // Get prayer request to determine wall
    const [prayerError, prayer] = await safeExecute(
      this.prayerRepository.findById(attachment.prayerRequestId)
    );

    if (prayerError) {
      logger.error({ error: prayerError, prayerId: attachment.prayerRequestId }, 'Error fetching prayer request');
      throw new InternalServerError('Failed to fetch prayer request');
    }

    if (!prayer) {
      throw new NotFoundError('Prayer request', attachment.prayerRequestId);
    }

    // Check if user is a member of the wall
    const [memberError, isMember] = await safeExecute(
      this.membershipRepository.isMember(prayer.wall_id, userId)
    );

    if (memberError) {
      logger.error({ error: memberError, wallId: prayer.wall_id, userId }, 'Error checking membership');
      throw new InternalServerError('Failed to verify wall membership');
    }

    if (!isMember) {
      throw new ForbiddenError('User is not a member of this prayer wall');
    }

    // Generate signed URL (1 hour expiration)
    let signedUrl: string;

    if (this.s3Client) {
      // Extract bucket from storage key or use environment variable
      const bucket = process.env.R2_BUCKET_NAME;
      if (!bucket) {
        throw new R2ConfigurationError('R2_BUCKET_NAME environment variable');
      }

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: attachment.storageKey,
      });

      const [urlError, url] = await safeExecute(
        getSignedUrl(this.s3Client, command, { expiresIn: 3600 })
      );

      if (urlError) {
        logger.error({ error: urlError, attachmentId }, 'Error generating signed URL');
        throw new InternalServerError('Failed to generate signed URL');
      }

      signedUrl = url!;
    } else {
      // Fallback to R2 service presigned URL generation for downloads
      const [urlError, result] = await safeExecute(
        this.r2Service.generatePresignedDownloadUrl(attachment.storageKey, 3600)
      );

      if (urlError) {
        logger.error({ error: urlError, attachmentId }, 'Error generating signed URL');
        throw new InternalServerError('Failed to generate signed URL');
      }

      signedUrl = result!.downloadUrl;
    }

    logger.info({ attachmentId, userId }, 'Generated signed URL for attachment');

    return { attachment, signedUrl };
  }

  /**
   * Delete an attachment
   * Validates user is the uploader or a wall admin
   */
  async deleteAttachment(attachmentId: string, userId: string): Promise<void> {
    // Get attachment
    const [attachmentError, attachment] = await safeExecute(
      this.attachmentRepository.findById(attachmentId)
    );

    if (attachmentError) {
      logger.error({ error: attachmentError, attachmentId }, 'Error fetching attachment');
      throw new InternalServerError('Failed to fetch attachment');
    }

    if (!attachment) {
      throw new NotFoundError('Attachment', attachmentId);
    }

    // Check if user is the uploader
    if (attachment.uploadedBy !== userId) {
      // TODO: Add check for wall admin/moderator permissions
      throw new ForbiddenError('Only the uploader can delete this attachment');
    }

    // Delete from R2
    const [deleteError] = await safeExecute(this.r2Service.deleteFile(attachment.storageKey));

    if (deleteError) {
      logger.error({ error: deleteError, attachmentId, storageKey: attachment.storageKey }, 'Error deleting file from R2');
      throw new InternalServerError('Failed to delete file from storage');
    }

    // Soft delete attachment record
    const [dbDeleteError] = await safeExecute(this.attachmentRepository.delete(attachmentId));

    if (dbDeleteError) {
      logger.error({ error: dbDeleteError, attachmentId }, 'Error deleting attachment record');
      throw new InternalServerError('Failed to delete attachment record');
    }

    logger.info({ attachmentId, userId }, 'Attachment deleted successfully');
  }

  /**
   * Cleanup orphaned attachments (attached to prayers deleted more than 24 hours ago)
   * Returns count of cleaned up attachments
   */
  async cleanupOrphanedAttachments(): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [findError, orphanedAttachments] = await safeExecute(
      this.attachmentRepository.findOrphanedAttachments(twentyFourHoursAgo)
    );

    if (findError) {
      logger.error({ error: findError }, 'Error finding orphaned attachments');
      throw new InternalServerError('Failed to find orphaned attachments');
    }

    if (!orphanedAttachments || orphanedAttachments.length === 0) {
      logger.info('No orphaned attachments found');
      return 0;
    }

    logger.info({ count: orphanedAttachments.length }, 'Found orphaned attachments');

    let deletedCount = 0;

    for (const attachment of orphanedAttachments) {
      // Delete from R2
      const [deleteError] = await safeExecute(this.r2Service.deleteFile(attachment.storageKey));

      if (deleteError) {
        logger.warn({ error: deleteError, attachmentId: attachment.id, storageKey: attachment.storageKey }, 'Failed to delete orphaned file from R2');
        continue;
      }

      // Soft delete attachment record
      const [dbDeleteError] = await safeExecute(this.attachmentRepository.delete(attachment.id));

      if (dbDeleteError) {
        logger.warn({ error: dbDeleteError, attachmentId: attachment.id }, 'Failed to delete orphaned attachment record');
        continue;
      }

      deletedCount++;
    }

    logger.info({ deletedCount, totalFound: orphanedAttachments.length }, 'Cleaned up orphaned attachments');

    return deletedCount;
  }
}
