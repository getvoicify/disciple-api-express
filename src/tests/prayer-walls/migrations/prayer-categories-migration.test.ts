import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../../utils/database';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';

describe('Prayer Categories and Supporting Tables Migrations', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  const categoriesMigrationPath = join(process.cwd(), 'migrations', '010_create_prayer_categories.sql');
  const supportingMigrationPath = join(process.cwd(), 'migrations', '011_create_supporting_tables.sql');

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

    // Run prerequisite migrations (001-009) in order
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

  it('should have both migration files at correct locations', async () => {
    const [categoriesError, categoriesSQL] = await safeExecute(() =>
      readFileSync(categoriesMigrationPath, 'utf8')
    );

    expect(categoriesError).toBeUndefined();
    expect(categoriesSQL).toBeDefined();
    expect(categoriesSQL!.length).toBeGreaterThan(0);

    const [supportingError, supportingSQL] = await safeExecute(() =>
      readFileSync(supportingMigrationPath, 'utf8')
    );

    expect(supportingError).toBeUndefined();
    expect(supportingSQL).toBeDefined();
    expect(supportingSQL!.length).toBeGreaterThan(0);
  });

  it('should successfully execute both migrations and create all 6 tables', async () => {
    // Execute migration 010 (categories)
    const [categoriesReadError, categoriesSQL] = await safeExecute(() =>
      readFileSync(categoriesMigrationPath, 'utf8')
    );

    expect(categoriesReadError).toBeUndefined();
    expect(categoriesSQL).toBeDefined();

    const [categoriesMigrationError] = await safeExecute(db.unsafe(categoriesSQL!));
    expect(categoriesMigrationError).toBeUndefined();

    // Execute migration 011 (supporting tables)
    const [supportingReadError, supportingSQL] = await safeExecute(() =>
      readFileSync(supportingMigrationPath, 'utf8')
    );

    expect(supportingReadError).toBeUndefined();
    expect(supportingSQL).toBeDefined();

    const [supportingMigrationError] = await safeExecute(db.unsafe(supportingSQL!));
    expect(supportingMigrationError).toBeUndefined();

    // Verify all 6 tables exist
    const [queryError, tables] = await safeExecute(
      db`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'prayer_categories',
            'prayer_request_categories',
            'prayer_attachments',
            'flagged_content',
            'prayer_read_receipts',
            'notification_preferences'
          )
        ORDER BY table_name
      `
    );

    expect(queryError).toBeUndefined();
    expect(tables).toHaveLength(6);
    expect(tables!.map((t: any) => t.table_name)).toEqual([
      'flagged_content',
      'notification_preferences',
      'prayer_attachments',
      'prayer_categories',
      'prayer_read_receipts',
      'prayer_request_categories',
    ]);
  });

  it('should create prayer_categories table with all required columns and correct data types', async () => {
    const [error, columns] = await safeExecute(
      db`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'prayer_categories'
        ORDER BY ordinal_position
      `
    );

    expect(error).toBeUndefined();
    expect(columns).toBeDefined();

    const columnMap = new Map(
      columns!.map((col: any) => [col.column_name, col])
    );

    // Verify id column
    expect(columnMap.has('id')).toBe(true);
    expect(columnMap.get('id').data_type).toBe('uuid');
    expect(columnMap.get('id').is_nullable).toBe('NO');
    expect(columnMap.get('id').column_default).toContain('gen_random_uuid()');

    // Verify name column
    expect(columnMap.has('name')).toBe(true);
    expect(columnMap.get('name').data_type).toBe('character varying');
    expect(columnMap.get('name').character_maximum_length).toBe(100);
    expect(columnMap.get('name').is_nullable).toBe('NO');

    // Verify church_id column
    expect(columnMap.has('church_id')).toBe(true);
    expect(columnMap.get('church_id').data_type).toBe('uuid');
    expect(columnMap.get('church_id').is_nullable).toBe('YES');

    // Verify is_system_category column
    expect(columnMap.has('is_system_category')).toBe(true);
    expect(columnMap.get('is_system_category').data_type).toBe('boolean');
    expect(columnMap.get('is_system_category').is_nullable).toBe('NO');
    expect(columnMap.get('is_system_category').column_default).toContain('false');

    // Verify timestamp columns
    expect(columnMap.has('created_at')).toBe(true);
    expect(columnMap.get('created_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('created_at').is_nullable).toBe('NO');
    expect(columnMap.get('created_at').column_default).toContain('now()');

    expect(columnMap.has('updated_at')).toBe(true);
    expect(columnMap.get('updated_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('updated_at').is_nullable).toBe('NO');
    expect(columnMap.get('updated_at').column_default).toContain('now()');
  });

  it('should create prayer_request_categories junction table with all required columns', async () => {
    const [error, columns] = await safeExecute(
      db`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'prayer_request_categories'
        ORDER BY ordinal_position
      `
    );

    expect(error).toBeUndefined();
    expect(columns).toBeDefined();

    const columnMap = new Map(
      columns!.map((col: any) => [col.column_name, col])
    );

    // Verify id column
    expect(columnMap.has('id')).toBe(true);
    expect(columnMap.get('id').data_type).toBe('uuid');
    expect(columnMap.get('id').is_nullable).toBe('NO');
    expect(columnMap.get('id').column_default).toContain('gen_random_uuid()');

    // Verify prayer_request_id column
    expect(columnMap.has('prayer_request_id')).toBe(true);
    expect(columnMap.get('prayer_request_id').data_type).toBe('uuid');
    expect(columnMap.get('prayer_request_id').is_nullable).toBe('NO');

    // Verify category_id column
    expect(columnMap.has('category_id')).toBe(true);
    expect(columnMap.get('category_id').data_type).toBe('uuid');
    expect(columnMap.get('category_id').is_nullable).toBe('NO');

    // Verify created_at column
    expect(columnMap.has('created_at')).toBe(true);
    expect(columnMap.get('created_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('created_at').is_nullable).toBe('NO');
    expect(columnMap.get('created_at').column_default).toContain('now()');
  });

  it('should create prayer_attachments table with all required columns and file size constraint', async () => {
    const [error, columns] = await safeExecute(
      db`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'prayer_attachments'
        ORDER BY ordinal_position
      `
    );

    expect(error).toBeUndefined();
    expect(columns).toBeDefined();

    const columnMap = new Map(
      columns!.map((col: any) => [col.column_name, col])
    );

    // Verify id column
    expect(columnMap.has('id')).toBe(true);
    expect(columnMap.get('id').data_type).toBe('uuid');
    expect(columnMap.get('id').is_nullable).toBe('NO');

    // Verify prayer_request_id column
    expect(columnMap.has('prayer_request_id')).toBe(true);
    expect(columnMap.get('prayer_request_id').data_type).toBe('uuid');
    expect(columnMap.get('prayer_request_id').is_nullable).toBe('NO');

    // Verify file_name column
    expect(columnMap.has('file_name')).toBe(true);
    expect(columnMap.get('file_name').data_type).toBe('character varying');
    expect(columnMap.get('file_name').character_maximum_length).toBe(255);
    expect(columnMap.get('file_name').is_nullable).toBe('NO');

    // Verify file_size column
    expect(columnMap.has('file_size')).toBe(true);
    expect(columnMap.get('file_size').data_type).toBe('integer');
    expect(columnMap.get('file_size').is_nullable).toBe('NO');

    // Verify file_type column
    expect(columnMap.has('file_type')).toBe(true);
    expect(columnMap.get('file_type').data_type).toBe('character varying');
    expect(columnMap.get('file_type').character_maximum_length).toBe(100);
    expect(columnMap.get('file_type').is_nullable).toBe('NO');

    // Verify storage_key column
    expect(columnMap.has('storage_key')).toBe(true);
    expect(columnMap.get('storage_key').data_type).toBe('character varying');
    expect(columnMap.get('storage_key').character_maximum_length).toBe(500);
    expect(columnMap.get('storage_key').is_nullable).toBe('NO');

    // Verify uploaded_by column
    expect(columnMap.has('uploaded_by')).toBe(true);
    expect(columnMap.get('uploaded_by').data_type).toBe('uuid');
    expect(columnMap.get('uploaded_by').is_nullable).toBe('NO');

    // Verify created_at column
    expect(columnMap.has('created_at')).toBe(true);
    expect(columnMap.get('created_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('created_at').is_nullable).toBe('NO');
  });

  it('should create flagged_content table with all required columns and status enum', async () => {
    const [error, columns] = await safeExecute(
      db`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'flagged_content'
        ORDER BY ordinal_position
      `
    );

    expect(error).toBeUndefined();
    expect(columns).toBeDefined();

    const columnMap = new Map(
      columns!.map((col: any) => [col.column_name, col])
    );

    // Verify id column
    expect(columnMap.has('id')).toBe(true);
    expect(columnMap.get('id').data_type).toBe('uuid');
    expect(columnMap.get('id').is_nullable).toBe('NO');

    // Verify prayer_request_id column
    expect(columnMap.has('prayer_request_id')).toBe(true);
    expect(columnMap.get('prayer_request_id').data_type).toBe('uuid');
    expect(columnMap.get('prayer_request_id').is_nullable).toBe('NO');

    // Verify flagged_by column
    expect(columnMap.has('flagged_by')).toBe(true);
    expect(columnMap.get('flagged_by').data_type).toBe('uuid');
    expect(columnMap.get('flagged_by').is_nullable).toBe('NO');

    // Verify reason column
    expect(columnMap.has('reason')).toBe(true);
    expect(columnMap.get('reason').data_type).toBe('text');
    expect(columnMap.get('reason').is_nullable).toBe('NO');

    // Verify status column
    expect(columnMap.has('status')).toBe(true);
    expect(columnMap.get('status').data_type).toBe('character varying');
    expect(columnMap.get('status').character_maximum_length).toBe(50);
    expect(columnMap.get('status').is_nullable).toBe('NO');
    expect(columnMap.get('status').column_default).toContain('pending');

    // Verify reviewed_by column
    expect(columnMap.has('reviewed_by')).toBe(true);
    expect(columnMap.get('reviewed_by').data_type).toBe('uuid');
    expect(columnMap.get('reviewed_by').is_nullable).toBe('YES');

    // Verify reviewed_at column
    expect(columnMap.has('reviewed_at')).toBe(true);
    expect(columnMap.get('reviewed_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('reviewed_at').is_nullable).toBe('YES');

    // Verify resolution_action column
    expect(columnMap.has('resolution_action')).toBe(true);
    expect(columnMap.get('resolution_action').data_type).toBe('character varying');
    expect(columnMap.get('resolution_action').character_maximum_length).toBe(50);
    expect(columnMap.get('resolution_action').is_nullable).toBe('YES');

    // Verify resolution_notes column
    expect(columnMap.has('resolution_notes')).toBe(true);
    expect(columnMap.get('resolution_notes').data_type).toBe('text');
    expect(columnMap.get('resolution_notes').is_nullable).toBe('YES');

    // Verify timestamp columns
    expect(columnMap.has('created_at')).toBe(true);
    expect(columnMap.get('created_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('created_at').is_nullable).toBe('NO');

    expect(columnMap.has('updated_at')).toBe(true);
    expect(columnMap.get('updated_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('updated_at').is_nullable).toBe('NO');
  });

  it('should create prayer_read_receipts table with unique constraint on user and request', async () => {
    const [error, columns] = await safeExecute(
      db`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'prayer_read_receipts'
        ORDER BY ordinal_position
      `
    );

    expect(error).toBeUndefined();
    expect(columns).toBeDefined();

    const columnMap = new Map(
      columns!.map((col: any) => [col.column_name, col])
    );

    // Verify id column
    expect(columnMap.has('id')).toBe(true);
    expect(columnMap.get('id').data_type).toBe('uuid');
    expect(columnMap.get('id').is_nullable).toBe('NO');

    // Verify prayer_request_id column
    expect(columnMap.has('prayer_request_id')).toBe(true);
    expect(columnMap.get('prayer_request_id').data_type).toBe('uuid');
    expect(columnMap.get('prayer_request_id').is_nullable).toBe('NO');

    // Verify user_id column
    expect(columnMap.has('user_id')).toBe(true);
    expect(columnMap.get('user_id').data_type).toBe('uuid');
    expect(columnMap.get('user_id').is_nullable).toBe('NO');

    // Verify read_at column
    expect(columnMap.has('read_at')).toBe(true);
    expect(columnMap.get('read_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('read_at').is_nullable).toBe('NO');
    expect(columnMap.get('read_at').column_default).toContain('now()');

    // Verify created_at column
    expect(columnMap.has('created_at')).toBe(true);
    expect(columnMap.get('created_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('created_at').is_nullable).toBe('NO');
  });

  it('should create notification_preferences table with all required columns', async () => {
    const [error, columns] = await safeExecute(
      db`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notification_preferences'
        ORDER BY ordinal_position
      `
    );

    expect(error).toBeUndefined();
    expect(columns).toBeDefined();

    const columnMap = new Map(
      columns!.map((col: any) => [col.column_name, col])
    );

    // Verify id column
    expect(columnMap.has('id')).toBe(true);
    expect(columnMap.get('id').data_type).toBe('uuid');
    expect(columnMap.get('id').is_nullable).toBe('NO');

    // Verify user_id column
    expect(columnMap.has('user_id')).toBe(true);
    expect(columnMap.get('user_id').data_type).toBe('uuid');
    expect(columnMap.get('user_id').is_nullable).toBe('NO');

    // Verify wall_id column
    expect(columnMap.has('wall_id')).toBe(true);
    expect(columnMap.get('wall_id').data_type).toBe('uuid');
    expect(columnMap.get('wall_id').is_nullable).toBe('YES');

    // Verify notification preference columns
    expect(columnMap.has('new_prayers')).toBe(true);
    expect(columnMap.get('new_prayers').data_type).toBe('boolean');
    expect(columnMap.get('new_prayers').is_nullable).toBe('NO');
    expect(columnMap.get('new_prayers').column_default).toContain('true');

    expect(columnMap.has('responses_to_my_prayers')).toBe(true);
    expect(columnMap.get('responses_to_my_prayers').data_type).toBe('boolean');
    expect(columnMap.get('responses_to_my_prayers').is_nullable).toBe('NO');
    expect(columnMap.get('responses_to_my_prayers').column_default).toContain('true');

    expect(columnMap.has('replies_to_my_responses')).toBe(true);
    expect(columnMap.get('replies_to_my_responses').data_type).toBe('boolean');
    expect(columnMap.get('replies_to_my_responses').is_nullable).toBe('NO');
    expect(columnMap.get('replies_to_my_responses').column_default).toContain('true');

    expect(columnMap.has('wall_invitations')).toBe(true);
    expect(columnMap.get('wall_invitations').data_type).toBe('boolean');
    expect(columnMap.get('wall_invitations').is_nullable).toBe('NO');
    expect(columnMap.get('wall_invitations').column_default).toContain('true');

    expect(columnMap.has('moderation_actions')).toBe(true);
    expect(columnMap.get('moderation_actions').data_type).toBe('boolean');
    expect(columnMap.get('moderation_actions').is_nullable).toBe('NO');
    expect(columnMap.get('moderation_actions').column_default).toContain('true');

    // Verify timestamp columns
    expect(columnMap.has('created_at')).toBe(true);
    expect(columnMap.get('created_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('created_at').is_nullable).toBe('NO');

    expect(columnMap.has('updated_at')).toBe(true);
    expect(columnMap.get('updated_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('updated_at').is_nullable).toBe('NO');
  });

  it('should enforce CHECK constraint on prayer_categories name length (1-100 characters)', async () => {
    // Insert valid category name
    const [validError] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, is_system_category)
        VALUES ('Valid Category Name', true)
      `
    );
    expect(validError).toBeUndefined();

    // Test empty name should fail
    const [emptyError] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, is_system_category)
        VALUES ('', true)
      `
    );
    expect(emptyError).toBeDefined();
    expect(emptyError!.message.toLowerCase()).toContain('check');

    // Test name too long (> 100 characters) should fail
    const longName = 'a'.repeat(101);
    const [tooLongError] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, is_system_category)
        VALUES (${longName}, true)
      `
    );
    expect(tooLongError).toBeDefined();
  });

  it('should enforce CHECK constraint on prayer_attachments file_size (1 byte to 10MB)', async () => {
    // First, create test data
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

    const [wallError] = await safeExecute(
      db`
        INSERT INTO prayer_walls (id, church_id, name, created_by)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          'c0000000-0000-0000-0000-000000000001'::uuid,
          'Test Prayer Wall',
          '00000000-0000-0000-0000-000000000001'::uuid
        )
      `
    );
    expect(wallError).toBeUndefined();

    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (id, wall_id, author_id, content)
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Test prayer request'
        )
        RETURNING id
      `
    );
    expect(requestError).toBeUndefined();

    // Test valid file size (1MB)
    const [validError] = await safeExecute(
      db`
        INSERT INTO prayer_attachments (
          prayer_request_id,
          file_name,
          file_size,
          file_type,
          storage_key,
          uploaded_by
        )
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          'valid-file.pdf',
          1048576,
          'application/pdf',
          'uploads/prayer-attachments/valid-file.pdf',
          '00000000-0000-0000-0000-000000000001'::uuid
        )
      `
    );
    expect(validError).toBeUndefined();

    // Test file size of 0 should fail
    const [zeroError] = await safeExecute(
      db`
        INSERT INTO prayer_attachments (
          prayer_request_id,
          file_name,
          file_size,
          file_type,
          storage_key,
          uploaded_by
        )
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          'zero-file.pdf',
          0,
          'application/pdf',
          'uploads/prayer-attachments/zero-file.pdf',
          '00000000-0000-0000-0000-000000000001'::uuid
        )
      `
    );
    expect(zeroError).toBeDefined();
    expect(zeroError!.message.toLowerCase()).toContain('check');

    // Test file size > 10MB (10485760 bytes) should fail
    const [tooLargeError] = await safeExecute(
      db`
        INSERT INTO prayer_attachments (
          prayer_request_id,
          file_name,
          file_size,
          file_type,
          storage_key,
          uploaded_by
        )
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          'too-large.pdf',
          10485761,
          'application/pdf',
          'uploads/prayer-attachments/too-large.pdf',
          '00000000-0000-0000-0000-000000000001'::uuid
        )
      `
    );
    expect(tooLargeError).toBeDefined();
    expect(tooLargeError!.message.toLowerCase()).toContain('check');

    // Test exactly 10MB should succeed
    const [exactError] = await safeExecute(
      db`
        INSERT INTO prayer_attachments (
          prayer_request_id,
          file_name,
          file_size,
          file_type,
          storage_key,
          uploaded_by
        )
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          'exact-10mb.pdf',
          10485760,
          'application/pdf',
          'uploads/prayer-attachments/exact-10mb.pdf',
          '00000000-0000-0000-0000-000000000001'::uuid
        )
      `
    );
    expect(exactError).toBeUndefined();
  });

  it('should enforce CHECK constraint on flagged_content status enum', async () => {
    // Test valid statuses: pending, reviewed, dismissed, actioned
    const validStatuses = ['pending', 'reviewed', 'dismissed', 'actioned'];

    for (const status of validStatuses) {
      const [error] = await safeExecute(
        db`
          INSERT INTO flagged_content (prayer_request_id, flagged_by, reason, status)
          VALUES (
            'b0000000-0000-0000-0000-000000000001'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            'Test flag reason',
            ${status}
          )
        `
      );
      expect(error).toBeUndefined();
    }

    // Test invalid status should fail
    const [invalidError] = await safeExecute(
      db`
        INSERT INTO flagged_content (prayer_request_id, flagged_by, reason, status)
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000003'::uuid,
          'Test flag reason',
          'invalid_status'
        )
      `
    );
    expect(invalidError).toBeDefined();
    expect(invalidError!.message.toLowerCase()).toContain('check');
  });

  it('should enforce CHECK constraint on flagged_content resolution_action enum', async () => {
    // Test valid resolution_actions: delete, restore, warn, ban
    const validActions = ['delete', 'restore', 'warn', 'ban'];

    for (const action of validActions) {
      const [error] = await safeExecute(
        db`
          INSERT INTO flagged_content (
            prayer_request_id,
            flagged_by,
            reason,
            status,
            resolution_action,
            reviewed_by,
            reviewed_at
          )
          VALUES (
            'b0000000-0000-0000-0000-000000000001'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            'Test flag reason',
            'reviewed',
            ${action},
            '00000000-0000-0000-0000-000000000001'::uuid,
            NOW()
          )
        `
      );
      expect(error).toBeUndefined();
    }

    // Test NULL resolution_action should be allowed
    const [nullError] = await safeExecute(
      db`
        INSERT INTO flagged_content (prayer_request_id, flagged_by, reason, status, resolution_action)
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000003'::uuid,
          'Test flag reason',
          'pending',
          NULL
        )
      `
    );
    expect(nullError).toBeUndefined();

    // Test invalid resolution_action should fail
    const [invalidError] = await safeExecute(
      db`
        INSERT INTO flagged_content (
          prayer_request_id,
          flagged_by,
          reason,
          status,
          resolution_action
        )
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000004'::uuid,
          'Test flag reason',
          'reviewed',
          'invalid_action'
        )
      `
    );
    expect(invalidError).toBeDefined();
    expect(invalidError!.message.toLowerCase()).toContain('check');
  });

  it('should enforce UNIQUE constraint on prayer_request_categories (prayer_request_id, category_id)', async () => {
    // Insert a category
    const [categoryError, categoryResult] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, is_system_category)
        VALUES ('Test Category', true)
        RETURNING id
      `
    );
    expect(categoryError).toBeUndefined();
    const categoryId = categoryResult![0].id;

    // Insert first association
    const [firstError] = await safeExecute(
      db`
        INSERT INTO prayer_request_categories (prayer_request_id, category_id)
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          ${categoryId}
        )
      `
    );
    expect(firstError).toBeUndefined();

    // Try to insert duplicate association should fail
    const [duplicateError] = await safeExecute(
      db`
        INSERT INTO prayer_request_categories (prayer_request_id, category_id)
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          ${categoryId}
        )
      `
    );
    expect(duplicateError).toBeDefined();
    expect(duplicateError!.message.toLowerCase()).toContain('unique');
  });

  it('should enforce UNIQUE constraint on prayer_read_receipts (prayer_request_id, user_id)', async () => {
    // Insert first read receipt
    const [firstError] = await safeExecute(
      db`
        INSERT INTO prayer_read_receipts (prayer_request_id, user_id)
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000010'::uuid
        )
      `
    );
    expect(firstError).toBeUndefined();

    // Try to insert duplicate read receipt should fail
    const [duplicateError] = await safeExecute(
      db`
        INSERT INTO prayer_read_receipts (prayer_request_id, user_id)
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000010'::uuid
        )
      `
    );
    expect(duplicateError).toBeDefined();
    expect(duplicateError!.message.toLowerCase()).toContain('unique');
  });

  it('should enforce UNIQUE constraint on notification_preferences (user_id, wall_id)', async () => {
    // Insert first notification preference
    const [firstError] = await safeExecute(
      db`
        INSERT INTO notification_preferences (user_id, wall_id)
        VALUES (
          '00000000-0000-0000-0000-000000000010'::uuid,
          'a0000000-0000-0000-0000-000000000001'::uuid
        )
      `
    );
    expect(firstError).toBeUndefined();

    // Try to insert duplicate notification preference should fail
    const [duplicateError] = await safeExecute(
      db`
        INSERT INTO notification_preferences (user_id, wall_id)
        VALUES (
          '00000000-0000-0000-0000-000000000010'::uuid,
          'a0000000-0000-0000-0000-000000000001'::uuid
        )
      `
    );
    expect(duplicateError).toBeDefined();
    expect(duplicateError!.message.toLowerCase()).toContain('unique');
  });

  it('should create foreign key constraints with CASCADE delete behavior', async () => {
    // Test prayer_request_categories CASCADE on prayer_requests delete
    const [categoryError, categoryResult] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, is_system_category)
        VALUES ('Cascade Test Category', true)
        RETURNING id
      `
    );
    expect(categoryError).toBeUndefined();
    const categoryId = categoryResult![0].id;

    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (id, wall_id, author_id, content)
        VALUES (
          'b0000000-0000-0000-0000-000000000010'::uuid,
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Test request for cascade'
        )
        RETURNING id
      `
    );
    expect(requestError).toBeUndefined();
    const requestId = requestResult![0].id;

    const [assignError] = await safeExecute(
      db`
        INSERT INTO prayer_request_categories (prayer_request_id, category_id)
        VALUES (${requestId}, ${categoryId})
      `
    );
    expect(assignError).toBeUndefined();

    // Verify association exists
    const [beforeDeleteError, beforeDelete] = await safeExecute(
      db`
        SELECT * FROM prayer_request_categories
        WHERE prayer_request_id = ${requestId}
      `
    );
    expect(beforeDeleteError).toBeUndefined();
    expect(beforeDelete).toHaveLength(1);

    // Delete the prayer request
    const [deleteError] = await safeExecute(
      db`DELETE FROM prayer_requests WHERE id = ${requestId}`
    );
    expect(deleteError).toBeUndefined();

    // Verify association was cascaded deleted
    const [afterDeleteError, afterDelete] = await safeExecute(
      db`
        SELECT * FROM prayer_request_categories
        WHERE prayer_request_id = ${requestId}
      `
    );
    expect(afterDeleteError).toBeUndefined();
    expect(afterDelete).toHaveLength(0);
  });

  it('should create required indexes for all 6 tables', async () => {
    // Check prayer_categories indexes
    const [categoriesError, categoriesIndexes] = await safeExecute(
      db`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'prayer_categories'
          AND schemaname = 'public'
        ORDER BY indexname
      `
    );
    expect(categoriesError).toBeUndefined();
    const categoriesIndexNames = categoriesIndexes!.map((idx: any) => idx.indexname);
    expect(categoriesIndexNames.some((name: string) => name.includes('pkey'))).toBe(true);
    expect(
      categoriesIndexNames.some((name: string) => name.includes('church_id')) ||
      categoriesIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('church_id'))
    ).toBe(true);
    expect(
      categoriesIndexNames.some((name: string) => name.includes('is_system_category')) ||
      categoriesIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('is_system_category'))
    ).toBe(true);

    // Check prayer_request_categories indexes
    const [junctionError, junctionIndexes] = await safeExecute(
      db`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'prayer_request_categories'
          AND schemaname = 'public'
        ORDER BY indexname
      `
    );
    expect(junctionError).toBeUndefined();
    const junctionIndexNames = junctionIndexes!.map((idx: any) => idx.indexname);
    expect(junctionIndexNames.some((name: string) => name.includes('pkey'))).toBe(true);
    expect(
      junctionIndexNames.some((name: string) => name.includes('prayer_request_id')) ||
      junctionIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('prayer_request_id'))
    ).toBe(true);
    expect(
      junctionIndexNames.some((name: string) => name.includes('category_id')) ||
      junctionIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('category_id'))
    ).toBe(true);

    // Check prayer_attachments indexes
    const [attachmentsError, attachmentsIndexes] = await safeExecute(
      db`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'prayer_attachments'
          AND schemaname = 'public'
        ORDER BY indexname
      `
    );
    expect(attachmentsError).toBeUndefined();
    const attachmentsIndexNames = attachmentsIndexes!.map((idx: any) => idx.indexname);
    expect(attachmentsIndexNames.some((name: string) => name.includes('pkey'))).toBe(true);
    expect(
      attachmentsIndexNames.some((name: string) => name.includes('prayer_request_id')) ||
      attachmentsIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('prayer_request_id'))
    ).toBe(true);
    expect(
      attachmentsIndexNames.some((name: string) => name.includes('uploaded_by')) ||
      attachmentsIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('uploaded_by'))
    ).toBe(true);

    // Check flagged_content indexes
    const [flaggedError, flaggedIndexes] = await safeExecute(
      db`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'flagged_content'
          AND schemaname = 'public'
        ORDER BY indexname
      `
    );
    expect(flaggedError).toBeUndefined();
    const flaggedIndexNames = flaggedIndexes!.map((idx: any) => idx.indexname);
    expect(flaggedIndexNames.some((name: string) => name.includes('pkey'))).toBe(true);
    expect(
      flaggedIndexNames.some((name: string) => name.includes('prayer_request_id')) ||
      flaggedIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('prayer_request_id'))
    ).toBe(true);
    expect(
      flaggedIndexNames.some((name: string) => name.includes('status')) ||
      flaggedIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('status'))
    ).toBe(true);

    // Check prayer_read_receipts indexes
    const [receiptsError, receiptsIndexes] = await safeExecute(
      db`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'prayer_read_receipts'
          AND schemaname = 'public'
        ORDER BY indexname
      `
    );
    expect(receiptsError).toBeUndefined();
    const receiptsIndexNames = receiptsIndexes!.map((idx: any) => idx.indexname);
    expect(receiptsIndexNames.some((name: string) => name.includes('pkey'))).toBe(true);
    expect(
      receiptsIndexNames.some((name: string) => name.includes('prayer_request_id')) ||
      receiptsIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('prayer_request_id'))
    ).toBe(true);
    expect(
      receiptsIndexNames.some((name: string) => name.includes('user_id')) ||
      receiptsIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('user_id'))
    ).toBe(true);

    // Check notification_preferences indexes
    const [prefsError, prefsIndexes] = await safeExecute(
      db`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'notification_preferences'
          AND schemaname = 'public'
        ORDER BY indexname
      `
    );
    expect(prefsError).toBeUndefined();
    const prefsIndexNames = prefsIndexes!.map((idx: any) => idx.indexname);
    expect(prefsIndexNames.some((name: string) => name.includes('pkey'))).toBe(true);
    expect(
      prefsIndexNames.some((name: string) => name.includes('user_id')) ||
      prefsIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('user_id'))
    ).toBe(true);
    expect(
      prefsIndexNames.some((name: string) => name.includes('wall_id')) ||
      prefsIndexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('wall_id'))
    ).toBe(true);
  });

  it('should automatically update updated_at timestamp via trigger for prayer_categories', async () => {
    const [insertError, insertResult] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, is_system_category)
        VALUES ('Category For Update Test', true)
        RETURNING id, created_at, updated_at
      `
    );
    expect(insertError).toBeUndefined();

    const categoryId = insertResult![0].id;
    const originalUpdatedAt = insertResult![0].updated_at;

    // Wait to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update the category
    const [updateError] = await safeExecute(
      db`
        UPDATE prayer_categories
        SET name = 'Updated Category Name'
        WHERE id = ${categoryId}
      `
    );
    expect(updateError).toBeUndefined();

    // Query the updated row
    const [queryError, rows] = await safeExecute(
      db`
        SELECT updated_at FROM prayer_categories WHERE id = ${categoryId}
      `
    );

    expect(queryError).toBeUndefined();
    expect(rows).toHaveLength(1);

    const newUpdatedAt = rows![0].updated_at;

    // Verify updated_at was automatically updated
    expect(newUpdatedAt).toBeInstanceOf(Date);
    expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should automatically update updated_at timestamp via trigger for flagged_content', async () => {
    const [insertError, insertResult] = await safeExecute(
      db`
        INSERT INTO flagged_content (prayer_request_id, flagged_by, reason, status)
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000020'::uuid,
          'Initial flag reason',
          'pending'
        )
        RETURNING id, created_at, updated_at
      `
    );
    expect(insertError).toBeUndefined();

    const flagId = insertResult![0].id;
    const originalUpdatedAt = insertResult![0].updated_at;

    // Wait to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update the flagged content
    const [updateError] = await safeExecute(
      db`
        UPDATE flagged_content
        SET status = 'reviewed',
            reviewed_by = '00000000-0000-0000-0000-000000000001'::uuid,
            reviewed_at = NOW()
        WHERE id = ${flagId}
      `
    );
    expect(updateError).toBeUndefined();

    // Query the updated row
    const [queryError, rows] = await safeExecute(
      db`
        SELECT updated_at FROM flagged_content WHERE id = ${flagId}
      `
    );

    expect(queryError).toBeUndefined();
    expect(rows).toHaveLength(1);

    const newUpdatedAt = rows![0].updated_at;

    // Verify updated_at was automatically updated
    expect(newUpdatedAt).toBeInstanceOf(Date);
    expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should automatically update updated_at timestamp via trigger for notification_preferences', async () => {
    const [insertError, insertResult] = await safeExecute(
      db`
        INSERT INTO notification_preferences (user_id, wall_id)
        VALUES (
          '00000000-0000-0000-0000-000000000030'::uuid,
          'a0000000-0000-0000-0000-000000000001'::uuid
        )
        RETURNING id, created_at, updated_at
      `
    );
    expect(insertError).toBeUndefined();

    const prefId = insertResult![0].id;
    const originalUpdatedAt = insertResult![0].updated_at;

    // Wait to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update the notification preferences
    const [updateError] = await safeExecute(
      db`
        UPDATE notification_preferences
        SET new_prayers = false,
            responses_to_my_prayers = false
        WHERE id = ${prefId}
      `
    );
    expect(updateError).toBeUndefined();

    // Query the updated row
    const [queryError, rows] = await safeExecute(
      db`
        SELECT updated_at FROM notification_preferences WHERE id = ${prefId}
      `
    );

    expect(queryError).toBeUndefined();
    expect(rows).toHaveLength(1);

    const newUpdatedAt = rows![0].updated_at;

    // Verify updated_at was automatically updated
    expect(newUpdatedAt).toBeInstanceOf(Date);
    expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should differentiate between system and custom categories using is_system_category flag', async () => {
    // Insert system category
    const [systemError, systemResult] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, is_system_category)
        VALUES ('Health & Healing', true)
        RETURNING id, is_system_category
      `
    );
    expect(systemError).toBeUndefined();
    expect(systemResult![0].is_system_category).toBe(true);

    // Insert custom category for church
    const [customError, customResult] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, church_id, is_system_category)
        VALUES (
          'Church Building Project',
          'c0000000-0000-0000-0000-000000000001'::uuid,
          false
        )
        RETURNING id, is_system_category, church_id
      `
    );
    expect(customError).toBeUndefined();
    expect(customResult![0].is_system_category).toBe(false);
    expect(customResult![0].church_id).toBe('c0000000-0000-0000-0000-000000000001');

    // Query to verify separation
    const [systemQueryError, systemCategories] = await safeExecute(
      db`
        SELECT * FROM prayer_categories
        WHERE is_system_category = true
      `
    );
    expect(systemQueryError).toBeUndefined();
    expect(systemCategories!.length).toBeGreaterThanOrEqual(1);

    const [customQueryError, customCategories] = await safeExecute(
      db`
        SELECT * FROM prayer_categories
        WHERE is_system_category = false AND church_id = 'c0000000-0000-0000-0000-000000000001'::uuid
      `
    );
    expect(customQueryError).toBeUndefined();
    expect(customCategories!.length).toBeGreaterThanOrEqual(1);
  });

  it('should support many-to-many relationship between prayer_requests and categories', async () => {
    // Create multiple categories
    const [cat1Error, cat1Result] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, is_system_category)
        VALUES ('Health', true)
        RETURNING id
      `
    );
    expect(cat1Error).toBeUndefined();
    const category1Id = cat1Result![0].id;

    const [cat2Error, cat2Result] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, is_system_category)
        VALUES ('Family', true)
        RETURNING id
      `
    );
    expect(cat2Error).toBeUndefined();
    const category2Id = cat2Result![0].id;

    const [cat3Error, cat3Result] = await safeExecute(
      db`
        INSERT INTO prayer_categories (name, is_system_category)
        VALUES ('Work', true)
        RETURNING id
      `
    );
    expect(cat3Error).toBeUndefined();
    const category3Id = cat3Result![0].id;

    // Create a prayer request
    const [requestError, requestResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (id, wall_id, author_id, content)
        VALUES (
          'b0000000-0000-0000-0000-000000000020'::uuid,
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Prayer about health and family'
        )
        RETURNING id
      `
    );
    expect(requestError).toBeUndefined();
    const requestId = requestResult![0].id;

    // Assign multiple categories to the prayer request
    const [assign1Error] = await safeExecute(
      db`
        INSERT INTO prayer_request_categories (prayer_request_id, category_id)
        VALUES (${requestId}, ${category1Id})
      `
    );
    expect(assign1Error).toBeUndefined();

    const [assign2Error] = await safeExecute(
      db`
        INSERT INTO prayer_request_categories (prayer_request_id, category_id)
        VALUES (${requestId}, ${category2Id})
      `
    );
    expect(assign2Error).toBeUndefined();

    // Query all categories for this prayer request
    const [queryError, categories] = await safeExecute(
      db`
        SELECT pc.*
        FROM prayer_categories pc
        INNER JOIN prayer_request_categories prc ON pc.id = prc.category_id
        WHERE prc.prayer_request_id = ${requestId}
        ORDER BY pc.name
      `
    );

    expect(queryError).toBeUndefined();
    expect(categories).toHaveLength(2);
    expect(categories![0].name).toBe('Family');
    expect(categories![1].name).toBe('Health');
  });

  it('should support flagged content workflow with status transitions', async () => {
    // Create flagged content in pending status
    const [createError, createResult] = await safeExecute(
      db`
        INSERT INTO flagged_content (
          prayer_request_id,
          flagged_by,
          reason,
          status
        )
        VALUES (
          'b0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000050'::uuid,
          'Inappropriate content',
          'pending'
        )
        RETURNING id, status
      `
    );
    expect(createError).toBeUndefined();
    expect(createResult![0].status).toBe('pending');
    const flagId = createResult![0].id;

    // Transition to reviewed status with resolution action
    const [reviewError] = await safeExecute(
      db`
        UPDATE flagged_content
        SET status = 'reviewed',
            reviewed_by = '00000000-0000-0000-0000-000000000001'::uuid,
            reviewed_at = NOW(),
            resolution_action = 'warn',
            resolution_notes = 'User has been warned about content policy'
        WHERE id = ${flagId}
      `
    );
    expect(reviewError).toBeUndefined();

    // Verify the review was recorded
    const [queryError, rows] = await safeExecute(
      db`SELECT * FROM flagged_content WHERE id = ${flagId}`
    );

    expect(queryError).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows![0].status).toBe('reviewed');
    expect(rows![0].reviewed_by).toBe('00000000-0000-0000-0000-000000000001');
    expect(rows![0].reviewed_at).toBeInstanceOf(Date);
    expect(rows![0].resolution_action).toBe('warn');
    expect(rows![0].resolution_notes).toBe('User has been warned about content policy');
  });

  it('should track read receipts per user per prayer request', async () => {
    const user1 = '00000000-0000-0000-0000-000000000060';
    const user2 = '00000000-0000-0000-0000-000000000061';
    const user3 = '00000000-0000-0000-0000-000000000062';

    // Create multiple prayer requests
    const [req1Error, req1Result] = await safeExecute(
      db`
        INSERT INTO prayer_requests (id, wall_id, author_id, content)
        VALUES (
          'b0000000-0000-0000-0000-000000000030'::uuid,
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'First prayer'
        )
        RETURNING id
      `
    );
    expect(req1Error).toBeUndefined();
    const request1Id = req1Result![0].id;

    const [req2Error, req2Result] = await safeExecute(
      db`
        INSERT INTO prayer_requests (id, wall_id, author_id, content)
        VALUES (
          'b0000000-0000-0000-0000-000000000031'::uuid,
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Second prayer'
        )
        RETURNING id
      `
    );
    expect(req2Error).toBeUndefined();
    const request2Id = req2Result![0].id;

    // User 1 reads both prayers
    const [u1r1Error] = await safeExecute(
      db`
        INSERT INTO prayer_read_receipts (prayer_request_id, user_id)
        VALUES (${request1Id}, ${user1}::uuid)
      `
    );
    expect(u1r1Error).toBeUndefined();

    const [u1r2Error] = await safeExecute(
      db`
        INSERT INTO prayer_read_receipts (prayer_request_id, user_id)
        VALUES (${request2Id}, ${user1}::uuid)
      `
    );
    expect(u1r2Error).toBeUndefined();

    // User 2 reads only first prayer
    const [u2r1Error] = await safeExecute(
      db`
        INSERT INTO prayer_read_receipts (prayer_request_id, user_id)
        VALUES (${request1Id}, ${user2}::uuid)
      `
    );
    expect(u2r1Error).toBeUndefined();

    // Query read count for first prayer
    const [queryError, readReceipts] = await safeExecute(
      db`
        SELECT COUNT(*) as read_count
        FROM prayer_read_receipts
        WHERE prayer_request_id = ${request1Id}
      `
    );

    expect(queryError).toBeUndefined();
    expect(Number(readReceipts![0].read_count)).toBe(2);

    // Query which prayers user 1 has read
    const [user1QueryError, user1Receipts] = await safeExecute(
      db`
        SELECT prayer_request_id
        FROM prayer_read_receipts
        WHERE user_id = ${user1}::uuid
        ORDER BY created_at
      `
    );

    expect(user1QueryError).toBeUndefined();
    expect(user1Receipts).toHaveLength(2);
  });

  it('should manage notification preferences per user per wall with all preference flags', async () => {
    const userId = '00000000-0000-0000-0000-000000000070';
    const wallId = 'a0000000-0000-0000-0000-000000000001';

    // Create notification preferences with all defaults (all true)
    const [createError, createResult] = await safeExecute(
      db`
        INSERT INTO notification_preferences (user_id, wall_id)
        VALUES (${userId}::uuid, ${wallId}::uuid)
        RETURNING *
      `
    );
    expect(createError).toBeUndefined();

    // Verify all defaults are true
    const prefs = createResult![0];
    expect(prefs.new_prayers).toBe(true);
    expect(prefs.responses_to_my_prayers).toBe(true);
    expect(prefs.replies_to_my_responses).toBe(true);
    expect(prefs.wall_invitations).toBe(true);
    expect(prefs.moderation_actions).toBe(true);

    // Update some preferences
    const [updateError] = await safeExecute(
      db`
        UPDATE notification_preferences
        SET new_prayers = false,
            wall_invitations = false
        WHERE user_id = ${userId}::uuid
          AND wall_id = ${wallId}::uuid
      `
    );
    expect(updateError).toBeUndefined();

    // Verify updated preferences
    const [queryError, rows] = await safeExecute(
      db`
        SELECT * FROM notification_preferences
        WHERE user_id = ${userId}::uuid
          AND wall_id = ${wallId}::uuid
      `
    );

    expect(queryError).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows![0].new_prayers).toBe(false);
    expect(rows![0].responses_to_my_prayers).toBe(true);
    expect(rows![0].replies_to_my_responses).toBe(true);
    expect(rows![0].wall_invitations).toBe(false);
    expect(rows![0].moderation_actions).toBe(true);
  });
});