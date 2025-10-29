import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../../utils/database';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';
import { PrayerWallRepository } from '../../../prayer-walls/repositories/prayer-wall.repository';

describe('PrayerWallRepository', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  let repository: PrayerWallRepository;
  let testChurchId: string;
  let testUserId: string;

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
    repository = new PrayerWallRepository(db);

    // Create test church
    testUserId = '00000000-0000-0000-0000-000000000001';
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
    logger.info({ testChurchId, testUserId }, 'Test data initialized');
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

  it('should create prayer wall with valid data and verify timestamps', async () => {
    const createData = {
      church_id: testChurchId,
      name: 'Morning Prayer Wall',
      description: 'A place for morning prayers and reflections',
      created_by: testUserId,
      is_private: false,
      has_restricted_access: false,
      status: 'active' as const,
    };

    const [error, prayerWall] = await safeExecute(repository.create(createData));

    expect(error).toBeUndefined();
    expect(prayerWall).toBeDefined();
    expect(prayerWall!.id).toBeDefined();
    expect(prayerWall!.church_id).toBe(testChurchId);
    expect(prayerWall!.name).toBe('Morning Prayer Wall');
    expect(prayerWall!.description).toBe('A place for morning prayers and reflections');
    expect(prayerWall!.created_by).toBe(testUserId);
    expect(prayerWall!.is_private).toBe(false);
    expect(prayerWall!.has_restricted_access).toBe(false);
    expect(prayerWall!.status).toBe('active');
    expect(prayerWall!.created_at).toBeInstanceOf(Date);
    expect(prayerWall!.updated_at).toBeInstanceOf(Date);
    expect(prayerWall!.deleted_at).toBeNull();
  });

  it('should create private prayer wall with schedule and video call link', async () => {
    const schedule = {
      frequency: 'weekly',
      day: 'Sunday',
      time: '10:00',
      timezone: 'America/New_York',
      duration_minutes: 60,
    };

    const createData = {
      church_id: testChurchId,
      name: 'Evening Prayer Circle',
      description: 'Weekly evening prayer sessions',
      created_by: testUserId,
      is_private: true,
      has_restricted_access: true,
      schedule,
      video_call_link: 'https://zoom.us/j/123456789',
      status: 'active' as const,
    };

    const [error, prayerWall] = await safeExecute(repository.create(createData));

    expect(error).toBeUndefined();
    expect(prayerWall).toBeDefined();
    expect(prayerWall!.is_private).toBe(true);
    expect(prayerWall!.has_restricted_access).toBe(true);
    expect(prayerWall!.schedule).toEqual(schedule);
    expect(prayerWall!.video_call_link).toBe('https://zoom.us/j/123456789');
  });

  it('should find prayer wall by id with church_id verification', async () => {
    // Create a test prayer wall
    const createData = {
      church_id: testChurchId,
      name: 'Youth Prayer Wall',
      created_by: testUserId,
    };

    const [createError, createdWall] = await safeExecute(repository.create(createData));
    expect(createError).toBeUndefined();

    // Find by ID with matching church_id
    const [error, foundWall] = await safeExecute(
      repository.findById(createdWall!.id, testChurchId)
    );

    expect(error).toBeUndefined();
    expect(foundWall).toBeDefined();
    expect(foundWall!.id).toBe(createdWall!.id);
    expect(foundWall!.church_id).toBe(testChurchId);
    expect(foundWall!.name).toBe('Youth Prayer Wall');
  });

  it('should return null when prayer wall not found or church_id mismatch', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000099';
    const wrongChurchId = '00000000-0000-0000-0000-000000000098';

    // Test with non-existent ID
    const [error1, result1] = await safeExecute(
      repository.findById(nonExistentId, testChurchId)
    );
    expect(error1).toBeUndefined();
    expect(result1).toBeNull();

    // Create a wall and try to find it with wrong church_id
    const createData = {
      church_id: testChurchId,
      name: 'Test Wall for Mismatch',
      created_by: testUserId,
    };
    const [createError, createdWall] = await safeExecute(repository.create(createData));
    expect(createError).toBeUndefined();

    const [error2, result2] = await safeExecute(
      repository.findById(createdWall!.id, wrongChurchId)
    );
    expect(error2).toBeUndefined();
    expect(result2).toBeNull();
  });

  it('should find prayer walls by church_id with pagination', async () => {
    // Create multiple prayer walls for the same church
    const walls = [
      { name: 'Wall 1', created_by: testUserId, church_id: testChurchId },
      { name: 'Wall 2', created_by: testUserId, church_id: testChurchId },
      { name: 'Wall 3', created_by: testUserId, church_id: testChurchId },
      { name: 'Wall 4', created_by: testUserId, church_id: testChurchId },
    ];

    for (const wallData of walls) {
      const [error] = await safeExecute(repository.create(wallData));
      expect(error).toBeUndefined();
    }

    // Test pagination - get first 2 walls
    const [error1, page1] = await safeExecute(
      repository.findByChurchId(testChurchId, { limit: 2, offset: 0 })
    );
    expect(error1).toBeUndefined();
    expect(page1).toBeDefined();
    expect(page1!.length).toBe(2);

    // Test pagination - get next 2 walls
    const [error2, page2] = await safeExecute(
      repository.findByChurchId(testChurchId, { limit: 2, offset: 2 })
    );
    expect(error2).toBeUndefined();
    expect(page2).toBeDefined();
    expect(page2!.length).toBe(2);

    // Verify pages contain different walls
    expect(page1![0].id).not.toBe(page2![0].id);

    // Test without pagination - get all walls
    const [error3, allWalls] = await safeExecute(
      repository.findByChurchId(testChurchId)
    );
    expect(error3).toBeUndefined();
    expect(allWalls).toBeDefined();
    expect(allWalls!.length).toBeGreaterThanOrEqual(4);
  });

  it('should update prayer wall details and verify updated_at timestamp changes', async () => {
    // Create a prayer wall
    const createData = {
      church_id: testChurchId,
      name: 'Original Name',
      description: 'Original description',
      created_by: testUserId,
      status: 'active' as const,
    };

    const [createError, createdWall] = await safeExecute(repository.create(createData));
    expect(createError).toBeUndefined();

    const originalUpdatedAt = createdWall!.updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update the prayer wall
    const updateData = {
      name: 'Updated Name',
      description: 'Updated description',
      schedule: {
        frequency: 'daily',
        time: '06:00',
        timezone: 'America/Chicago',
        duration_minutes: 30,
      },
      video_call_link: 'https://meet.google.com/abc-defg-hij',
    };

    const [updateError, updatedWall] = await safeExecute(
      repository.update(createdWall!.id, updateData)
    );

    expect(updateError).toBeUndefined();
    expect(updatedWall).toBeDefined();
    expect(updatedWall!.id).toBe(createdWall!.id);
    expect(updatedWall!.name).toBe('Updated Name');
    expect(updatedWall!.description).toBe('Updated description');
    expect(updatedWall!.schedule).toEqual(updateData.schedule);
    expect(updatedWall!.video_call_link).toBe('https://meet.google.com/abc-defg-hij');
    expect(updatedWall!.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should soft-delete prayer wall and exclude from normal queries', async () => {
    // Create a prayer wall
    const createData = {
      church_id: testChurchId,
      name: 'Wall To Soft Delete',
      created_by: testUserId,
    };

    const [createError, createdWall] = await safeExecute(repository.create(createData));
    expect(createError).toBeUndefined();

    // Verify it can be found initially
    const [findError1, foundWall1] = await safeExecute(
      repository.findById(createdWall!.id, testChurchId)
    );
    expect(findError1).toBeUndefined();
    expect(foundWall1).toBeDefined();
    expect(foundWall1!.deleted_at).toBeNull();

    // Soft delete the prayer wall
    const [deleteError, deleteResult] = await safeExecute(
      repository.softDelete(createdWall!.id)
    );
    expect(deleteError).toBeUndefined();
    expect(deleteResult).toBe(true);

    // Verify it's not returned in normal queries (findById excludes deleted by default)
    const [findError2, foundWall2] = await safeExecute(
      repository.findById(createdWall!.id, testChurchId)
    );
    expect(findError2).toBeUndefined();
    expect(foundWall2).toBeNull();

    // Verify it's not returned in findByChurchId
    const [findError3, churchWalls] = await safeExecute(
      repository.findByChurchId(testChurchId)
    );
    expect(findError3).toBeUndefined();
    const deletedWallInList = churchWalls!.find(w => w.id === createdWall!.id);
    expect(deletedWallInList).toBeUndefined();

    // Verify the record still exists in the database with deleted_at set
    const [queryError, dbResult] = await safeExecute(
      db`
        SELECT id, name, deleted_at
        FROM prayer_walls
        WHERE id = ${createdWall!.id}
      `
    );
    expect(queryError).toBeUndefined();
    expect(dbResult).toHaveLength(1);
    expect(dbResult![0].deleted_at).toBeInstanceOf(Date);
  });

  it('should restore soft-deleted prayer wall', async () => {
    // Create and soft-delete a prayer wall
    const createData = {
      church_id: testChurchId,
      name: 'Wall To Restore',
      description: 'This wall will be restored',
      created_by: testUserId,
    };

    const [createError, createdWall] = await safeExecute(repository.create(createData));
    expect(createError).toBeUndefined();

    // Soft delete it
    const [deleteError] = await safeExecute(repository.softDelete(createdWall!.id));
    expect(deleteError).toBeUndefined();

    // Verify it's not found in normal queries
    const [findError1, foundWall1] = await safeExecute(
      repository.findById(createdWall!.id, testChurchId)
    );
    expect(findError1).toBeUndefined();
    expect(foundWall1).toBeNull();

    // Restore the prayer wall
    const [restoreError, restoreResult] = await safeExecute(
      repository.restore(createdWall!.id)
    );
    expect(restoreError).toBeUndefined();
    expect(restoreResult).toBe(true);

    // Verify it can be found again in normal queries
    const [findError2, foundWall2] = await safeExecute(
      repository.findById(createdWall!.id, testChurchId)
    );
    expect(findError2).toBeUndefined();
    expect(foundWall2).toBeDefined();
    expect(foundWall2!.id).toBe(createdWall!.id);
    expect(foundWall2!.name).toBe('Wall To Restore');
    expect(foundWall2!.deleted_at).toBeNull();
  });
});