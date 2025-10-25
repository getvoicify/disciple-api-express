import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../../utils/database';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';

describe('System Prayer Categories Seed Migration', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  const seedMigrationPath = join(process.cwd(), 'migrations', '013_seed_system_categories.sql');

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

    // Run prerequisite migrations (001-012) in order
    const prerequisiteMigrations = [
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
    ];

    for (const migration of prerequisiteMigrations) {
      const migrationFilePath = join(process.cwd(), 'migrations', migration);
      const [readError, migrationSQL] = await safeExecute(() =>
        readFileSync(migrationFilePath, 'utf8')
      );

      if (readError) {
        logger.error({ error: readError, migration }, 'Failed to read prerequisite migration');
        throw readError;
      }

      const [execError] = await safeExecute(db.unsafe(migrationSQL!));

      if (execError) {
        logger.error({ error: execError, migration }, 'Failed to execute prerequisite migration');
        throw execError;
      }
    }

    logger.info('All prerequisite migrations executed successfully');
  }, 60000); // Increase timeout for container startup and migrations

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

  it('should have seed migration file at correct location', async () => {
    const [error, migrationSQL] = await safeExecute(() =>
      readFileSync(seedMigrationPath, 'utf8')
    );

    expect(error).toBeUndefined();
    expect(migrationSQL).toBeDefined();
    expect(migrationSQL!.length).toBeGreaterThan(0);
  });

  it('should successfully execute the seed migration and create exactly 5 system categories', async () => {
    const [readError, migrationSQL] = await safeExecute(() =>
      readFileSync(seedMigrationPath, 'utf8')
    );

    expect(readError).toBeUndefined();
    expect(migrationSQL).toBeDefined();

    // Execute the migration
    const [migrationError] = await safeExecute(db.unsafe(migrationSQL!));
    expect(migrationError).toBeUndefined();

    // Verify exactly 5 system categories exist
    const [queryError, categories] = await safeExecute(
      db`
        SELECT id, name, is_system_category, church_id
        FROM prayer_categories
        WHERE is_system_category = true
        ORDER BY name
      `
    );

    expect(queryError).toBeUndefined();
    expect(categories).toHaveLength(5);
  });

  it('should seed the 5 required system categories with correct names', async () => {
    const [error, categories] = await safeExecute(
      db`
        SELECT name
        FROM prayer_categories
        WHERE is_system_category = true
        ORDER BY name
      `
    );

    expect(error).toBeUndefined();
    expect(categories).toBeDefined();

    const categoryNames = categories!.map((cat: any) => cat.name);

    // Verify the 5 required system categories
    expect(categoryNames).toContain('Healing');
    expect(categoryNames).toContain('Guidance');
    expect(categoryNames).toContain('Thanksgiving');
    expect(categoryNames).toContain('Intercession');
    expect(categoryNames).toContain('Family');
  });

  it('should set is_system_category flag to true for all seeded categories', async () => {
    const [error, categories] = await safeExecute(
      db`
        SELECT name, is_system_category
        FROM prayer_categories
        WHERE name IN ('Healing', 'Guidance', 'Thanksgiving', 'Intercession', 'Family')
        ORDER BY name
      `
    );

    expect(error).toBeUndefined();
    expect(categories).toHaveLength(5);

    // Verify all have is_system_category = true
    for (const category of categories!) {
      expect(category.is_system_category).toBe(true);
    }
  });

  it('should set church_id to NULL for all system categories', async () => {
    const [error, categories] = await safeExecute(
      db`
        SELECT name, church_id
        FROM prayer_categories
        WHERE is_system_category = true
        ORDER BY name
      `
    );

    expect(error).toBeUndefined();
    expect(categories).toHaveLength(5);

    // Verify all have church_id IS NULL
    for (const category of categories!) {
      expect(category.church_id).toBeNull();
    }
  });

  it('should create system categories with proper timestamps', async () => {
    const [error, categories] = await safeExecute(
      db`
        SELECT name, created_at, updated_at
        FROM prayer_categories
        WHERE is_system_category = true
        ORDER BY name
      `
    );

    expect(error).toBeUndefined();
    expect(categories).toHaveLength(5);

    // Verify all have valid timestamps
    for (const category of categories!) {
      expect(category.created_at).toBeInstanceOf(Date);
      expect(category.updated_at).toBeInstanceOf(Date);
      expect(category.created_at.getTime()).toBeLessThanOrEqual(category.updated_at.getTime());
    }
  });

  it('should be idempotent - running migration twice should not create duplicates', async () => {
    // First, verify we have exactly 5 system categories
    const [beforeError, beforeCategories] = await safeExecute(
      db`
        SELECT COUNT(*) as count
        FROM prayer_categories
        WHERE is_system_category = true
      `
    );

    expect(beforeError).toBeUndefined();
    expect(Number(beforeCategories![0].count)).toBe(5);

    // Run the migration again
    const [readError, migrationSQL] = await safeExecute(() =>
      readFileSync(seedMigrationPath, 'utf8')
    );

    expect(readError).toBeUndefined();

    const [migrationError] = await safeExecute(db.unsafe(migrationSQL!));

    // Migration should either succeed (if using ON CONFLICT DO NOTHING) or fail with unique constraint
    if (migrationError) {
      // If there's an error, it should be an expected idempotency error, not a syntax or permission error
      expect(migrationError.message).toMatch(/duplicate key|unique constraint|violates unique/i);
    }
    const [afterError, afterCategories] = await safeExecute(
      db`
        SELECT COUNT(*) as count
        FROM prayer_categories
        WHERE is_system_category = true
      `
    );

    expect(afterError).toBeUndefined();
    expect(Number(afterCategories![0].count)).toBe(5);
  });

  it('should allow system categories to be queried alongside church-specific categories', async () => {
    // Insert a test church
    const [churchError] = await safeExecute(
      db`
        INSERT INTO churches (id, slug, name, created_by)
        VALUES (
          'c0000000-0000-0000-0000-000000000001'::uuid,
          'test-church',
          'Test Church',
          '00000000-0000-0000-0000-000000000001'::uuid
        )
      `
    );
    expect(churchError).toBeUndefined();

    // Insert a church-specific category
    const [customCategoryError] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, church_id, is_system_category)
        VALUES (
          'Church Building Project',
          'c0000000-0000-0000-0000-000000000001'::uuid,
          false
        )
      `
    );
    expect(customCategoryError).toBeUndefined();

    // Query all categories available to this church (system + church-specific)
    const [queryError, availableCategories] = await safeExecute(
      db`
        SELECT name, is_system_category, church_id
        FROM prayer_categories
        WHERE is_system_category = true
           OR church_id = 'c0000000-0000-0000-0000-000000000001'::uuid
        ORDER BY name
      `
    );

    expect(queryError).toBeUndefined();
    expect(availableCategories).toBeDefined();
    expect(availableCategories!.length).toBe(6); // 5 system + 1 custom

    // Verify mix of system and church-specific categories
    const systemCount = availableCategories!.filter((cat: any) => cat.is_system_category).length;
    const customCount = availableCategories!.filter((cat: any) => !cat.is_system_category).length;

    expect(systemCount).toBe(5);
    expect(customCount).toBe(1);
  });
});