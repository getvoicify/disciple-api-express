import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../utils/database';
import { safeExecute } from '../../utils/handle-async';
import { logger } from '../../logging';
import { PrayerAttachmentRepository } from '../../prayer-walls/repositories/prayer-attachment.repository';
import { PrayerRequestRepository } from '../../prayer-walls/repositories/prayer-request.repository';
import { PrayerWallMembershipRepository } from '../../prayer-walls/repositories/prayer-wall-membership.repository';
import { PrayerAttachmentService } from '../../prayer-walls/services/prayer-attachment.service';
import { randomUUID } from 'crypto';
import { vi } from 'vitest';

/**
 * Test Suite: Prayer Request Attachment Tests (Task Group 20)
 *
 * Tests file attachment functionality for the Prayer Wall Foundation feature.
 * Covers:
 * - Valid file type uploads (JPEG, PNG, PDF, DOCX)
 * - 10MB file size limit enforcement
 * - File type validation (allowed vs disallowed types)
 * - Attachment linking to prayer requests
 * - Signed URL generation for downloads
 * - User authorization (wall membership verification)
 * - Storage key format validation
 * - Orphaned attachment cleanup (prayers deleted >24hrs)
 */
describe('Prayer Attachment Tests', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  let attachmentService: PrayerAttachmentService;
  let testChurchId: string;
  let testUserId: string;
  let testUserId2: string;
  let testWallId: string;
  let testPrayerId: string;
  let mockR2Service: any;

  beforeAll(async () => {
    // Start PostgreSQL container
    const [containerError, startedContainer] = await safeExecute(
      new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('test_db')
        .withUsername('test_user')
        .withPassword('test_password')
        .start()
    );

    if (containerError) {
      logger.error({ error: containerError }, 'Failed to start PostgreSQL container');
      throw containerError;
    }

    container = startedContainer!;

    // Initialize database connection
    db = getRawDb({
      DB_NAME: container.getDatabase(),
      DB_USER: container.getUsername(),
      DB_PASSWORD: container.getPassword(),
      DB_HOST: container.getHost(),
      DB_PORT: container.getPort().toString(),
    });

    // Run prerequisite migrations (001-014) in order
    const migrations = [
      '001_create_notes_table.sql',
      '002_create_churches_tables.sql',
      '003_create_outbox_tables.sql',
      '004_create_media_table.sql',
      '005_create_posts_table.sql',
      '006_create_series_table.sql',
      '007_create_gallery_tables.sql',
      '008_create_prayer_walls.sql',
      '009_create_prayer_requests.sql',
      '010_create_prayer_categories.sql',
      '011_create_supporting_tables.sql',
      '012_add_indexes.sql',
      '013_seed_system_categories.sql',
      '014_add_deleted_at_to_prayer_attachments.sql',
    ];

    for (const migration of migrations) {
      const migrationFilePath = join(process.cwd(), 'migrations', migration);
      const [readError, migrationSQL] = await safeExecute(() =>
        readFileSync(migrationFilePath, 'utf8')
      );

      if (readError) {
        logger.error({ error: readError, migration }, 'Failed to read migration');
        throw readError;
      }

      const [execError] = await safeExecute(db.unsafe(migrationSQL!));

      if (execError) {
        logger.error({ error: execError, migration }, 'Failed to execute migration');
        throw execError;
      }
    }

    logger.info('All migrations executed successfully');

    // Create test data
    testUserId = randomUUID();
    testUserId2 = randomUUID();

    const [churchError, churchResult] = await safeExecute(
      db`
        INSERT INTO churches (id, slug, name, created_by)
        VALUES (
          gen_random_uuid(),
          'test-church',
          'Test Church',
          ${testUserId}::uuid
        )
        RETURNING id
      `
    );

    if (churchError) {
      logger.error({ error: churchError }, 'Failed to create test church');
      throw churchError;
    }

    testChurchId = churchResult![0].id;

    const [wallError, wallResult] = await safeExecute(
      db`
        INSERT INTO prayer_walls (id, church_id, name, created_by, is_private, has_restricted_access, status)
        VALUES (
          gen_random_uuid(),
          ${testChurchId}::uuid,
          'Test Prayer Wall',
          ${testUserId}::uuid,
          false,
          false,
          'active'
        )
        RETURNING id
      `
    );

    if (wallError) {
      logger.error({ error: wallError }, 'Failed to create test prayer wall');
      throw wallError;
    }

    testWallId = wallResult![0].id;

    // Add testUserId as a member of the wall
    const [memberError] = await safeExecute(
      db`
        INSERT INTO prayer_wall_memberships (wall_id, user_id, joined_at)
        VALUES (
          ${testWallId}::uuid,
          ${testUserId}::uuid,
          NOW()
        )
      `
    );

    if (memberError) {
      logger.error({ error: memberError }, 'Failed to add user as wall member');
      throw memberError;
    }

    const [prayerError, prayerResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (id, wall_id, author_id, content)
        VALUES (
          gen_random_uuid(),
          ${testWallId}::uuid,
          ${testUserId}::uuid,
          'Test prayer request for attachments'
        )
        RETURNING id
      `
    );

    if (prayerError) {
      logger.error({ error: prayerError }, 'Failed to create test prayer request');
      throw prayerError;
    }

    testPrayerId = prayerResult![0].id;

    // Mock R2 service
    mockR2Service = {
      uploadFile: vi.fn().mockImplementation((buffer: Buffer, key: string, mimeType: string) => {
        return Promise.resolve({
          r2Url: `https://media.example.com/${key}`,
          r2Key: key,
        });
      }),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      generatePresignedUploadUrl: vi.fn().mockImplementation((fileName: string, mimeType: string) => {
        return Promise.resolve({
          uploadUrl: `https://media.example.com/presigned-upload-url?file=${fileName}`,
          r2Key: `prayer-attachments/${testWallId}/${testPrayerId}/${fileName}`,
        });
      }),
      generatePresignedDownloadUrl: vi.fn().mockImplementation((r2Key: string, expiresIn: number) => {
        return Promise.resolve({
          downloadUrl: `https://media.example.com/presigned-download-url?key=${r2Key}&expires=${expiresIn}`,
        });
      }),
    };

    // Initialize service with repositories
    const attachmentRepository = new PrayerAttachmentRepository(db);
    const prayerRepository = new PrayerRequestRepository(db);
    const membershipRepository = new PrayerWallMembershipRepository(db);

    attachmentService = new PrayerAttachmentService(
      attachmentRepository,
      prayerRepository,
      membershipRepository,
      mockR2Service
    );

    logger.info({ testChurchId, testUserId, testWallId, testPrayerId }, 'Test data initialized');
  }, 120000);

  afterAll(async () => {
    if (db) {
      const [closeError] = await safeExecute(db.end());
      if (closeError) {
        logger.warn({ error: closeError }, 'Error closing database connection');
      }
    }

    if (container) {
      const [stopError] = await safeExecute(container.stop());
      if (stopError) {
        logger.warn({ error: stopError }, 'Error stopping container');
      }
    }
  }, 30000);

  it('should upload valid file types (JPEG image) and create attachment record', async () => {
    // Create a mock file buffer (JPEG image)
    const fileBuffer = Buffer.from('fake-jpeg-image-data');
    const fileName = 'prayer-image.jpg';
    const mimeType = 'image/jpeg';

    // Upload file using service
    const [uploadError, attachment] = await safeExecute(
      attachmentService.uploadAttachment(testPrayerId, {
        fileBuffer,
        fileName,
        mimeType,
        uploadedBy: testUserId,
      })
    );

    expect(uploadError).toBeUndefined();
    expect(attachment).toBeDefined();
    expect(attachment!.fileName).toBe(fileName);
    expect(attachment!.fileSize).toBe(fileBuffer.length);
    expect(attachment!.fileType).toBe(mimeType);
    expect(attachment!.storageKey).toContain('prayer-attachments');
    expect(attachment!.storageKey).toContain(testWallId);
    expect(attachment!.storageKey).toContain(testPrayerId);
    expect(attachment!.uploadedBy).toBe(testUserId);
    expect(attachment!.prayerRequestId).toBe(testPrayerId);
    expect(attachment!.createdAt).toBeInstanceOf(Date);
  });

  it('should upload valid file types (PNG image, PDF document)', async () => {
    const testCases = [
      { fileName: 'screenshot.png', mimeType: 'image/png', data: 'fake-png-data' },
      { fileName: 'document.pdf', mimeType: 'application/pdf', data: 'fake-pdf-data' },
      { fileName: 'report.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: 'fake-docx-data' },
    ];

    for (const testCase of testCases) {
      const fileBuffer = Buffer.from(testCase.data);
      const [uploadError, attachment] = await safeExecute(
        attachmentService.uploadAttachment(testPrayerId, {
          fileBuffer,
          fileName: testCase.fileName,
          mimeType: testCase.mimeType,
          uploadedBy: testUserId,
        })
      );

      expect(uploadError).toBeUndefined();
      expect(attachment).toBeDefined();
      expect(attachment!.fileName).toBe(testCase.fileName);
      expect(attachment!.fileType).toBe(testCase.mimeType);
      expect(attachment!.storageKey).toContain('prayer-attachments');
    }
  });

  it('should enforce 10MB file size limit and reject larger files', async () => {
    const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
    const oversizedBuffer = Buffer.alloc(maxFileSize + 1); // 10MB + 1 byte
    const fileName = 'oversized-file.jpg';
    const mimeType = 'image/jpeg';

    // Attempt to upload oversized file
    const [uploadError, attachment] = await safeExecute(
      attachmentService.uploadAttachment(testPrayerId, {
        fileBuffer: oversizedBuffer,
        fileName,
        mimeType,
        uploadedBy: testUserId,
      })
    );

    expect(uploadError).toBeDefined();
    expect(uploadError!.message).toMatch(/10\.\d{2}MB/); // Match 10.xxMB format
    expect(uploadError!.message).toContain('exceeds maximum allowed size');
    expect(attachment).toBeUndefined();

    // Valid file at exactly 10MB should pass
    const validBuffer = Buffer.alloc(maxFileSize);
    const [validError, validAttachment] = await safeExecute(
      attachmentService.uploadAttachment(testPrayerId, {
        fileBuffer: validBuffer,
        fileName: 'valid-file.jpg',
        mimeType: 'image/jpeg',
        uploadedBy: testUserId,
      })
    );

    expect(validError).toBeUndefined();
    expect(validAttachment).toBeDefined();

    // Valid file under 10MB should pass
    const smallBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB
    const [smallError, smallAttachment] = await safeExecute(
      attachmentService.uploadAttachment(testPrayerId, {
        fileBuffer: smallBuffer,
        fileName: 'small-file.jpg',
        mimeType: 'image/jpeg',
        uploadedBy: testUserId,
      })
    );

    expect(smallError).toBeUndefined();
    expect(smallAttachment).toBeDefined();
  });

  it('should validate allowed file types and reject disallowed types', async () => {
    const disallowedMimeTypes = [
      'application/x-executable',
      'application/x-msdownload',
      'application/x-sh',
      'text/html',
      'application/javascript',
    ];

    // Test disallowed types fail validation
    for (const mimeType of disallowedMimeTypes) {
      const fileBuffer = Buffer.from('test-data');
      const [uploadError, attachment] = await safeExecute(
        attachmentService.uploadAttachment(testPrayerId, {
          fileBuffer,
          fileName: 'test-file',
          mimeType,
          uploadedBy: testUserId,
        })
      );

      expect(uploadError).toBeDefined();
      expect(uploadError!.message).toContain('Unsupported file type');
      expect(attachment).toBeUndefined();
    }

    // Test allowed types pass validation
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'application/pdf',
    ];

    for (const mimeType of allowedMimeTypes) {
      const fileBuffer = Buffer.from('test-data');
      const [uploadError, attachment] = await safeExecute(
        attachmentService.uploadAttachment(testPrayerId, {
          fileBuffer,
          fileName: 'test-file',
          mimeType,
          uploadedBy: testUserId,
        })
      );

      expect(uploadError).toBeUndefined();
      expect(attachment).toBeDefined();
    }
  });

  it('should link attachment to prayer request and verify association', async () => {
    const fileBuffer = Buffer.from('attachment-data');
    const fileName = 'linked-attachment.jpg';
    const mimeType = 'image/jpeg';

    // Upload file using service
    const [uploadError, attachment] = await safeExecute(
      attachmentService.uploadAttachment(testPrayerId, {
        fileBuffer,
        fileName,
        mimeType,
        uploadedBy: testUserId,
      })
    );

    expect(uploadError).toBeUndefined();
    expect(attachment).toBeDefined();
    expect(attachment!.prayerRequestId).toBe(testPrayerId);

    // Verify attachment can be queried by prayer_request_id
    const [queryError, attachments] = await safeExecute(
      db`
        SELECT id, prayer_request_id, file_name, storage_key
        FROM prayer_attachments
        WHERE prayer_request_id = ${testPrayerId}::uuid
          AND deleted_at IS NULL
      `
    );

    expect(queryError).toBeUndefined();
    expect(attachments).toBeDefined();
    expect((attachments as any[])!.length).toBeGreaterThan(0);

    const linkedAttachment = (attachments as any[])!.find(a => a.id === attachment!.id);
    expect(linkedAttachment).toBeDefined();
    expect(linkedAttachment!.prayer_request_id).toBe(testPrayerId);
    expect(linkedAttachment!.file_name).toBe(fileName);
  });

  it('should generate signed URL for download with proper expiration', async () => {
    // Upload a file first
    const fileBuffer = Buffer.from('download-test-data');
    const fileName = 'download-test.pdf';
    const mimeType = 'application/pdf';

    const [uploadError, attachment] = await safeExecute(
      attachmentService.uploadAttachment(testPrayerId, {
        fileBuffer,
        fileName,
        mimeType,
        uploadedBy: testUserId,
      })
    );

    expect(uploadError).toBeUndefined();
    expect(attachment).toBeDefined();

    // Get attachment with signed URL
    const [getError, result] = await safeExecute(
      attachmentService.getAttachment(attachment!.id, testUserId)
    );

    expect(getError).toBeUndefined();
    expect(result).toBeDefined();
    expect(result!.attachment).toBeDefined();
    expect(result!.signedUrl).toBeTruthy();
    expect(result!.signedUrl.startsWith('https://')).toBe(true);
  });

  it('should verify user authorization for attachment access (wall membership)', async () => {
    // Upload a file
    const fileBuffer = Buffer.from('restricted-file');
    const fileName = 'restricted.jpg';
    const mimeType = 'image/jpeg';

    const [uploadError, attachment] = await safeExecute(
      attachmentService.uploadAttachment(testPrayerId, {
        fileBuffer,
        fileName,
        mimeType,
        uploadedBy: testUserId,
      })
    );

    expect(uploadError).toBeUndefined();
    expect(attachment).toBeDefined();

    // testUserId is a member, should have access
    const [memberAccessError, memberResult] = await safeExecute(
      attachmentService.getAttachment(attachment!.id, testUserId)
    );

    expect(memberAccessError).toBeUndefined();
    expect(memberResult).toBeDefined();

    // testUserId2 is NOT a member, should be denied
    const [nonMemberError, nonMemberResult] = await safeExecute(
      attachmentService.getAttachment(attachment!.id, testUserId2)
    );

    expect(nonMemberError).toBeDefined();
    expect(nonMemberError!.message).toContain('member');
    expect(nonMemberResult).toBeUndefined();
  });

  it('should follow storage key format: prayer-attachments/{wallId}/{prayerId}/{filename}', async () => {
    const fileName = 'format-test.jpg';
    const mimeType = 'image/jpeg';
    const fileBuffer = Buffer.from('test-data');

    // Upload file using service
    const [uploadError, attachment] = await safeExecute(
      attachmentService.uploadAttachment(testPrayerId, {
        fileBuffer,
        fileName,
        mimeType,
        uploadedBy: testUserId,
      })
    );

    expect(uploadError).toBeUndefined();
    expect(attachment).toBeDefined();

    // Verify storage key format
    const storageKey = attachment!.storageKey;
    expect(storageKey).toContain('prayer-attachments');
    expect(storageKey).toContain(testWallId);
    expect(storageKey).toContain(testPrayerId);
    expect(storageKey).toContain(fileName);

    // Verify exact format pattern
    const expectedPattern = new RegExp(`^prayer-attachments/${testWallId}/${testPrayerId}/.+`);
    expect(storageKey).toMatch(expectedPattern);
  });

  it('should sanitize malicious filenames to prevent path traversal attacks', async () => {
    const maliciousFilenames = [
      '../../../malicious.jpg',
      '..\\..\\..\\malicious.jpg',
      '....//....//malicious.jpg',
      '/etc/passwd',
      'C:\\Windows\\System32\\config\\sam',
    ];

    for (const maliciousName of maliciousFilenames) {
      const fileBuffer = Buffer.from('test-data');
      const mimeType = 'image/jpeg';

      const [uploadError, attachment] = await safeExecute(
        attachmentService.uploadAttachment(testPrayerId, {
          fileBuffer,
          fileName: maliciousName,
          mimeType,
          uploadedBy: testUserId,
        })
      );

      expect(uploadError).toBeUndefined();
      expect(attachment).toBeDefined();

      // Verify storage key doesn't contain path traversal sequences
      const storageKey = attachment!.storageKey;
      expect(storageKey).not.toContain('..');
      expect(storageKey).not.toContain('/etc/');
      expect(storageKey).not.toContain('C:\\');
      expect(storageKey).not.toContain('\\');

      // Verify storage key follows expected format
      expect(storageKey).toContain('prayer-attachments');
      expect(storageKey).toContain(testWallId);
      expect(storageKey).toContain(testPrayerId);

      // Verify filename was sanitized (should only contain safe characters)
      const fileName = storageKey.split('/').pop();
      expect(fileName).toMatch(/^[a-zA-Z0-9._-]+$/);
    }
  });

  it('should identify and cleanup unused attachments from deleted prayers after 24 hours', async () => {
    // Create a temporary prayer that is already old
    const [tempPrayerError, tempPrayer] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, created_at)
        VALUES (
          ${testWallId}::uuid,
          ${testUserId}::uuid,
          'Temporary prayer for attachment cleanup test',
          NOW() - INTERVAL '25 hours'
        )
        RETURNING id
      `
    );

    expect(tempPrayerError).toBeUndefined();
    const tempPrayerId = tempPrayer![0].id;

    // Upload an attachment to this prayer
    const orphanedFileName = 'orphaned-file.jpg';
    const mimeType = 'image/jpeg';
    const fileBuffer = Buffer.from('orphaned-data');

    const [uploadError, orphanedAttachment] = await safeExecute(
      attachmentService.uploadAttachment(tempPrayerId, {
        fileBuffer,
        fileName: orphanedFileName,
        mimeType,
        uploadedBy: testUserId,
      })
    );

    expect(uploadError).toBeUndefined();
    expect(orphanedAttachment).toBeDefined();

    // Soft-delete the prayer (making it 25 hours old)
    const [deleteError] = await safeExecute(
      db`
        UPDATE prayer_requests
        SET deleted_at = NOW() - INTERVAL '25 hours',
            deleted_by = ${testUserId}::uuid
        WHERE id = ${tempPrayerId}::uuid
      `
    );

    expect(deleteError).toBeUndefined();

    // Run cleanup using service
    const [cleanupError, deletedCount] = await safeExecute(
      attachmentService.cleanupOrphanedAttachments()
    );

    expect(cleanupError).toBeUndefined();
    expect(deletedCount).toBeGreaterThan(0);

    // Verify attachment was soft-deleted
    const [verifyError, remainingAttachments] = await safeExecute(
      db`
        SELECT id
        FROM prayer_attachments
        WHERE id = ${orphanedAttachment!.id}
          AND deleted_at IS NULL
      `
    );

    expect(verifyError).toBeUndefined();
    expect(remainingAttachments).toBeDefined();
    expect((remainingAttachments as any[])!.length).toBe(0);

    // Verify R2 deleteFile was called
    expect(mockR2Service.deleteFile).toHaveBeenCalledWith(orphanedAttachment!.storageKey);
  });
});
