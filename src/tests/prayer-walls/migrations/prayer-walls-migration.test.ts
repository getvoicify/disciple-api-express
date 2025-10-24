import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../../utils/database';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';

describe('Prayer Walls Table Migration', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  const migrationPath = join(process.cwd(), 'migrations', '008_create_prayer_walls.sql');

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

    // Run prerequisite migrations (001-007) in order
    const prerequisiteMigrations = [
      '001_create_notes_table.sql',
      '002_create_churches_tables.sql',
      '003_create_outbox_tables.sql',
      '004_create_media_table.sql',
      '005_create_posts_table.sql',
      '006_create_series_table.sql',
      '007_create_gallery_tables.sql',
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

  it('should have prayer_walls migration file at correct location', async () => {
    const [error, migrationSQL] = await safeExecute(() =>
      readFileSync(migrationPath, 'utf8')
    );

    expect(error).toBeUndefined();
    expect(migrationSQL).toBeDefined();
    expect(migrationSQL!.length).toBeGreaterThan(0);
  });

  it('should successfully execute the migration and create prayer_walls table', async () => {
    const [readError, migrationSQL] = await safeExecute(() =>
      readFileSync(migrationPath, 'utf8')
    );

    expect(readError).toBeUndefined();
    expect(migrationSQL).toBeDefined();

    // Execute the migration
    const [migrationError] = await safeExecute(db.unsafe(migrationSQL!));
    expect(migrationError).toBeUndefined();

    // Verify table exists
    const [queryError, tables] = await safeExecute(
      db`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'prayer_walls'
      `
    );

    expect(queryError).toBeUndefined();
    expect(tables).toHaveLength(1);
    expect(tables![0].table_name).toBe('prayer_walls');
  });

  it('should create prayer_walls table with all required columns and correct data types', async () => {
    const [error, columns] = await safeExecute(
      db`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'prayer_walls'
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

    // Verify church_id column
    expect(columnMap.has('church_id')).toBe(true);
    expect(columnMap.get('church_id').data_type).toBe('uuid');
    expect(columnMap.get('church_id').is_nullable).toBe('NO');

    // Verify name column
    expect(columnMap.has('name')).toBe(true);
    expect(columnMap.get('name').data_type).toBe('character varying');
    expect(columnMap.get('name').character_maximum_length).toBe(255);
    expect(columnMap.get('name').is_nullable).toBe('NO');

    // Verify description column
    expect(columnMap.has('description')).toBe(true);
    expect(columnMap.get('description').data_type).toBe('text');
    expect(columnMap.get('description').is_nullable).toBe('YES');

    // Verify created_by column
    expect(columnMap.has('created_by')).toBe(true);
    expect(columnMap.get('created_by').data_type).toBe('uuid');
    expect(columnMap.get('created_by').is_nullable).toBe('NO');

    // Verify is_private column
    expect(columnMap.has('is_private')).toBe(true);
    expect(columnMap.get('is_private').data_type).toBe('boolean');
    expect(columnMap.get('is_private').column_default).toContain('false');

    // Verify has_restricted_access column
    expect(columnMap.has('has_restricted_access')).toBe(true);
    expect(columnMap.get('has_restricted_access').data_type).toBe('boolean');
    expect(columnMap.get('has_restricted_access').column_default).toContain('false');

    // Verify schedule column (JSONB)
    expect(columnMap.has('schedule')).toBe(true);
    expect(columnMap.get('schedule').data_type).toBe('jsonb');
    expect(columnMap.get('schedule').is_nullable).toBe('YES');

    // Verify video_call_link column
    expect(columnMap.has('video_call_link')).toBe(true);
    expect(columnMap.get('video_call_link').data_type).toBe('character varying');
    expect(columnMap.get('video_call_link').character_maximum_length).toBe(500);
    expect(columnMap.get('video_call_link').is_nullable).toBe('YES');

    // Verify status column
    expect(columnMap.has('status')).toBe(true);
    expect(columnMap.get('status').data_type).toBe('character varying');
    expect(columnMap.get('status').character_maximum_length).toBe(50);
    expect(columnMap.get('status').column_default).toContain('active');

    // Verify timestamp columns
    expect(columnMap.has('created_at')).toBe(true);
    expect(columnMap.get('created_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('created_at').is_nullable).toBe('NO');
    expect(columnMap.get('created_at').column_default).toContain('now()');

    expect(columnMap.has('updated_at')).toBe(true);
    expect(columnMap.get('updated_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('updated_at').is_nullable).toBe('NO');
    expect(columnMap.get('updated_at').column_default).toContain('now()');

    // Verify deleted_at column (soft delete)
    expect(columnMap.has('deleted_at')).toBe(true);
    expect(columnMap.get('deleted_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('deleted_at').is_nullable).toBe('YES');
  });

  it('should create foreign key constraint to churches table', async () => {
    const [error, constraints] = await safeExecute(
      db`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'prayer_walls'
          AND kcu.column_name = 'church_id'
      `
    );

    expect(error).toBeUndefined();
    expect(constraints).toHaveLength(1);
    expect(constraints![0].foreign_table_name).toBe('churches');
    expect(constraints![0].foreign_column_name).toBe('id');
  });

  it('should create CHECK constraint for status enum (active, archived)', async () => {
    const [error, constraints] = await safeExecute(
      db`
        SELECT
          con.conname AS constraint_name,
          pg_get_constraintdef(con.oid) AS check_clause
        FROM pg_catalog.pg_constraint con
        INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'prayer_walls'
          AND con.contype = 'c'
          AND con.conname = 'check_status'
      `
    );

    expect(error).toBeUndefined();
    expect(constraints).toHaveLength(1);

    const checkClause = constraints![0].check_clause.toLowerCase();
    expect(checkClause).toContain('status');
    expect(checkClause).toContain('active');
    expect(checkClause).toContain('archived');
  });

  it('should create required indexes for performance optimization', async () => {
    const [error, indexes] = await safeExecute(
      db`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = 'prayer_walls'
          AND schemaname = 'public'
        ORDER BY indexname
      `
    );

    expect(error).toBeUndefined();
    expect(indexes).toBeDefined();

    const indexNames = indexes!.map((idx: any) => idx.indexname);

    // Primary key index
    expect(indexNames.some((name: string) => name.includes('pkey'))).toBe(true);

    // Check for church_id index
    expect(
      indexNames.some((name: string) => name.includes('church_id')) ||
      indexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('church_id'))
    ).toBe(true);

    // Check for created_by index
    expect(
      indexNames.some((name: string) => name.includes('created_by')) ||
      indexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('created_by'))
    ).toBe(true);

    // Check for created_at index
    expect(
      indexNames.some((name: string) => name.includes('created_at')) ||
      indexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('created_at'))
    ).toBe(true);

    // Check for deleted_at index
    expect(
      indexNames.some((name: string) => name.includes('deleted_at')) ||
      indexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('deleted_at'))
    ).toBe(true);

    // Check for status index
    expect(
      indexNames.some((name: string) => name.includes('status')) ||
      indexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('status'))
    ).toBe(true);
  });

  it('should insert a row with default values correctly', async () => {
    // Insert a test church first (required for foreign key)
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

    // Insert prayer wall with minimal required fields
    const [insertError] = await safeExecute(
      db`
        INSERT INTO prayer_walls (church_id, name, created_by)
        VALUES (
          'c0000000-0000-0000-0000-000000000001'::uuid,
          'Test Prayer Wall',
          '00000000-0000-0000-0000-000000000001'::uuid
        )
      `
    );
    expect(insertError).toBeUndefined();

    // Query the inserted row
    const [queryError, rows] = await safeExecute(
      db`
        SELECT * FROM prayer_walls
        WHERE name = 'Test Prayer Wall'
      `
    );

    expect(queryError).toBeUndefined();
    expect(rows).toHaveLength(1);

    const wall = rows![0];

    // Verify defaults
    expect(wall.id).toBeDefined();
    expect(wall.is_private).toBe(false);
    expect(wall.has_restricted_access).toBe(false);
    expect(wall.status).toBe('active');
    expect(wall.created_at).toBeInstanceOf(Date);
    expect(wall.updated_at).toBeInstanceOf(Date);
    expect(wall.deleted_at).toBeNull();
  });

  it('should support soft-delete behavior with deleted_at column', async () => {
    // Insert a prayer wall
    const [insertError] = await safeExecute(
      db`
        INSERT INTO prayer_walls (church_id, name, created_by)
        VALUES (
          'c0000000-0000-0000-0000-000000000001'::uuid,
          'Wall To Delete',
          '00000000-0000-0000-0000-000000000001'::uuid
        )
        RETURNING id
      `
    );
    expect(insertError).toBeUndefined();

    // Soft delete the wall by setting deleted_at
    const [updateError] = await safeExecute(
      db`
        UPDATE prayer_walls
        SET deleted_at = NOW()
        WHERE name = 'Wall To Delete'
      `
    );
    expect(updateError).toBeUndefined();

    // Verify the row still exists in the table
    const [queryError, rows] = await safeExecute(
      db`
        SELECT * FROM prayer_walls
        WHERE name = 'Wall To Delete'
      `
    );

    expect(queryError).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows![0].deleted_at).not.toBeNull();
    expect(rows![0].deleted_at).toBeInstanceOf(Date);

    // Verify it can be filtered out in queries
    const [activeQueryError, activeRows] = await safeExecute(
      db`
        SELECT * FROM prayer_walls
        WHERE name = 'Wall To Delete' AND deleted_at IS NULL
      `
    );

    expect(activeQueryError).toBeUndefined();
    expect(activeRows).toHaveLength(0);
  });

  it('should automatically update updated_at timestamp via trigger', async () => {
    // Insert a prayer wall
    const [insertError, insertResult] = await safeExecute(
      db`
        INSERT INTO prayer_walls (church_id, name, created_by)
        VALUES (
          'c0000000-0000-0000-0000-000000000001'::uuid,
          'Wall For Update Test',
          '00000000-0000-0000-0000-000000000001'::uuid
        )
        RETURNING id, created_at, updated_at
      `
    );
    expect(insertError).toBeUndefined();

    const wallId = insertResult![0].id;
    const originalUpdatedAt = insertResult![0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update the wall
    const [updateError] = await safeExecute(
      db`
        UPDATE prayer_walls
        SET name = 'Updated Wall Name'
        WHERE id = ${wallId}
      `
    );
    expect(updateError).toBeUndefined();

    // Query the updated row
    const [queryError, rows] = await safeExecute(
      db`
        SELECT updated_at FROM prayer_walls WHERE id = ${wallId}
      `
    );

    expect(queryError).toBeUndefined();
    expect(rows).toHaveLength(1);

    const newUpdatedAt = rows![0].updated_at;

    // Verify updated_at was automatically updated by trigger
    expect(newUpdatedAt).toBeInstanceOf(Date);
    expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});