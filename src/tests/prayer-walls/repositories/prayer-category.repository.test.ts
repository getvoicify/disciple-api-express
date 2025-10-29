import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../../utils/database';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';
import { PrayerCategoryRepository } from '../../../prayer-walls/repositories/prayer-category.repository';

describe('PrayerCategoryRepository', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  let repository: PrayerCategoryRepository;
  let testChurchId1: string;
  let testChurchId2: string;
  let testUserId: string;
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

    // Run prerequisite migrations (001-013) including system category seed
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
    repository = new PrayerCategoryRepository(db);

    // Create test data
    testUserId = '00000000-0000-0000-0000-000000000001';

    // Create first test church
    const [churchError1, churchResult1] = await safeExecute(
      db`
        INSERT INTO churches (id, slug, name, created_by)
        VALUES (
          gen_random_uuid(),
          'test-church-1',
          'Test Church 1',
          ${testUserId}::uuid
        )
        RETURNING id
      `
    );

    if (churchError1) {
      logger.error({ error: churchError1 }, 'Failed to create test church 1');
      throw churchError1;
    }

    testChurchId1 = churchResult1![0].id;

    // Create second test church
    const [churchError2, churchResult2] = await safeExecute(
      db`
        INSERT INTO churches (id, slug, name, created_by)
        VALUES (
          gen_random_uuid(),
          'test-church-2',
          'Test Church 2',
          ${testUserId}::uuid
        )
        RETURNING id
      `
    );

    if (churchError2) {
      logger.error({ error: churchError2 }, 'Failed to create test church 2');
      throw churchError2;
    }

    testChurchId2 = churchResult2![0].id;

    // Create a test prayer wall and prayer request for category assignment tests
    const [wallError, wallResult] = await safeExecute(
      db`
        INSERT INTO prayer_walls (church_id, name, created_by)
        VALUES (
          ${testChurchId1}::uuid,
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

    const wallId = wallResult![0].id;

    // Create a test prayer request
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${wallId}::uuid,
          ${testUserId}::uuid,
          'Test prayer request for category assignment'
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
      { testChurchId1, testChurchId2, testUserId, testPrayerRequestId },
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

  it('should find all 5 system categories seeded by migration 013', async () => {
    const [error, categories] = await safeExecute(repository.findSystemCategories());

    expect(error).toBeUndefined();
    expect(categories).toBeDefined();
    expect(categories).toHaveLength(5);

    // Verify system category names
    const names = categories!.map((c) => c.name).sort();
    expect(names).toContain('Healing');
    expect(names).toContain('Guidance');
    expect(names).toContain('Thanksgiving');
    expect(names).toContain('Intercession');
    expect(names).toContain('Family');

    // Verify all are system categories with null church_id
    for (const category of categories!) {
      expect(category.is_system_category).toBe(true);
      expect(category.church_id).toBeNull();
      expect(category.id).toBeDefined();
      expect(category.created_at).toBeInstanceOf(Date);
      expect(category.updated_at).toBeInstanceOf(Date);
    }
  });

  it('should find all categories for a church (system + custom combined)', async () => {
    // Create a custom category for church 1
    const [createError] = await safeExecute(
      repository.create('Church 1 Custom Category', testChurchId1)
    );
    expect(createError).toBeUndefined();

    // Find all categories for church 1 (should include 5 system + 1 custom)
    const [error, categories] = await safeExecute(repository.findAll(testChurchId1));

    expect(error).toBeUndefined();
    expect(categories).toBeDefined();
    expect(categories!.length).toBeGreaterThanOrEqual(6);

    // Verify system categories are included
    const systemCategories = categories!.filter((c) => c.is_system_category);
    expect(systemCategories.length).toBe(5);

    // Verify custom category is included
    const customCategories = categories!.filter(
      (c) => !c.is_system_category && c.church_id === testChurchId1
    );
    expect(customCategories.length).toBeGreaterThanOrEqual(1);

    // Verify no categories from other churches are included
    const otherChurchCategories = categories!.filter(
      (c) => c.church_id !== null && c.church_id !== testChurchId1
    );
    expect(otherChurchCategories.length).toBe(0);
  });

  it('should create custom category for a church', async () => {
    const categoryName = 'Youth Ministry';

    const [error, category] = await safeExecute(repository.create(categoryName, testChurchId1));

    expect(error).toBeUndefined();
    expect(category).toBeDefined();
    expect(category!.id).toBeDefined();
    expect(category!.name).toBe(categoryName);
    expect(category!.church_id).toBe(testChurchId1);
    expect(category!.is_system_category).toBe(false);
    expect(category!.created_at).toBeInstanceOf(Date);
    expect(category!.updated_at).toBeInstanceOf(Date);
  });

  it('should create custom category with same name as system category (scoped to church)', async () => {
    // Creating a custom category with the same name as a system category should be allowed
    // because custom categories are scoped to a specific church
    const systemCategoryName = 'Healing'; // Same as system category

    const [error, category] = await safeExecute(
      repository.create(systemCategoryName, testChurchId2)
    );

    expect(error).toBeUndefined();
    expect(category).toBeDefined();
    expect(category!.name).toBe(systemCategoryName);
    expect(category!.church_id).toBe(testChurchId2);
    expect(category!.is_system_category).toBe(false);

    // Verify both system and custom "Healing" categories exist
    const [findError, allCategories] = await safeExecute(repository.findAll(testChurchId2));
    expect(findError).toBeUndefined();

    const healingCategories = allCategories!.filter((c) => c.name === 'Healing');
    expect(healingCategories.length).toBe(2); // 1 system + 1 custom

    const systemHealing = healingCategories.find((c) => c.is_system_category);
    const customHealing = healingCategories.find((c) => !c.is_system_category);

    expect(systemHealing).toBeDefined();
    expect(systemHealing!.church_id).toBeNull();

    expect(customHealing).toBeDefined();
    expect(customHealing!.church_id).toBe(testChurchId2);
  });

  it('should assign single category to prayer request', async () => {
    // Get a system category to assign
    const [systemCategoriesError, systemCategories] = await safeExecute(
      repository.findSystemCategories()
    );
    expect(systemCategoriesError).toBeUndefined();

    const guidanceCategory = systemCategories!.find((c) => c.name === 'Guidance');
    expect(guidanceCategory).toBeDefined();

    // Assign the category to the prayer request
    const [assignError] = await safeExecute(
      repository.assignToRequest(testPrayerRequestId, [guidanceCategory!.id])
    );

    expect(assignError).toBeUndefined();

    // Verify the category was assigned
    const [findError, assignedCategories] = await safeExecute(
      repository.findByRequestId(testPrayerRequestId)
    );

    expect(findError).toBeUndefined();
    expect(assignedCategories).toBeDefined();
    expect(assignedCategories!.length).toBe(1);
    expect(assignedCategories![0].id).toBe(guidanceCategory!.id);
    expect(assignedCategories![0].name).toBe('Guidance');
  });

  it('should assign multiple categories to prayer request', async () => {
    // Create a new prayer request for this test
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          (SELECT id FROM prayer_walls WHERE church_id = ${testChurchId1}::uuid LIMIT 1),
          ${testUserId}::uuid,
          'Prayer request for multiple categories'
        )
        RETURNING id
      `
    );
    expect(requestError).toBeUndefined();

    const requestId = requestResult![0].id;

    // Get multiple system categories
    const [systemCategoriesError, systemCategories] = await safeExecute(
      repository.findSystemCategories()
    );
    expect(systemCategoriesError).toBeUndefined();

    const healing = systemCategories!.find((c) => c.name === 'Healing');
    const family = systemCategories!.find((c) => c.name === 'Family');
    const thanksgiving = systemCategories!.find((c) => c.name === 'Thanksgiving');

    expect(healing).toBeDefined();
    expect(family).toBeDefined();
    expect(thanksgiving).toBeDefined();

    const categoryIds = [healing!.id, family!.id, thanksgiving!.id];

    // Assign multiple categories
    const [assignError] = await safeExecute(repository.assignToRequest(requestId, categoryIds));

    expect(assignError).toBeUndefined();

    // Verify all categories were assigned
    const [findError, assignedCategories] = await safeExecute(
      repository.findByRequestId(requestId)
    );

    expect(findError).toBeUndefined();
    expect(assignedCategories).toBeDefined();
    expect(assignedCategories!.length).toBe(3);

    const assignedNames = assignedCategories!.map((c) => c.name).sort();
    expect(assignedNames).toContain('Healing');
    expect(assignedNames).toContain('Family');
    expect(assignedNames).toContain('Thanksgiving');
  });

  it('should find categories by prayer request ID', async () => {
    // Create a new prayer request
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          (SELECT id FROM prayer_walls WHERE church_id = ${testChurchId1}::uuid LIMIT 1),
          ${testUserId}::uuid,
          'Prayer request for finding categories'
        )
        RETURNING id
      `
    );
    expect(requestError).toBeUndefined();

    const requestId = requestResult![0].id;

    // Assign categories
    const [systemCategoriesError, systemCategories] = await safeExecute(
      repository.findSystemCategories()
    );
    expect(systemCategoriesError).toBeUndefined();

    const intercession = systemCategories!.find((c) => c.name === 'Intercession');
    expect(intercession).toBeDefined();

    const [assignError] = await safeExecute(
      repository.assignToRequest(requestId, [intercession!.id])
    );
    expect(assignError).toBeUndefined();

    // Find categories by request ID
    const [findError, categories] = await safeExecute(repository.findByRequestId(requestId));

    expect(findError).toBeUndefined();
    expect(categories).toBeDefined();
    expect(categories!.length).toBe(1);
    expect(categories![0].id).toBe(intercession!.id);
    expect(categories![0].name).toBe('Intercession');
    expect(categories![0].is_system_category).toBe(true);
  });

  it('should prevent duplicate category assignment (idempotent)', async () => {
    // Create a new prayer request
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          (SELECT id FROM prayer_walls WHERE church_id = ${testChurchId1}::uuid LIMIT 1),
          ${testUserId}::uuid,
          'Prayer request for idempotency test'
        )
        RETURNING id
      `
    );
    expect(requestError).toBeUndefined();

    const requestId = requestResult![0].id;

    // Get a system category
    const [systemCategoriesError, systemCategories] = await safeExecute(
      repository.findSystemCategories()
    );
    expect(systemCategoriesError).toBeUndefined();

    const family = systemCategories!.find((c) => c.name === 'Family');
    expect(family).toBeDefined();

    // Assign the category for the first time
    const [assignError1] = await safeExecute(
      repository.assignToRequest(requestId, [family!.id])
    );
    expect(assignError1).toBeUndefined();

    // Verify one category is assigned
    const [findError1, categories1] = await safeExecute(repository.findByRequestId(requestId));
    expect(findError1).toBeUndefined();
    expect(categories1!.length).toBe(1);

    // Assign the same category again (should be idempotent)
    const [assignError2] = await safeExecute(
      repository.assignToRequest(requestId, [family!.id])
    );
    expect(assignError2).toBeUndefined();

    // Verify still only one category is assigned (no duplicate)
    const [findError2, categories2] = await safeExecute(repository.findByRequestId(requestId));
    expect(findError2).toBeUndefined();
    expect(categories2!.length).toBe(1);
    expect(categories2![0].id).toBe(family!.id);

    // Verify at database level (check junction table)
    const [dbCheckError, dbResult] = await safeExecute(
      db`
        SELECT COUNT(*) as count
        FROM prayer_request_categories
        WHERE prayer_request_id = ${requestId}::uuid
        AND category_id = ${family!.id}::uuid
      `
    );
    expect(dbCheckError).toBeUndefined();
    expect(parseInt(dbResult![0].count)).toBe(1);
  });
});
