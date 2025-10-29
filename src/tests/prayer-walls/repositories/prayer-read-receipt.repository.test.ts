import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../../utils/database';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';
import { PrayerReadReceiptRepository } from '../../../prayer-walls/repositories/prayer-read-receipt.repository';

describe('PrayerReadReceiptRepository', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  let repository: PrayerReadReceiptRepository;
  let testChurchId: string;
  let testUserId: string;
  let testUser2Id: string;
  let testUser3Id: string;
  let testPrayerWallId: string;
  let testPrayerRequestId: string;
  let testPrayerRequest2Id: string;

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

    // Run prerequisite migrations (001-013) in order
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

    // Initialize repository
    repository = new PrayerReadReceiptRepository(db);

    // Create test users
    testUserId = '00000000-0000-0000-0000-000000000001';
    testUser2Id = '00000000-0000-0000-0000-000000000002';
    testUser3Id = '00000000-0000-0000-0000-000000000003';

    // Create test church
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

    // Create test prayer wall
    const [wallError, wallResult] = await safeExecute(
      db`
        INSERT INTO prayer_walls (church_id, name, created_by)
        VALUES (
          ${testChurchId}::uuid,
          'Test Prayer Wall',
          ${testUserId}::uuid
        )
        RETURNING id
      `
    );

    if (wallError) {
      logger.error({ error: wallError }, 'Failed to create test prayer wall');
      throw wallError;
    }

    testPrayerWallId = wallResult![0].id;

    // Create test prayer requests
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testPrayerWallId}::uuid,
          ${testUserId}::uuid,
          'Please pray for my family'
        )
        RETURNING id
      `
    );

    if (requestError) {
      logger.error({ error: requestError }, 'Failed to create test prayer request');
      throw requestError;
    }

    testPrayerRequestId = requestResult![0].id;

    // Create second prayer request
    const [request2Error, request2Result] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testPrayerWallId}::uuid,
          ${testUser2Id}::uuid,
          'Please pray for healing'
        )
        RETURNING id
      `
    );

    if (request2Error) {
      logger.error({ error: request2Error }, 'Failed to create second test prayer request');
      throw request2Error;
    }

    testPrayerRequest2Id = request2Result![0].id;

    logger.info(
      {
        testChurchId,
        testUserId,
        testUser2Id,
        testUser3Id,
        testPrayerWallId,
        testPrayerRequestId,
        testPrayerRequest2Id,
      },
      'Test data initialized'
    );
  }, 120000); // Increase timeout for container startup and migrations

  afterAll(async () => {
    // Clean up database connection and container
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

  it('should mark prayer as read and create receipt with timestamps', async () => {
    const [error, receipt] = await safeExecute(
      repository.markAsRead(testPrayerRequestId, testUserId)
    );

    expect(error).toBeUndefined();
    expect(receipt).toBeDefined();
    expect(receipt!.id).toBeDefined();
    expect(receipt!.prayer_request_id).toBe(testPrayerRequestId);
    expect(receipt!.user_id).toBe(testUserId);
    expect(receipt!.read_at).toBeInstanceOf(Date);
    expect(receipt!.created_at).toBeInstanceOf(Date);
    expect(receipt!.read_at.getTime()).toBeLessThanOrEqual(Date.now());
    expect(receipt!.created_at.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should be idempotent when marking as read multiple times', async () => {
    // Mark as read first time
    const [error1, receipt1] = await safeExecute(
      repository.markAsRead(testPrayerRequest2Id, testUser2Id)
    );

    expect(error1).toBeUndefined();
    expect(receipt1).toBeDefined();

    const firstReceiptId = receipt1!.id;
    const firstReadAt = receipt1!.read_at;

    // Wait a small amount to ensure timestamp would differ if new record created
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mark as read second time (should be idempotent)
    const [error2, receipt2] = await safeExecute(
      repository.markAsRead(testPrayerRequest2Id, testUser2Id)
    );

    expect(error2).toBeUndefined();
    expect(receipt2).toBeDefined();
    expect(receipt2!.id).toBe(firstReceiptId);
    expect(receipt2!.read_at.getTime()).toBe(firstReadAt.getTime());

    // Verify only one record exists in database
    const [countError, countResult] = await safeExecute(
      db`
        SELECT COUNT(*) as count
        FROM prayer_read_receipts
        WHERE prayer_request_id = ${testPrayerRequest2Id}
        AND user_id = ${testUser2Id}
      `
    );

    expect(countError).toBeUndefined();
    expect(Number(countResult![0].count)).toBe(1);
  });

  it('should get read count for a prayer request with no readers', async () => {
    // Create a new prayer request with no read receipts
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testPrayerWallId}::uuid,
          ${testUserId}::uuid,
          'Unread prayer request'
        )
        RETURNING id
      `
    );

    expect(requestError).toBeUndefined();
    const unreadRequestId = requestResult![0].id;

    const [error, count] = await safeExecute(repository.getReadCount(unreadRequestId));

    expect(error).toBeUndefined();
    expect(count).toBe(0);
  });

  it('should get read count for a prayer request with multiple readers', async () => {
    // Create a new prayer request
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testPrayerWallId}::uuid,
          ${testUserId}::uuid,
          'Prayer request for read count test'
        )
        RETURNING id
      `
    );

    expect(requestError).toBeUndefined();
    const requestId = requestResult![0].id;

    // Mark as read by three different users
    const [error1] = await safeExecute(repository.markAsRead(requestId, testUserId));
    expect(error1).toBeUndefined();

    const [error2] = await safeExecute(repository.markAsRead(requestId, testUser2Id));
    expect(error2).toBeUndefined();

    const [error3] = await safeExecute(repository.markAsRead(requestId, testUser3Id));
    expect(error3).toBeUndefined();

    // Get read count
    const [countError, count] = await safeExecute(repository.getReadCount(requestId));

    expect(countError).toBeUndefined();
    expect(count).toBe(3);
  });

  it('should check hasRead returns true for user who read the prayer', async () => {
    // Create a new prayer request
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testPrayerWallId}::uuid,
          ${testUserId}::uuid,
          'Prayer for hasRead test'
        )
        RETURNING id
      `
    );

    expect(requestError).toBeUndefined();
    const requestId = requestResult![0].id;

    // Mark as read by testUserId
    const [markError] = await safeExecute(repository.markAsRead(requestId, testUserId));
    expect(markError).toBeUndefined();

    // Check hasRead returns true
    const [error, hasRead] = await safeExecute(repository.hasRead(requestId, testUserId));

    expect(error).toBeUndefined();
    expect(hasRead).toBe(true);
  });

  it('should check hasRead returns false for user who has not read the prayer', async () => {
    // Create a new prayer request
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testPrayerWallId}::uuid,
          ${testUserId}::uuid,
          'Prayer for hasRead false test'
        )
        RETURNING id
      `
    );

    expect(requestError).toBeUndefined();
    const requestId = requestResult![0].id;

    // Check hasRead returns false (no read receipt exists)
    const [error, hasRead] = await safeExecute(repository.hasRead(requestId, testUser2Id));

    expect(error).toBeUndefined();
    expect(hasRead).toBe(false);
  });

  it('should find all read receipts for a prayer request', async () => {
    // Create a new prayer request
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testPrayerWallId}::uuid,
          ${testUserId}::uuid,
          'Prayer for findByRequestId test'
        )
        RETURNING id
      `
    );

    expect(requestError).toBeUndefined();
    const requestId = requestResult![0].id;

    // Mark as read by multiple users
    const [error1] = await safeExecute(repository.markAsRead(requestId, testUserId));
    expect(error1).toBeUndefined();

    const [error2] = await safeExecute(repository.markAsRead(requestId, testUser2Id));
    expect(error2).toBeUndefined();

    const [error3] = await safeExecute(repository.markAsRead(requestId, testUser3Id));
    expect(error3).toBeUndefined();

    // Find all receipts
    const [findError, receipts] = await safeExecute(repository.findByRequestId(requestId));

    expect(findError).toBeUndefined();
    expect(receipts).toBeDefined();
    expect(receipts!.length).toBe(3);

    // Verify all receipts have correct prayer_request_id
    receipts!.forEach(receipt => {
      expect(receipt.prayer_request_id).toBe(requestId);
      expect(receipt.id).toBeDefined();
      expect(receipt.user_id).toBeDefined();
      expect(receipt.read_at).toBeInstanceOf(Date);
      expect(receipt.created_at).toBeInstanceOf(Date);
    });

    // Verify all three users are in the receipts
    const userIds = receipts!.map(r => r.user_id);
    expect(userIds).toContain(testUserId);
    expect(userIds).toContain(testUser2Id);
    expect(userIds).toContain(testUser3Id);
  });

  it('should return empty array when finding receipts for prayer with no readers', async () => {
    // Create a new prayer request
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testPrayerWallId}::uuid,
          ${testUserId}::uuid,
          'Prayer with no readers'
        )
        RETURNING id
      `
    );

    expect(requestError).toBeUndefined();
    const requestId = requestResult![0].id;

    // Find receipts (should be empty)
    const [findError, receipts] = await safeExecute(repository.findByRequestId(requestId));

    expect(findError).toBeUndefined();
    expect(receipts).toBeDefined();
    expect(receipts!.length).toBe(0);
  });
});
