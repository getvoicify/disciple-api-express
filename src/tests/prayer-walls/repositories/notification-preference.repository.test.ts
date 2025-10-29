import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../../utils/database';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';
import type {
  NotificationPreferences,
  NotificationPreference,
} from '../../../prayer-walls/types/prayer-wall.types';
import { NotificationPreferenceRepository } from '../../../prayer-walls/repositories/notification-preference.repository';

describe('NotificationPreferenceRepository', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  let repository: NotificationPreferenceRepository;
  let testChurchId: string;
  let testUserId: string;
  let testWallId1: string;
  let testWallId2: string;

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
    repository = new NotificationPreferenceRepository(db);

    // Create test data
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

    // Create two test prayer walls
    const [wall1Error, wall1Result] = await safeExecute(
      db`
        INSERT INTO prayer_walls (church_id, name, created_by)
        VALUES (
          ${testChurchId}::uuid,
          'Test Wall 1',
          ${testUserId}::uuid
        )
        RETURNING id
      `
    );

    if (wall1Error) {
      logger.error({ error: wall1Error }, 'Failed to create test wall 1');
      throw wall1Error;
    }

    testWallId1 = wall1Result![0].id;

    const [wall2Error, wall2Result] = await safeExecute(
      db`
        INSERT INTO prayer_walls (church_id, name, created_by)
        VALUES (
          ${testChurchId}::uuid,
          'Test Wall 2',
          ${testUserId}::uuid
        )
        RETURNING id
      `
    );

    if (wall2Error) {
      logger.error({ error: wall2Error }, 'Failed to create test wall 2');
      throw wall2Error;
    }

    testWallId2 = wall2Result![0].id;

    logger.info(
      { testChurchId, testUserId, testWallId1, testWallId2 },
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

  it('should create notification preferences with all flags enabled', async () => {
    const preferences: NotificationPreferences = {
      new_prayers: true,
      responses_to_my_prayers: true,
      replies_to_my_responses: true,
      wall_invitations: true,
      moderation_actions: true,
    };

    const [error, created] = await safeExecute(
      repository.create(testUserId, testWallId1, preferences)
    );

    expect(error).toBeUndefined();
    expect(created).toBeDefined();
    expect(created!.id).toBeDefined();
    expect(created!.user_id).toBe(testUserId);
    expect(created!.wall_id).toBe(testWallId1);
    expect(created!.new_prayers).toBe(true);
    expect(created!.responses_to_my_prayers).toBe(true);
    expect(created!.replies_to_my_responses).toBe(true);
    expect(created!.wall_invitations).toBe(true);
    expect(created!.moderation_actions).toBe(true);
    expect(created!.created_at).toBeInstanceOf(Date);
    expect(created!.updated_at).toBeInstanceOf(Date);
  });

  it('should create notification preferences with some flags disabled', async () => {
    const testUser2 = '00000000-0000-0000-0000-000000000002';
    const preferences: NotificationPreferences = {
      new_prayers: false,
      responses_to_my_prayers: true,
      replies_to_my_responses: false,
      wall_invitations: true,
      moderation_actions: false,
    };

    const [error, created] = await safeExecute(
      repository.create(testUser2, testWallId1, preferences)
    );

    expect(error).toBeUndefined();
    expect(created).toBeDefined();
    expect(created!.user_id).toBe(testUser2);
    expect(created!.wall_id).toBe(testWallId1);
    expect(created!.new_prayers).toBe(false);
    expect(created!.responses_to_my_prayers).toBe(true);
    expect(created!.replies_to_my_responses).toBe(false);
    expect(created!.wall_invitations).toBe(true);
    expect(created!.moderation_actions).toBe(false);
  });

  it('should find notification preferences for user and wall', async () => {
    const testUser3 = '00000000-0000-0000-0000-000000000003';
    const preferences: NotificationPreferences = {
      new_prayers: true,
      responses_to_my_prayers: false,
      replies_to_my_responses: true,
      wall_invitations: false,
      moderation_actions: true,
    };

    // Create preferences
    const [createError, created] = await safeExecute(
      repository.create(testUser3, testWallId1, preferences)
    );
    expect(createError).toBeUndefined();

    // Find preferences
    const [error, found] = await safeExecute(repository.find(testUser3, testWallId1));

    expect(error).toBeUndefined();
    expect(found).toBeDefined();
    expect(found!.id).toBe(created!.id);
    expect(found!.user_id).toBe(testUser3);
    expect(found!.wall_id).toBe(testWallId1);
    expect(found!.new_prayers).toBe(true);
    expect(found!.responses_to_my_prayers).toBe(false);
    expect(found!.replies_to_my_responses).toBe(true);
    expect(found!.wall_invitations).toBe(false);
    expect(found!.moderation_actions).toBe(true);
  });

  it('should update notification preferences partially and verify updated_at changes', async () => {
    const testUser4 = '00000000-0000-0000-0000-000000000004';
    const initialPreferences: NotificationPreferences = {
      new_prayers: true,
      responses_to_my_prayers: true,
      replies_to_my_responses: true,
      wall_invitations: true,
      moderation_actions: true,
    };

    // Create initial preferences
    const [createError, created] = await safeExecute(
      repository.create(testUser4, testWallId1, initialPreferences)
    );
    expect(createError).toBeUndefined();

    const originalUpdatedAt = created!.updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update only some preferences
    const partialUpdate: Partial<NotificationPreferences> = {
      new_prayers: false,
      responses_to_my_prayers: false,
    };

    const [updateError, updated] = await safeExecute(
      repository.update(testUser4, testWallId1, partialUpdate)
    );

    expect(updateError).toBeUndefined();
    expect(updated).toBeDefined();
    expect(updated!.id).toBe(created!.id);
    expect(updated!.user_id).toBe(testUser4);
    expect(updated!.wall_id).toBe(testWallId1);
    expect(updated!.new_prayers).toBe(false);
    expect(updated!.responses_to_my_prayers).toBe(false);
    // These should remain unchanged
    expect(updated!.replies_to_my_responses).toBe(true);
    expect(updated!.wall_invitations).toBe(true);
    expect(updated!.moderation_actions).toBe(true);
    // Verify updated_at changed
    expect(updated!.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should find all notification preferences for a user across multiple walls', async () => {
    const testUser5 = '00000000-0000-0000-0000-000000000005';

    // Create preferences for wall 1
    const preferences1: NotificationPreferences = {
      new_prayers: true,
      responses_to_my_prayers: true,
      replies_to_my_responses: true,
      wall_invitations: true,
      moderation_actions: true,
    };

    const [error1] = await safeExecute(
      repository.create(testUser5, testWallId1, preferences1)
    );
    expect(error1).toBeUndefined();

    // Create preferences for wall 2
    const preferences2: NotificationPreferences = {
      new_prayers: false,
      responses_to_my_prayers: false,
      replies_to_my_responses: false,
      wall_invitations: false,
      moderation_actions: false,
    };

    const [error2] = await safeExecute(
      repository.create(testUser5, testWallId2, preferences2)
    );
    expect(error2).toBeUndefined();

    // Find all preferences for user
    const [error, allPreferences] = await safeExecute(repository.findByUser(testUser5));

    expect(error).toBeUndefined();
    expect(allPreferences).toBeDefined();
    expect(allPreferences!.length).toBe(2);

    // Verify both preferences are present
    const wall1Prefs = allPreferences!.find((p) => p.wall_id === testWallId1);
    const wall2Prefs = allPreferences!.find((p) => p.wall_id === testWallId2);

    expect(wall1Prefs).toBeDefined();
    expect(wall1Prefs!.new_prayers).toBe(true);
    expect(wall1Prefs!.responses_to_my_prayers).toBe(true);

    expect(wall2Prefs).toBeDefined();
    expect(wall2Prefs!.new_prayers).toBe(false);
    expect(wall2Prefs!.responses_to_my_prayers).toBe(false);
  });

  it('should return null when notification preferences not found', async () => {
    const nonExistentUser = '00000000-0000-0000-0000-000000000099';

    const [error, found] = await safeExecute(
      repository.find(nonExistentUser, testWallId1)
    );

    expect(error).toBeUndefined();
    expect(found).toBeNull();
  });

  it('should return empty array when user has no notification preferences', async () => {
    const userWithNoPrefs = '00000000-0000-0000-0000-000000000098';

    const [error, preferences] = await safeExecute(
      repository.findByUser(userWithNoPrefs)
    );

    expect(error).toBeUndefined();
    expect(preferences).toBeDefined();
    expect(preferences!.length).toBe(0);
  });

  it('should enforce unique constraint on user_id and wall_id combination', async () => {
    const testUser6 = '00000000-0000-0000-0000-000000000006';
    const preferences: NotificationPreferences = {
      new_prayers: true,
      responses_to_my_prayers: true,
      replies_to_my_responses: true,
      wall_invitations: true,
      moderation_actions: true,
    };

    // Create first preference
    const [error1, created] = await safeExecute(
      repository.create(testUser6, testWallId1, preferences)
    );
    expect(error1).toBeUndefined();
    expect(created).toBeDefined();

    // Attempt to create duplicate preference for same user and wall
    const [error2, duplicate] = await safeExecute(
      repository.create(testUser6, testWallId1, preferences)
    );

    // Should fail with unique constraint violation
    expect(error2).toBeDefined();
    expect(duplicate).toBeUndefined();
    expect(error2!.message).toContain('unique_user_wall_preferences');
  });
});
