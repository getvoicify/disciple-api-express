import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../../utils/database';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';

describe('Prayer Requests and Memberships Tables Migration', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  const migrationPath = join(process.cwd(), 'migrations', '009_create_prayer_requests.sql');

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

    // Run prerequisite migrations (001-008) in order
    const prerequisiteMigrations = [
      '001_create_notes_table.sql',
      '002_create_churches_tables.sql',
      '003_create_outbox_tables.sql',
      '004_create_media_table.sql',
      '005_create_posts_table.sql',
      '006_create_series_table.sql',
      '007_create_gallery_tables.sql',
      '008_create_prayer_walls.sql',
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

  it('should have prayer_requests migration file at correct location', async () => {
    const [error, migrationSQL] = await safeExecute(() =>
      readFileSync(migrationPath, 'utf8')
    );

    expect(error).toBeUndefined();
    expect(migrationSQL).toBeDefined();
    expect(migrationSQL!.length).toBeGreaterThan(0);
  });

  it('should successfully execute migration and create both tables', async () => {
    const [readError, migrationSQL] = await safeExecute(() =>
      readFileSync(migrationPath, 'utf8')
    );

    expect(readError).toBeUndefined();
    expect(migrationSQL).toBeDefined();

    // Execute the migration
    const [migrationError] = await safeExecute(db.unsafe(migrationSQL!));
    expect(migrationError).toBeUndefined();

    // Verify both tables exist
    const [queryError, tables] = await safeExecute(
      db`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('prayer_requests', 'prayer_wall_memberships')
        ORDER BY table_name
      `
    );

    expect(queryError).toBeUndefined();
    expect(tables).toHaveLength(2);
    expect(tables![0].table_name).toBe('prayer_requests');
    expect(tables![1].table_name).toBe('prayer_wall_memberships');
  });

  it('should create prayer_requests table with all required columns and correct data types', async () => {
    const [error, columns] = await safeExecute(
      db`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'prayer_requests'
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

    // Verify wall_id column
    expect(columnMap.has('wall_id')).toBe(true);
    expect(columnMap.get('wall_id').data_type).toBe('uuid');
    expect(columnMap.get('wall_id').is_nullable).toBe('NO');

    // Verify author_id column
    expect(columnMap.has('author_id')).toBe(true);
    expect(columnMap.get('author_id').data_type).toBe('uuid');
    expect(columnMap.get('author_id').is_nullable).toBe('NO');

    // Verify content column
    expect(columnMap.has('content')).toBe(true);
    expect(columnMap.get('content').data_type).toBe('text');
    expect(columnMap.get('content').is_nullable).toBe('NO');

    // Verify anonymity_level column
    expect(columnMap.has('anonymity_level')).toBe(true);
    expect(columnMap.get('anonymity_level').data_type).toBe('character varying');
    expect(columnMap.get('anonymity_level').character_maximum_length).toBe(50);
    expect(columnMap.get('anonymity_level').column_default).toContain('identified');

    // Verify parent_id column (self-referential foreign key)
    expect(columnMap.has('parent_id')).toBe(true);
    expect(columnMap.get('parent_id').data_type).toBe('uuid');
    expect(columnMap.get('parent_id').is_nullable).toBe('YES');

    // Verify thread_depth column
    expect(columnMap.has('thread_depth')).toBe(true);
    expect(columnMap.get('thread_depth').data_type).toBe('integer');
    expect(columnMap.get('thread_depth').column_default).toContain('0');

    // Verify has_attachment column
    expect(columnMap.has('has_attachment')).toBe(true);
    expect(columnMap.get('has_attachment').data_type).toBe('boolean');
    expect(columnMap.get('has_attachment').column_default).toContain('false');

    // Verify timestamp columns
    expect(columnMap.has('created_at')).toBe(true);
    expect(columnMap.get('created_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('created_at').is_nullable).toBe('NO');
    expect(columnMap.get('created_at').column_default).toContain('now()');

    expect(columnMap.has('updated_at')).toBe(true);
    expect(columnMap.get('updated_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('updated_at').is_nullable).toBe('NO');
    expect(columnMap.get('updated_at').column_default).toContain('now()');

    // Verify soft delete columns
    expect(columnMap.has('deleted_at')).toBe(true);
    expect(columnMap.get('deleted_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('deleted_at').is_nullable).toBe('YES');

    expect(columnMap.has('deleted_by')).toBe(true);
    expect(columnMap.get('deleted_by').data_type).toBe('uuid');
    expect(columnMap.get('deleted_by').is_nullable).toBe('YES');
  });

  it('should create prayer_wall_memberships table with all required columns and correct data types', async () => {
    const [error, columns] = await safeExecute(
      db`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'prayer_wall_memberships'
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

    // Verify wall_id column
    expect(columnMap.has('wall_id')).toBe(true);
    expect(columnMap.get('wall_id').data_type).toBe('uuid');
    expect(columnMap.get('wall_id').is_nullable).toBe('NO');

    // Verify user_id column
    expect(columnMap.has('user_id')).toBe(true);
    expect(columnMap.get('user_id').data_type).toBe('uuid');
    expect(columnMap.get('user_id').is_nullable).toBe('NO');

    // Verify joined_at column
    expect(columnMap.has('joined_at')).toBe(true);
    expect(columnMap.get('joined_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('joined_at').is_nullable).toBe('NO');
    expect(columnMap.get('joined_at').column_default).toContain('now()');

    // Verify invited_by column
    expect(columnMap.has('invited_by')).toBe(true);
    expect(columnMap.get('invited_by').data_type).toBe('uuid');
    expect(columnMap.get('invited_by').is_nullable).toBe('YES');

    // Verify left_at column
    expect(columnMap.has('left_at')).toBe(true);
    expect(columnMap.get('left_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('left_at').is_nullable).toBe('YES');

    // Verify is_banned column
    expect(columnMap.has('is_banned')).toBe(true);
    expect(columnMap.get('is_banned').data_type).toBe('boolean');
    expect(columnMap.get('is_banned').is_nullable).toBe('NO');
    expect(columnMap.get('is_banned').column_default).toContain('false');

    // Verify banned_at column
    expect(columnMap.has('banned_at')).toBe(true);
    expect(columnMap.get('banned_at').data_type).toBe('timestamp with time zone');
    expect(columnMap.get('banned_at').is_nullable).toBe('YES');

    // Verify banned_by column
    expect(columnMap.has('banned_by')).toBe(true);
    expect(columnMap.get('banned_by').data_type).toBe('uuid');
    expect(columnMap.get('banned_by').is_nullable).toBe('YES');

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

  it('should enforce anonymity_level CHECK constraint with valid values only', async () => {
    // Insert test church and prayer wall first
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

    // Test valid value: 'identified'
    const [identifiedError] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, anonymity_level)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Prayer request with identified author',
          'identified'
        )
      `
    );
    expect(identifiedError).toBeUndefined();

    // Test valid value: 'anonymous_to_members'
    const [anonymousMembersError] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, anonymity_level)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000002'::uuid,
          'Prayer request anonymous to members',
          'anonymous_to_members'
        )
      `
    );
    expect(anonymousMembersError).toBeUndefined();

    // Test valid value: 'fully_anonymous'
    const [fullyAnonymousError] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, anonymity_level)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000003'::uuid,
          'Prayer request fully anonymous',
          'fully_anonymous'
        )
      `
    );
    expect(fullyAnonymousError).toBeUndefined();

    // Test invalid value should fail
    const [invalidError] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, anonymity_level)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000004'::uuid,
          'Prayer request with invalid anonymity',
          'invalid_value'
        )
      `
    );
    expect(invalidError).toBeDefined();
    expect(invalidError!.message).toContain('check_anonymity_level');
  });

  it('should enforce thread_depth CHECK constraint (0-3 range)', async () => {
    // Test valid values 0, 1, 2, 3
    for (let depth = 0; depth <= 3; depth++) {
      const [error] = await safeExecute(
        db`
          INSERT INTO prayer_requests (wall_id, author_id, content, thread_depth)
          VALUES (
            'a0000000-0000-0000-0000-000000000001'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid,
            ${`Prayer request at depth ${depth}`},
            ${depth}
          )
        `
      );
      expect(error).toBeUndefined();
    }

    // Test invalid value -1 should fail
    const [negativeError] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, thread_depth)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Invalid negative depth',
          -1
        )
      `
    );
    expect(negativeError).toBeDefined();
    expect(negativeError!.message).toContain('check_thread_depth');

    // Test invalid value 4 should fail
    const [tooDeepError] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, thread_depth)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Invalid depth too deep',
          4
        )
      `
    );
    expect(tooDeepError).toBeDefined();
    expect(tooDeepError!.message).toContain('check_thread_depth');
  });

  it('should enforce self-referential foreign key constraint for parent_id', async () => {
    // Insert parent prayer request
    const [parentError, parentResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Parent prayer request'
        )
        RETURNING id
      `
    );
    expect(parentError).toBeUndefined();
    const parentId = parentResult![0].id;

    // Insert child prayer request with valid parent_id
    const [childError] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, parent_id, thread_depth)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000002'::uuid,
          'Child prayer request',
          ${parentId},
          1
        )
      `
    );
    expect(childError).toBeUndefined();

    // Try to insert with non-existent parent_id should fail
    const [invalidParentError] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, parent_id)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000003'::uuid,
          'Invalid parent reference',
          'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
        )
      `
    );
    expect(invalidParentError).toBeDefined();
    expect(invalidParentError!.message).toContain('foreign key');
  });

  it('should create foreign key constraint from prayer_requests to prayer_walls', async () => {
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
          AND tc.table_name = 'prayer_requests'
          AND kcu.column_name = 'wall_id'
      `
    );

    expect(error).toBeUndefined();
    expect(constraints).toHaveLength(1);
    expect(constraints![0].foreign_table_name).toBe('prayer_walls');
    expect(constraints![0].foreign_column_name).toBe('id');
  });

  it('should create foreign key constraint from prayer_wall_memberships to prayer_walls', async () => {
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
          AND tc.table_name = 'prayer_wall_memberships'
          AND kcu.column_name = 'wall_id'
      `
    );

    expect(error).toBeUndefined();
    expect(constraints).toHaveLength(1);
    expect(constraints![0].foreign_table_name).toBe('prayer_walls');
    expect(constraints![0].foreign_column_name).toBe('id');
  });

  it('should create required indexes for prayer_requests table', async () => {
    const [error, indexes] = await safeExecute(
      db`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = 'prayer_requests'
          AND schemaname = 'public'
        ORDER BY indexname
      `
    );

    expect(error).toBeUndefined();
    expect(indexes).toBeDefined();

    const indexNames = indexes!.map((idx: any) => idx.indexname);

    // Primary key index
    expect(indexNames.some((name: string) => name.includes('pkey'))).toBe(true);

    // Check for wall_id index
    expect(
      indexNames.some((name: string) => name.includes('wall_id')) ||
      indexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('wall_id'))
    ).toBe(true);

    // Check for author_id index
    expect(
      indexNames.some((name: string) => name.includes('author_id')) ||
      indexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('author_id'))
    ).toBe(true);

    // Check for parent_id index
    expect(
      indexNames.some((name: string) => name.includes('parent_id')) ||
      indexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('parent_id'))
    ).toBe(true);

    // Check for deleted_at index
    expect(
      indexNames.some((name: string) => name.includes('deleted_at')) ||
      indexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('deleted_at'))
    ).toBe(true);
  });

  it('should create required indexes for prayer_wall_memberships table', async () => {
    const [error, indexes] = await safeExecute(
      db`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = 'prayer_wall_memberships'
          AND schemaname = 'public'
        ORDER BY indexname
      `
    );

    expect(error).toBeUndefined();
    expect(indexes).toBeDefined();

    const indexNames = indexes!.map((idx: any) => idx.indexname);

    // Primary key index
    expect(indexNames.some((name: string) => name.includes('pkey'))).toBe(true);

    // Check for wall_id index
    expect(
      indexNames.some((name: string) => name.includes('wall_id')) ||
      indexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('wall_id'))
    ).toBe(true);

    // Check for user_id index
    expect(
      indexNames.some((name: string) => name.includes('user_id')) ||
      indexes!.some((idx: any) => idx.indexdef.toLowerCase().includes('user_id'))
    ).toBe(true);
  });

  it('should support threading with parent_id and thread_depth', async () => {
    // Insert root prayer request
    const [rootError, rootResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, thread_depth)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Root prayer request',
          0
        )
        RETURNING id
      `
    );
    expect(rootError).toBeUndefined();
    const rootId = rootResult![0].id;

    // Insert level 1 reply
    const [level1Error, level1Result] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, parent_id, thread_depth)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000002'::uuid,
          'Level 1 reply',
          ${rootId},
          1
        )
        RETURNING id
      `
    );
    expect(level1Error).toBeUndefined();
    const level1Id = level1Result![0].id;

    // Insert level 2 reply
    const [level2Error, level2Result] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, parent_id, thread_depth)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000003'::uuid,
          'Level 2 reply',
          ${level1Id},
          2
        )
        RETURNING id
      `
    );
    expect(level2Error).toBeUndefined();
    const level2Id = level2Result![0].id;

    // Insert level 3 reply (maximum depth)
    const [level3Error] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, parent_id, thread_depth)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000004'::uuid,
          'Level 3 reply',
          ${level2Id},
          3
        )
      `
    );
    expect(level3Error).toBeUndefined();

    // Verify thread structure
    const [queryError, thread] = await safeExecute(
      db`
        SELECT id, parent_id, thread_depth, content
        FROM prayer_requests
        WHERE id = ${rootId} OR parent_id = ${rootId} OR parent_id = ${level1Id} OR parent_id = ${level2Id}
        ORDER BY thread_depth
      `
    );

    expect(queryError).toBeUndefined();
    expect(thread).toHaveLength(4);
    expect(thread![0].thread_depth).toBe(0);
    expect(thread![1].thread_depth).toBe(1);
    expect(thread![2].thread_depth).toBe(2);
    expect(thread![3].thread_depth).toBe(3);
  });

  it('should support soft-delete behavior for prayer_requests', async () => {
    // Insert a prayer request
    const [insertError, insertResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Request to soft delete'
        )
        RETURNING id
      `
    );
    expect(insertError).toBeUndefined();
    const requestId = insertResult![0].id;

    // Soft delete the request
    const [updateError] = await safeExecute(
      db`
        UPDATE prayer_requests
        SET deleted_at = NOW(), deleted_by = '00000000-0000-0000-0000-000000000002'::uuid
        WHERE id = ${requestId}
      `
    );
    expect(updateError).toBeUndefined();

    // Verify the row still exists
    const [queryError, rows] = await safeExecute(
      db`
        SELECT * FROM prayer_requests WHERE id = ${requestId}
      `
    );

    expect(queryError).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows![0].deleted_at).not.toBeNull();
    expect(rows![0].deleted_at).toBeInstanceOf(Date);
    expect(rows![0].deleted_by).toBe('00000000-0000-0000-0000-000000000002');

    // Verify it can be filtered out
    const [activeQueryError, activeRows] = await safeExecute(
      db`
        SELECT * FROM prayer_requests
        WHERE id = ${requestId} AND deleted_at IS NULL
      `
    );

    expect(activeQueryError).toBeUndefined();
    expect(activeRows).toHaveLength(0);
  });

  it('should automatically update updated_at timestamp via trigger for prayer_requests', async () => {
    // Insert a prayer request
    const [insertError, insertResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Request for update test'
        )
        RETURNING id, created_at, updated_at
      `
    );
    expect(insertError).toBeUndefined();

    const requestId = insertResult![0].id;
    const originalUpdatedAt = insertResult![0].updated_at;

    // Wait to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update the request
    const [updateError] = await safeExecute(
      db`
        UPDATE prayer_requests
        SET content = 'Updated content'
        WHERE id = ${requestId}
      `
    );
    expect(updateError).toBeUndefined();

    // Query the updated row
    const [queryError, rows] = await safeExecute(
      db`
        SELECT updated_at FROM prayer_requests WHERE id = ${requestId}
      `
    );

    expect(queryError).toBeUndefined();
    expect(rows).toHaveLength(1);

    const newUpdatedAt = rows![0].updated_at;

    // Verify updated_at was automatically updated
    expect(newUpdatedAt).toBeInstanceOf(Date);
    expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should automatically update updated_at timestamp via trigger for prayer_wall_memberships', async () => {
    // Insert a membership
    const [insertError, insertResult] = await safeExecute(
      db`
        INSERT INTO prayer_wall_memberships (wall_id, user_id)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000005'::uuid
        )
        RETURNING id, created_at, updated_at
      `
    );
    expect(insertError).toBeUndefined();

    const membershipId = insertResult![0].id;
    const originalUpdatedAt = insertResult![0].updated_at;

    // Wait to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update the membership
    const [updateError] = await safeExecute(
      db`
        UPDATE prayer_wall_memberships
        SET is_banned = TRUE, banned_at = NOW(), banned_by = '00000000-0000-0000-0000-000000000001'::uuid
        WHERE id = ${membershipId}
      `
    );
    expect(updateError).toBeUndefined();

    // Query the updated row
    const [queryError, rows] = await safeExecute(
      db`
        SELECT updated_at FROM prayer_wall_memberships WHERE id = ${membershipId}
      `
    );

    expect(queryError).toBeUndefined();
    expect(rows).toHaveLength(1);

    const newUpdatedAt = rows![0].updated_at;

    // Verify updated_at was automatically updated
    expect(newUpdatedAt).toBeInstanceOf(Date);
    expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should insert prayer_wall_memberships with correct defaults and ban functionality', async () => {
    // Insert active membership
    const [insertError, insertResult] = await safeExecute(
      db`
        INSERT INTO prayer_wall_memberships (wall_id, user_id, invited_by)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000010'::uuid,
          '00000000-0000-0000-0000-000000000001'::uuid
        )
        RETURNING *
      `
    );
    expect(insertError).toBeUndefined();

    const membership = insertResult![0];

    // Verify defaults
    expect(membership.id).toBeDefined();
    expect(membership.is_banned).toBe(false);
    expect(membership.joined_at).toBeInstanceOf(Date);
    expect(membership.left_at).toBeNull();
    expect(membership.banned_at).toBeNull();
    expect(membership.banned_by).toBeNull();
    expect(membership.created_at).toBeInstanceOf(Date);
    expect(membership.updated_at).toBeInstanceOf(Date);

    // Test banning functionality
    const [banError] = await safeExecute(
      db`
        UPDATE prayer_wall_memberships
        SET is_banned = TRUE,
            banned_at = NOW(),
            banned_by = '00000000-0000-0000-0000-000000000001'::uuid
        WHERE id = ${membership.id}
      `
    );
    expect(banError).toBeUndefined();

    // Verify ban was applied
    const [queryError, bannedRows] = await safeExecute(
      db`
        SELECT * FROM prayer_wall_memberships WHERE id = ${membership.id}
      `
    );

    expect(queryError).toBeUndefined();
    expect(bannedRows).toHaveLength(1);
    expect(bannedRows![0].is_banned).toBe(true);
    expect(bannedRows![0].banned_at).toBeInstanceOf(Date);
    expect(bannedRows![0].banned_by).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('should support member leaving and rejoining with left_at tracking', async () => {
    // Insert membership
    const [insertError, insertResult] = await safeExecute(
      db`
        INSERT INTO prayer_wall_memberships (wall_id, user_id)
        VALUES (
          'a0000000-0000-0000-0000-000000000001'::uuid,
          '00000000-0000-0000-0000-000000000020'::uuid
        )
        RETURNING id
      `
    );
    expect(insertError).toBeUndefined();
    const membershipId = insertResult![0].id;

    // Member leaves
    const [leaveError] = await safeExecute(
      db`
        UPDATE prayer_wall_memberships
        SET left_at = NOW()
        WHERE id = ${membershipId}
      `
    );
    expect(leaveError).toBeUndefined();

    // Verify left_at is set
    const [queryError, leftRows] = await safeExecute(
      db`
        SELECT * FROM prayer_wall_memberships WHERE id = ${membershipId}
      `
    );

    expect(queryError).toBeUndefined();
    expect(leftRows).toHaveLength(1);
    expect(leftRows![0].left_at).toBeInstanceOf(Date);

    // Member rejoins (clear left_at)
    const [rejoinError] = await safeExecute(
      db`
        UPDATE prayer_wall_memberships
        SET left_at = NULL, joined_at = NOW()
        WHERE id = ${membershipId}
      `
    );
    expect(rejoinError).toBeUndefined();

    // Verify rejoin
    const [rejoinQueryError, rejoinedRows] = await safeExecute(
      db`
        SELECT * FROM prayer_wall_memberships WHERE id = ${membershipId}
      `
    );

    expect(rejoinQueryError).toBeUndefined();
    expect(rejoinedRows).toHaveLength(1);
    expect(rejoinedRows![0].left_at).toBeNull();
  });
});