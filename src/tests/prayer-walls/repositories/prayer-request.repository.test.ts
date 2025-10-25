import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../../utils/database';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';
import { PrayerRequestRepository } from '../../../prayer-walls/repositories/prayer-request.repository';
import { AnonymityLevel } from '../../../prayer-walls/types/prayer-wall.types';
import { randomUUID } from 'crypto';

describe('PrayerRequestRepository', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  let repository: PrayerRequestRepository;
  let testChurchId: string;
  let testUserId: string;
  let testUserId2: string;
  let testWallId: string;

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
    repository = new PrayerRequestRepository(db);

    // Create test church
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

    // Create test prayer wall
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
    logger.info({ testChurchId, testUserId, testWallId }, 'Test data initialized');
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

  it('should create prayer request with valid data and verify timestamps', async () => {
    const createData = {
      wall_id: testWallId,
      author_id: testUserId,
      content: 'Please pray for healing and strength during this difficult time',
      anonymity_level: AnonymityLevel.IDENTIFIED,
      has_attachment: false,
    };

    const [error, prayerRequest] = await safeExecute(repository.create(createData));

    expect(error).toBeUndefined();
    expect(prayerRequest).toBeDefined();
    expect(prayerRequest!.id).toBeDefined();
    expect(prayerRequest!.wall_id).toBe(testWallId);
    expect(prayerRequest!.author_id).toBe(testUserId);
    expect(prayerRequest!.content).toBe('Please pray for healing and strength during this difficult time');
    expect(prayerRequest!.anonymity_level).toBe(AnonymityLevel.IDENTIFIED);
    expect(prayerRequest!.parent_id).toBeNull();
    expect(prayerRequest!.thread_depth).toBe(0);
    expect(prayerRequest!.has_attachment).toBe(false);
    expect(prayerRequest!.created_at).toBeInstanceOf(Date);
    expect(prayerRequest!.updated_at).toBeInstanceOf(Date);
    expect(prayerRequest!.deleted_at).toBeNull();
    expect(prayerRequest!.deleted_by).toBeNull();
  });

  it('should create threaded prayer (reply) with parent_id and verify thread_depth calculation', async () => {
    // Create root prayer request
    const rootData = {
      wall_id: testWallId,
      author_id: testUserId,
      content: 'Praying for guidance in my career decision',
      anonymity_level: AnonymityLevel.IDENTIFIED,
    };

    const [rootError, rootRequest] = await safeExecute(repository.create(rootData));
    expect(rootError).toBeUndefined();
    expect(rootRequest!.thread_depth).toBe(0);

    // Create first-level reply (depth 1)
    const replyData1 = {
      wall_id: testWallId,
      author_id: testUserId2,
      parent_id: rootRequest!.id,
      content: 'I will be praying with you for clarity and wisdom',
      anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
    };

    const [replyError1, reply1] = await safeExecute(repository.create(replyData1));
    expect(replyError1).toBeUndefined();
    expect(reply1).toBeDefined();
    expect(reply1!.parent_id).toBe(rootRequest!.id);
    expect(reply1!.thread_depth).toBe(1);
    expect(reply1!.content).toBe('I will be praying with you for clarity and wisdom');

    // Create second-level reply (depth 2)
    const replyData2 = {
      wall_id: testWallId,
      author_id: testUserId,
      parent_id: reply1!.id,
      content: 'Thank you for your prayers and support',
      anonymity_level: AnonymityLevel.IDENTIFIED,
    };

    const [replyError2, reply2] = await safeExecute(repository.create(replyData2));
    expect(replyError2).toBeUndefined();
    expect(reply2).toBeDefined();
    expect(reply2!.parent_id).toBe(reply1!.id);
    expect(reply2!.thread_depth).toBe(2);

    // Create third-level reply (max depth 3)
    const replyData3 = {
      wall_id: testWallId,
      author_id: testUserId2,
      parent_id: reply2!.id,
      content: 'God is faithful and will guide your path',
      anonymity_level: AnonymityLevel.IDENTIFIED,
    };

    const [replyError3, reply3] = await safeExecute(repository.create(replyData3));
    expect(replyError3).toBeUndefined();
    expect(reply3).toBeDefined();
    expect(reply3!.parent_id).toBe(reply2!.id);
    expect(reply3!.thread_depth).toBe(3);
  });

  it('should validate thread depth limit (max depth 3) and reject depth 4', async () => {
    // Create a chain to reach depth 3
    const root = {
      wall_id: testWallId,
      author_id: testUserId,
      content: 'Root prayer request',
    };

    const [rootError, rootRequest] = await safeExecute(repository.create(root));
    expect(rootError).toBeUndefined();

    // Create depth 1
    const [error1, reply1] = await safeExecute(
      repository.create({
        wall_id: testWallId,
        author_id: testUserId,
        parent_id: rootRequest!.id,
        content: 'Depth 1 reply',
      })
    );
    expect(error1).toBeUndefined();

    // Create depth 2
    const [error2, reply2] = await safeExecute(
      repository.create({
        wall_id: testWallId,
        author_id: testUserId,
        parent_id: reply1!.id,
        content: 'Depth 2 reply',
      })
    );
    expect(error2).toBeUndefined();

    // Create depth 3 (max allowed)
    const [error3, reply3] = await safeExecute(
      repository.create({
        wall_id: testWallId,
        author_id: testUserId,
        parent_id: reply2!.id,
        content: 'Depth 3 reply',
      })
    );
    expect(error3).toBeUndefined();
    expect(reply3!.thread_depth).toBe(3);

    // Validate that we cannot exceed depth 3
    const depthValidation = await safeExecute(
      repository.validateThreadDepth(reply3!.id)
    );
    expect(depthValidation[0]).toBeUndefined();
    expect(depthValidation[1]).toBe(3);

    // Attempt to create depth 4 (should fail validation)
    const [error4, reply4] = await safeExecute(
      repository.create({
        wall_id: testWallId,
        author_id: testUserId,
        parent_id: reply3!.id,
        content: 'Depth 4 reply - should fail',
      })
    );

    // Expect error due to depth limit
    expect(error4).toBeDefined();
    expect(reply4).toBeUndefined();
  });

  it('should find prayer requests by wall_id with cursor-based pagination', async () => {
    // Create a fresh prayer wall for this test
    const [wallError, wallResult] = await safeExecute(
      db`
        INSERT INTO prayer_walls (church_id, name, created_by)
        VALUES (${testChurchId}::uuid, 'Pagination Test Wall', ${testUserId}::uuid)
        RETURNING id
      `
    );
    expect(wallError).toBeUndefined();
    const paginationWallId = wallResult![0].id;

    // Create multiple prayer requests with slight delays to ensure different timestamps
    const requests = [];
    for (let i = 1; i <= 5; i++) {
      const [error, request] = await safeExecute(
        repository.create({
          wall_id: paginationWallId,
          author_id: testUserId,
          content: `Prayer request ${i} for pagination testing`,
          anonymity_level: AnonymityLevel.IDENTIFIED,
        })
      );
      expect(error).toBeUndefined();
      requests.push(request!);
      // Small delay to ensure different created_at timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Test pagination - get first 2 requests (no cursor)
    const [error1, page1] = await safeExecute(
      repository.findByWallId(paginationWallId, { limit: 2 })
    );
    expect(error1).toBeUndefined();
    expect(page1).toBeDefined();
    expect(page1!.length).toBe(2);
    expect(page1![0].content).toContain('Prayer request');

    // Test pagination - get next 2 requests using cursor
    const cursor = page1![1].id; // Use last ID from first page as cursor
    const [error2, page2] = await safeExecute(
      repository.findByWallId(paginationWallId, { limit: 2, cursor })
    );
    expect(error2).toBeUndefined();
    expect(page2).toBeDefined();
    expect(page2!.length).toBe(2);

    // Verify pages contain different requests
    expect(page1![0].id).not.toBe(page2![0].id);
    expect(page1![1].id).not.toBe(page2![0].id);

    // Test without pagination - get all requests
    const [error3, allRequests] = await safeExecute(
      repository.findByWallId(paginationWallId)
    );
    expect(error3).toBeUndefined();
    expect(allRequests).toBeDefined();
    expect(allRequests!.length).toBe(5);
  });

  it('should find prayer by ID and include thread children using recursive CTE', async () => {
    // Create a prayer with replies
    const rootData = {
      wall_id: testWallId,
      author_id: testUserId,
      content: 'Root prayer for thread test',
      anonymity_level: AnonymityLevel.IDENTIFIED,
    };

    const [rootError, rootRequest] = await safeExecute(repository.create(rootData));
    expect(rootError).toBeUndefined();

    // Create two direct children
    const [childError1, child1] = await safeExecute(
      repository.create({
        wall_id: testWallId,
        author_id: testUserId2,
        parent_id: rootRequest!.id,
        content: 'First reply to root',
      })
    );
    expect(childError1).toBeUndefined();

    const [childError2, child2] = await safeExecute(
      repository.create({
        wall_id: testWallId,
        author_id: testUserId,
        parent_id: rootRequest!.id,
        content: 'Second reply to root',
      })
    );
    expect(childError2).toBeUndefined();

    // Find root by ID
    const [findError, foundRequest] = await safeExecute(
      repository.findById(rootRequest!.id)
    );
    expect(findError).toBeUndefined();
    expect(foundRequest).toBeDefined();
    expect(foundRequest!.id).toBe(rootRequest!.id);
    expect(foundRequest!.content).toBe('Root prayer for thread test');
    expect(foundRequest!.thread_depth).toBe(0);

    // Find thread children
    const [childrenError, children] = await safeExecute(
      repository.findThreadChildren(rootRequest!.id)
    );
    expect(childrenError).toBeUndefined();
    expect(children).toBeDefined();
    expect(children!.length).toBe(2);
    expect(children!.some(c => c.id === child1!.id)).toBe(true);
    expect(children!.some(c => c.id === child2!.id)).toBe(true);
    expect(children!.every(c => c.parent_id === rootRequest!.id)).toBe(true);
    expect(children!.every(c => c.thread_depth === 1)).toBe(true);
  });

  it('should update prayer request content and verify updated_at changes', async () => {
    // Create a prayer request
    const createData = {
      wall_id: testWallId,
      author_id: testUserId,
      content: 'Original prayer content',
      anonymity_level: AnonymityLevel.IDENTIFIED,
    };

    const [createError, createdRequest] = await safeExecute(repository.create(createData));
    expect(createError).toBeUndefined();

    const originalUpdatedAt = createdRequest!.updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update the prayer request content
    const updateData = {
      content: 'Updated prayer content with more details',
      has_attachment: true,
    };

    const [updateError, updatedRequest] = await safeExecute(
      repository.update(createdRequest!.id, updateData)
    );

    expect(updateError).toBeUndefined();
    expect(updatedRequest).toBeDefined();
    expect(updatedRequest!.id).toBe(createdRequest!.id);
    expect(updatedRequest!.content).toBe('Updated prayer content with more details');
    expect(updatedRequest!.has_attachment).toBe(true);
    expect(updatedRequest!.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    expect(updatedRequest!.created_at.getTime()).toBe(createdRequest!.created_at.getTime());
  });

  it('should soft-delete prayer request with deleted_by tracking and exclude from queries', async () => {
    // Create a prayer request
    const createData = {
      wall_id: testWallId,
      author_id: testUserId,
      content: 'Prayer to be soft deleted',
      anonymity_level: AnonymityLevel.IDENTIFIED,
    };

    const [createError, createdRequest] = await safeExecute(repository.create(createData));
    expect(createError).toBeUndefined();

    // Verify it can be found initially
    const [findError1, foundRequest1] = await safeExecute(
      repository.findById(createdRequest!.id)
    );
    expect(findError1).toBeUndefined();
    expect(foundRequest1).toBeDefined();
    expect(foundRequest1!.deleted_at).toBeNull();

    // Soft delete the prayer request
    const deletedBy = testUserId;
    const [deleteError, deleteResult] = await safeExecute(
      repository.softDelete(createdRequest!.id, deletedBy)
    );
    expect(deleteError).toBeUndefined();
    expect(deleteResult).toBe(true);

    // Verify it's not returned in normal queries
    const [findError2, foundRequest2] = await safeExecute(
      repository.findById(createdRequest!.id)
    );
    expect(findError2).toBeUndefined();
    expect(foundRequest2).toBeNull();

    // Verify it's not returned in findByWallId
    const [findError3, wallRequests] = await safeExecute(
      repository.findByWallId(testWallId)
    );
    expect(findError3).toBeUndefined();
    const deletedInList = wallRequests!.find(r => r.id === createdRequest!.id);
    expect(deletedInList).toBeUndefined();

    // Verify the record still exists in the database with deleted_at and deleted_by set
    const [queryError, dbResult] = await safeExecute(
      db`
        SELECT id, content, deleted_at, deleted_by
        FROM prayer_requests
        WHERE id = ${createdRequest!.id}
      `
    );
    expect(queryError).toBeUndefined();
    expect(dbResult).toHaveLength(1);
    expect(dbResult![0].deleted_at).toBeInstanceOf(Date);
    expect(dbResult![0].deleted_by).toBe(deletedBy);
  });

  it('should restore soft-deleted prayer request', async () => {
    // Create and soft-delete a prayer request
    const createData = {
      wall_id: testWallId,
      author_id: testUserId,
      content: 'Prayer to be restored',
      anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
    };

    const [createError, createdRequest] = await safeExecute(repository.create(createData));
    expect(createError).toBeUndefined();

    // Soft delete it
    const [deleteError] = await safeExecute(
      repository.softDelete(createdRequest!.id, testUserId)
    );
    expect(deleteError).toBeUndefined();

    // Verify it's not found in normal queries
    const [findError1, foundRequest1] = await safeExecute(
      repository.findById(createdRequest!.id)
    );
    expect(findError1).toBeUndefined();
    expect(foundRequest1).toBeNull();

    // Restore the prayer request
    const [restoreError, restoreResult] = await safeExecute(
      repository.restore(createdRequest!.id)
    );
    expect(restoreError).toBeUndefined();
    expect(restoreResult).toBe(true);

    // Verify it can be found again in normal queries
    const [findError2, foundRequest2] = await safeExecute(
      repository.findById(createdRequest!.id)
    );
    expect(findError2).toBeUndefined();
    expect(foundRequest2).toBeDefined();
    expect(foundRequest2!.id).toBe(createdRequest!.id);
    expect(foundRequest2!.content).toBe('Prayer to be restored');
    expect(foundRequest2!.deleted_at).toBeNull();
    expect(foundRequest2!.deleted_by).toBeNull();
  });
});
