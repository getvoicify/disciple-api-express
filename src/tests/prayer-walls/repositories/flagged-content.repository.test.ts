import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../../utils/database';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';
import { FlaggedContentRepository } from '../../../prayer-walls/repositories/flagged-content.repository';
import { FlaggedContentStatus } from '../../../prayer-walls/types/prayer-wall.types';
import { randomUUID } from 'crypto';

describe('FlaggedContentRepository', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  let repository: FlaggedContentRepository;
  let testChurchId: string;
  let testUserId: string;
  let testModeratorId: string;
  let testWallId: string;
  let testPrayerRequestId: string;

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
    repository = new FlaggedContentRepository(db);

    // Create test fixtures
    testUserId = randomUUID();
    testModeratorId = randomUUID();

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
        INSERT INTO prayer_walls (id, church_id, name, created_by)
        VALUES (
          gen_random_uuid(),
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

    testWallId = wallResult![0].id;

    // Create test prayer request
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (id, wall_id, author_id, content)
        VALUES (
          gen_random_uuid(),
          ${testWallId}::uuid,
          ${testUserId}::uuid,
          'Test prayer request content'
        )
        RETURNING id
      `
    );

    if (requestError) {
      logger.error({ error: requestError }, 'Failed to create test prayer request');
      throw requestError;
    }

    testPrayerRequestId = requestResult![0].id;

    logger.info(
      {
        testChurchId,
        testUserId,
        testModeratorId,
        testWallId,
        testPrayerRequestId,
      },
      'Test fixtures initialized'
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

  it('should create flagged content with pending status and verify all fields', async () => {
    const reason = 'Inappropriate content detected';

    const [error, flagged] = await safeExecute(
      repository.create(testPrayerRequestId, testUserId, reason)
    );

    expect(error).toBeUndefined();
    expect(flagged).toBeDefined();
    expect(flagged!.id).toBeDefined();
    expect(flagged!.prayer_request_id).toBe(testPrayerRequestId);
    expect(flagged!.flagged_by).toBe(testUserId);
    expect(flagged!.reason).toBe(reason);
    expect(flagged!.status).toBe(FlaggedContentStatus.PENDING);
    expect(flagged!.reviewed_by).toBeNull();
    expect(flagged!.reviewed_at).toBeNull();
    expect(flagged!.resolution_action).toBeNull();
    expect(flagged!.resolution_notes).toBeNull();
    expect(flagged!.created_at).toBeInstanceOf(Date);
    expect(flagged!.updated_at).toBeInstanceOf(Date);
  });

  it('should find all pending flagged content for a church', async () => {
    // Create multiple flagged content items with pending status
    const testUserId2 = randomUUID();
    const testUserId3 = randomUUID();

    // Create additional prayer requests
    const [request2Error, request2Result] = await safeExecute(
      db`
        INSERT INTO prayer_requests (id, wall_id, author_id, content)
        VALUES (
          gen_random_uuid(),
          ${testWallId}::uuid,
          ${testUserId2}::uuid,
          'Second prayer request'
        )
        RETURNING id
      `
    );
    expect(request2Error).toBeUndefined();
    const requestId2 = request2Result![0].id;

    const [request3Error, request3Result] = await safeExecute(
      db`
        INSERT INTO prayer_requests (id, wall_id, author_id, content)
        VALUES (
          gen_random_uuid(),
          ${testWallId}::uuid,
          ${testUserId3}::uuid,
          'Third prayer request'
        )
        RETURNING id
      `
    );
    expect(request3Error).toBeUndefined();
    const requestId3 = request3Result![0].id;

    // Create flagged content items
    const [error1] = await safeExecute(
      repository.create(requestId2, testUserId2, 'Spam content')
    );
    expect(error1).toBeUndefined();

    const [error2] = await safeExecute(
      repository.create(requestId3, testUserId3, 'Offensive language')
    );
    expect(error2).toBeUndefined();

    // Find pending flagged content
    const [error, pendingFlags] = await safeExecute(repository.findPending(testChurchId));

    expect(error).toBeUndefined();
    expect(pendingFlags).toBeDefined();
    expect(pendingFlags!.length).toBeGreaterThanOrEqual(2);
    expect(pendingFlags!.every(flag => flag.status === FlaggedContentStatus.PENDING)).toBe(
      true
    );
  });

  it('should update status to reviewed with reviewer tracking and timestamp', async () => {
    // Create a flagged content item
    const [createError, flagged] = await safeExecute(
      repository.create(testPrayerRequestId, testUserId, 'Content needs review')
    );
    expect(createError).toBeUndefined();

    // Update status to reviewed
    const [error, updated] = await safeExecute(
      repository.updateStatus(
        flagged!.id,
        FlaggedContentStatus.REVIEWED,
        testModeratorId
      )
    );

    expect(error).toBeUndefined();
    expect(updated).toBeDefined();
    expect(updated!.id).toBe(flagged!.id);
    expect(updated!.status).toBe(FlaggedContentStatus.REVIEWED);
    expect(updated!.reviewed_by).toBe(testModeratorId);
    expect(updated!.reviewed_at).toBeInstanceOf(Date);
    expect(updated!.reviewed_at).not.toBeNull();
    expect(updated!.updated_at.getTime()).toBeGreaterThan(flagged!.updated_at.getTime());
  });

  it('should update status to dismissed with notes', async () => {
    // Create a flagged content item
    const [createError, flagged] = await safeExecute(
      repository.create(testPrayerRequestId, testUserId, 'False flag report')
    );
    expect(createError).toBeUndefined();

    // Update status to dismissed with notes
    const dismissalNotes = 'Reviewed and found no violation. Content is appropriate.';
    const [error, updated] = await safeExecute(
      repository.updateStatus(
        flagged!.id,
        FlaggedContentStatus.DISMISSED,
        testModeratorId,
        undefined,
        dismissalNotes
      )
    );

    expect(error).toBeUndefined();
    expect(updated).toBeDefined();
    expect(updated!.id).toBe(flagged!.id);
    expect(updated!.status).toBe(FlaggedContentStatus.DISMISSED);
    expect(updated!.reviewed_by).toBe(testModeratorId);
    expect(updated!.reviewed_at).toBeInstanceOf(Date);
    expect(updated!.resolution_notes).toBe(dismissalNotes);
    expect(updated!.resolution_action).toBeNull();
  });

  it('should update status to actioned with delete action and notes', async () => {
    // Create a flagged content item
    const [createError, flagged] = await safeExecute(
      repository.create(
        testPrayerRequestId,
        testUserId,
        'Severe policy violation - offensive language'
      )
    );
    expect(createError).toBeUndefined();

    // Update status to actioned with delete action
    const actionNotes = 'Content deleted due to severe violation of community guidelines.';
    const [error, updated] = await safeExecute(
      repository.updateStatus(
        flagged!.id,
        FlaggedContentStatus.ACTIONED,
        testModeratorId,
        'delete',
        actionNotes
      )
    );

    expect(error).toBeUndefined();
    expect(updated).toBeDefined();
    expect(updated!.id).toBe(flagged!.id);
    expect(updated!.status).toBe(FlaggedContentStatus.ACTIONED);
    expect(updated!.reviewed_by).toBe(testModeratorId);
    expect(updated!.reviewed_at).toBeInstanceOf(Date);
    expect(updated!.resolution_action).toBe('delete');
    expect(updated!.resolution_notes).toBe(actionNotes);
  });

  it('should update status to actioned with warn action', async () => {
    // Create a flagged content item
    const [createError, flagged] = await safeExecute(
      repository.create(testPrayerRequestId, testUserId, 'Minor policy violation')
    );
    expect(createError).toBeUndefined();

    // Update status to actioned with warn action
    const actionNotes = 'User warned about appropriate content guidelines.';
    const [error, updated] = await safeExecute(
      repository.updateStatus(
        flagged!.id,
        FlaggedContentStatus.ACTIONED,
        testModeratorId,
        'warn',
        actionNotes
      )
    );

    expect(error).toBeUndefined();
    expect(updated).toBeDefined();
    expect(updated!.status).toBe(FlaggedContentStatus.ACTIONED);
    expect(updated!.resolution_action).toBe('warn');
    expect(updated!.resolution_notes).toBe(actionNotes);
  });

  it('should update status to actioned with ban action', async () => {
    // Create a flagged content item
    const [createError, flagged] = await safeExecute(
      repository.create(testPrayerRequestId, testUserId, 'Repeat offender - harassment')
    );
    expect(createError).toBeUndefined();

    // Update status to actioned with ban action
    const actionNotes = 'User banned from prayer wall due to repeated violations.';
    const [error, updated] = await safeExecute(
      repository.updateStatus(
        flagged!.id,
        FlaggedContentStatus.ACTIONED,
        testModeratorId,
        'ban',
        actionNotes
      )
    );

    expect(error).toBeUndefined();
    expect(updated).toBeDefined();
    expect(updated!.status).toBe(FlaggedContentStatus.ACTIONED);
    expect(updated!.resolution_action).toBe('ban');
    expect(updated!.resolution_notes).toBe(actionNotes);
  });

  it('should find all flags for a specific prayer request', async () => {
    // Create a new prayer request
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (id, wall_id, author_id, content)
        VALUES (
          gen_random_uuid(),
          ${testWallId}::uuid,
          ${testUserId}::uuid,
          'Prayer request with multiple flags'
        )
        RETURNING id
      `
    );
    expect(requestError).toBeUndefined();
    const multipleRequestId = requestResult![0].id;

    // Create multiple flags for the same prayer request from different users
    const flagger1 = randomUUID();
    const flagger2 = randomUUID();
    const flagger3 = randomUUID();

    const [error1] = await safeExecute(
      repository.create(multipleRequestId, flagger1, 'Inappropriate content')
    );
    expect(error1).toBeUndefined();

    const [error2] = await safeExecute(
      repository.create(multipleRequestId, flagger2, 'Spam')
    );
    expect(error2).toBeUndefined();

    const [error3] = await safeExecute(
      repository.create(multipleRequestId, flagger3, 'Offensive language')
    );
    expect(error3).toBeUndefined();

    // Find all flags for this specific prayer request
    const [error, flags] = await safeExecute(
      repository.findByRequestId(multipleRequestId)
    );

    expect(error).toBeUndefined();
    expect(flags).toBeDefined();
    expect(flags!.length).toBe(3);
    expect(flags!.every(flag => flag.prayer_request_id === multipleRequestId)).toBe(true);
    expect(flags!.map(f => f.flagged_by)).toContain(flagger1);
    expect(flags!.map(f => f.flagged_by)).toContain(flagger2);
    expect(flags!.map(f => f.flagged_by)).toContain(flagger3);
  });
});
