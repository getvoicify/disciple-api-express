import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../utils/database';
import { safeExecute } from '../../utils/handle-async';
import { logger } from '../../logging';
import { PrayerRequestRepository } from '../../prayer-walls/repositories/prayer-request.repository';
import { AnonymityLevel } from '../../prayer-walls/types/prayer-wall.types';
import { randomUUID } from 'crypto';

/**
 * Test Suite: Threading Query Optimization (Task Group 19.1)
 *
 * Tests comprehensive threading query optimization for the Prayer Wall Foundation feature.
 * Covers:
 * - Fetching root prayers (parent_id IS NULL)
 * - Lazy loading direct children (one level only)
 * - Recursive CTE for full thread trees
 * - Thread depth validation at max depth (3 levels)
 * - Nested response creation at different depths
 * - Pagination with threading support
 * - Edge cases (empty results, deleted prayers excluded)
 *
 * Thread Structure:
 * - Root prayer (depth 0): parent_id IS NULL
 * - Response (depth 1): direct reply to root
 * - Reply (depth 2): reply to response
 * - Reply-to-reply (depth 3): maximum depth
 */
describe('Threading Query Optimization', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  let repository: PrayerRequestRepository;
  let testChurchId: string;
  let testUserId1: string;
  let testUserId2: string;
  let testUserId3: string;
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

    // Create test users
    testUserId1 = randomUUID();
    testUserId2 = randomUUID();
    testUserId3 = randomUUID();

    // Create test church
    const [churchError, churchResult] = await safeExecute(
      db`
        INSERT INTO churches (id, slug, name, created_by)
        VALUES (
          gen_random_uuid(),
          'test-church-threading',
          'Test Church for Threading',
          ${testUserId1}::uuid
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
          'Test Prayer Wall for Threading',
          ${testUserId1}::uuid,
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
    logger.info({ testChurchId, testUserId1, testWallId }, 'Test data initialized');
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

  beforeEach(async () => {
    // Clean up prayer requests between tests for isolation
    const [cleanupError] = await safeExecute(
      db`DELETE FROM prayer_requests WHERE wall_id = ${testWallId}`
    );
    if (cleanupError) {
      logger.warn({ error: cleanupError }, 'Error cleaning up prayer requests');
    }
  });

  describe('findRootPrayers', () => {
    it('should fetch only root prayers (parent_id IS NULL) and exclude threaded responses', async () => {
      // Create 3 root prayers
      const [error1, root1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root prayer 1 - Please pray for healing',
          anonymity_level: AnonymityLevel.IDENTIFIED,
        })
      );
      expect(error1).toBeUndefined();

      const [error2, root2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          content: 'Root prayer 2 - Pray for my family',
          anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        })
      );
      expect(error2).toBeUndefined();

      const [error3, root3] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          content: 'Root prayer 3 - Need guidance',
          anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        })
      );
      expect(error3).toBeUndefined();

      // Create threaded responses (should NOT appear in root prayers)
      const [error4] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root1!.id,
          content: 'Response to root 1',
        })
      );
      expect(error4).toBeUndefined();

      const [error5] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: root2!.id,
          content: 'Response to root 2',
        })
      );
      expect(error5).toBeUndefined();

      // Fetch root prayers only
      const [fetchError, rootPrayers] = await safeExecute(
        repository.findRootPrayers(testWallId)
      );

      // Assertions
      expect(fetchError).toBeUndefined();
      expect(rootPrayers).toBeDefined();
      expect(rootPrayers!.length).toBe(3);

      // Verify all returned prayers are root level (parent_id IS NULL, thread_depth = 0)
      rootPrayers!.forEach((prayer) => {
        expect(prayer.parent_id).toBeNull();
        expect(prayer.thread_depth).toBe(0);
      });

      // Verify the correct prayers are returned
      const ids = rootPrayers!.map((p) => p.id);
      expect(ids).toContain(root1!.id);
      expect(ids).toContain(root2!.id);
      expect(ids).toContain(root3!.id);
    });

    it('should support cursor-based pagination for root prayers', async () => {
      // Create 5 root prayers with delays to ensure different timestamps
      const rootPrayers = [];
      for (let i = 1; i <= 5; i++) {
        const [error, prayer] = await safeExecute(
          repository.create({
            wall_id: testWallId,
            author_id: testUserId1,
            content: `Root prayer ${i} for pagination test`,
            anonymity_level: AnonymityLevel.IDENTIFIED,
          })
        );
        expect(error).toBeUndefined();
        rootPrayers.push(prayer!);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Fetch first page (2 items)
      const [error1, page1] = await safeExecute(
        repository.findRootPrayers(testWallId, { limit: 2 })
      );
      expect(error1).toBeUndefined();
      expect(page1).toBeDefined();
      expect(page1!.length).toBe(2);

      // Fetch second page using cursor
      const cursor = page1![1].id;
      const [error2, page2] = await safeExecute(
        repository.findRootPrayers(testWallId, { limit: 2, cursor })
      );
      expect(error2).toBeUndefined();
      expect(page2).toBeDefined();
      expect(page2!.length).toBe(2);

      // Verify pages contain different prayers
      expect(page1![0].id).not.toBe(page2![0].id);
      expect(page1![1].id).not.toBe(page2![0].id);

      // Verify all are root prayers
      [...page1!, ...page2!].forEach((prayer) => {
        expect(prayer.parent_id).toBeNull();
        expect(prayer.thread_depth).toBe(0);
      });
    });

    it('should return empty array when no root prayers exist on wall', async () => {
      // Create only threaded responses (no root prayers)
      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Temporary root',
        })
      );
      expect(error1).toBeUndefined();

      const [error2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Threaded response',
        })
      );
      expect(error2).toBeUndefined();

      // Delete the root prayer (soft delete)
      const [deleteError] = await safeExecute(
        repository.softDelete(root!.id, testUserId1)
      );
      expect(deleteError).toBeUndefined();

      // Fetch root prayers - should return empty
      const [fetchError, rootPrayers] = await safeExecute(
        repository.findRootPrayers(testWallId)
      );

      expect(fetchError).toBeUndefined();
      expect(rootPrayers).toBeDefined();
      expect(rootPrayers!.length).toBe(0);
    });

    it('should exclude soft-deleted root prayers from results', async () => {
      // Create 2 root prayers
      const [error1, root1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root prayer to keep',
        })
      );
      expect(error1).toBeUndefined();

      const [error2, root2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          content: 'Root prayer to delete',
        })
      );
      expect(error2).toBeUndefined();

      // Soft delete one root prayer
      const [deleteError] = await safeExecute(
        repository.softDelete(root2!.id, testUserId1)
      );
      expect(deleteError).toBeUndefined();

      // Fetch root prayers - should only return non-deleted
      const [fetchError, rootPrayers] = await safeExecute(
        repository.findRootPrayers(testWallId)
      );

      expect(fetchError).toBeUndefined();
      expect(rootPrayers).toBeDefined();
      expect(rootPrayers!.length).toBe(1);
      expect(rootPrayers![0].id).toBe(root1!.id);
    });
  });

  describe('findDirectChildren', () => {
    it('should fetch only immediate children (one level) and not deeper descendants', async () => {
      // Create root prayer
      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root prayer for direct children test',
        })
      );
      expect(error1).toBeUndefined();

      // Create 2 direct children (depth 1)
      const [error2, child1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Direct child 1',
        })
      );
      expect(error2).toBeUndefined();

      const [error3, child2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: root!.id,
          content: 'Direct child 2',
        })
      );
      expect(error3).toBeUndefined();

      // Create grandchildren (depth 2) - should NOT appear
      const [error4] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          parent_id: child1!.id,
          content: 'Grandchild 1',
        })
      );
      expect(error4).toBeUndefined();

      const [error5] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: child2!.id,
          content: 'Grandchild 2',
        })
      );
      expect(error5).toBeUndefined();

      // Fetch direct children only
      const [fetchError, directChildren] = await safeExecute(
        repository.findDirectChildren(root!.id)
      );

      // Assertions
      expect(fetchError).toBeUndefined();
      expect(directChildren).toBeDefined();
      expect(directChildren!.length).toBe(2);

      // Verify all returned prayers are direct children (parent_id matches, thread_depth = 1)
      directChildren!.forEach((child) => {
        expect(child.parent_id).toBe(root!.id);
        expect(child.thread_depth).toBe(1);
      });

      // Verify correct children are returned
      const ids = directChildren!.map((c) => c.id);
      expect(ids).toContain(child1!.id);
      expect(ids).toContain(child2!.id);
    });

    it('should return empty array when parent has no children', async () => {
      // Create root prayer with no children
      const [error, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root prayer with no responses',
        })
      );
      expect(error).toBeUndefined();

      // Fetch direct children - should return empty
      const [fetchError, directChildren] = await safeExecute(
        repository.findDirectChildren(root!.id)
      );

      expect(fetchError).toBeUndefined();
      expect(directChildren).toBeDefined();
      expect(directChildren!.length).toBe(0);
    });

    it('should exclude soft-deleted children from direct children results', async () => {
      // Create root with 2 children
      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root prayer',
        })
      );
      expect(error1).toBeUndefined();

      const [error2, child1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Child to keep',
        })
      );
      expect(error2).toBeUndefined();

      const [error3, child2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: root!.id,
          content: 'Child to delete',
        })
      );
      expect(error3).toBeUndefined();

      // Soft delete one child
      const [deleteError] = await safeExecute(
        repository.softDelete(child2!.id, testUserId1)
      );
      expect(deleteError).toBeUndefined();

      // Fetch direct children - should only return non-deleted
      const [fetchError, directChildren] = await safeExecute(
        repository.findDirectChildren(root!.id)
      );

      expect(fetchError).toBeUndefined();
      expect(directChildren).toBeDefined();
      expect(directChildren!.length).toBe(1);
      expect(directChildren![0].id).toBe(child1!.id);
    });

    it('should handle fetching children at different thread depths', async () => {
      // Create a deep thread chain
      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root (depth 0)',
        })
      );
      expect(error1).toBeUndefined();

      const [error2, depth1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Depth 1',
        })
      );
      expect(error2).toBeUndefined();

      const [error3, depth2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: depth1!.id,
          content: 'Depth 2',
        })
      );
      expect(error3).toBeUndefined();

      const [error4, depth3] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          parent_id: depth2!.id,
          content: 'Depth 3 (max)',
        })
      );
      expect(error4).toBeUndefined();

      // Fetch direct children of depth 2 prayer
      const [fetchError, children] = await safeExecute(
        repository.findDirectChildren(depth2!.id)
      );

      expect(fetchError).toBeUndefined();
      expect(children).toBeDefined();
      expect(children!.length).toBe(1);
      expect(children![0].id).toBe(depth3!.id);
      expect(children![0].parent_id).toBe(depth2!.id);
      expect(children![0].thread_depth).toBe(3);
    });
  });

  describe('findFullThread', () => {
    it('should fetch complete thread tree with all descendants using recursive CTE', async () => {
      // Create a complex thread tree:
      // root
      //   ├─ child1
      //   │   ├─ grandchild1
      //   │   └─ grandchild2
      //   └─ child2
      //       └─ grandchild3

      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root prayer for full thread test',
        })
      );
      expect(error1).toBeUndefined();

      const [error2, child1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Child 1',
        })
      );
      expect(error2).toBeUndefined();

      const [error3, child2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: root!.id,
          content: 'Child 2',
        })
      );
      expect(error3).toBeUndefined();

      const [error4, grandchild1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          parent_id: child1!.id,
          content: 'Grandchild 1',
        })
      );
      expect(error4).toBeUndefined();

      const [error5, grandchild2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: child1!.id,
          content: 'Grandchild 2',
        })
      );
      expect(error5).toBeUndefined();

      const [error6, grandchild3] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: child2!.id,
          content: 'Grandchild 3',
        })
      );
      expect(error6).toBeUndefined();

      // Fetch full thread tree
      const [fetchError, fullThread] = await safeExecute(
        repository.findFullThread(root!.id)
      );

      // Assertions
      expect(fetchError).toBeUndefined();
      expect(fullThread).toBeDefined();
      expect(fullThread!.length).toBe(6); // root + 2 children + 3 grandchildren

      // Verify all prayers are included
      const ids = fullThread!.map((p) => p.id);
      expect(ids).toContain(root!.id);
      expect(ids).toContain(child1!.id);
      expect(ids).toContain(child2!.id);
      expect(ids).toContain(grandchild1!.id);
      expect(ids).toContain(grandchild2!.id);
      expect(ids).toContain(grandchild3!.id);

      // Verify thread depths are correct
      const rootInThread = fullThread!.find((p) => p.id === root!.id);
      expect(rootInThread!.thread_depth).toBe(0);

      const child1InThread = fullThread!.find((p) => p.id === child1!.id);
      expect(child1InThread!.thread_depth).toBe(1);

      const grandchild1InThread = fullThread!.find((p) => p.id === grandchild1!.id);
      expect(grandchild1InThread!.thread_depth).toBe(2);
    });

    it('should return only root when no children exist', async () => {
      // Create root with no children
      const [error, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Standalone root prayer',
        })
      );
      expect(error).toBeUndefined();

      // Fetch full thread - should return only root
      const [fetchError, fullThread] = await safeExecute(
        repository.findFullThread(root!.id)
      );

      expect(fetchError).toBeUndefined();
      expect(fullThread).toBeDefined();
      expect(fullThread!.length).toBe(1);
      expect(fullThread![0].id).toBe(root!.id);
      expect(fullThread![0].thread_depth).toBe(0);
    });

    it('should exclude soft-deleted prayers from full thread tree', async () => {
      // Create thread tree
      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root',
        })
      );
      expect(error1).toBeUndefined();

      const [error2, child1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Child 1',
        })
      );
      expect(error2).toBeUndefined();

      const [error3, child2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: root!.id,
          content: 'Child 2 - will be deleted',
        })
      );
      expect(error3).toBeUndefined();

      const [error4] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          parent_id: child2!.id,
          content: 'Grandchild of deleted child',
        })
      );
      expect(error4).toBeUndefined();

      // Soft delete child2
      const [deleteError] = await safeExecute(
        repository.softDelete(child2!.id, testUserId1)
      );
      expect(deleteError).toBeUndefined();

      // Fetch full thread - should exclude deleted child and its descendants
      const [fetchError, fullThread] = await safeExecute(
        repository.findFullThread(root!.id)
      );

      expect(fetchError).toBeUndefined();
      expect(fullThread).toBeDefined();
      expect(fullThread!.length).toBe(2); // root + child1 only

      const ids = fullThread!.map((p) => p.id);
      expect(ids).toContain(root!.id);
      expect(ids).toContain(child1!.id);
      expect(ids).not.toContain(child2!.id);
    });

    it('should handle maximum depth thread (3 levels)', async () => {
      // Create thread at maximum depth
      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root (depth 0)',
        })
      );
      expect(error1).toBeUndefined();

      const [error2, depth1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Response (depth 1)',
        })
      );
      expect(error2).toBeUndefined();

      const [error3, depth2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: depth1!.id,
          content: 'Reply (depth 2)',
        })
      );
      expect(error3).toBeUndefined();

      const [error4, depth3] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          parent_id: depth2!.id,
          content: 'Reply-to-reply (depth 3 - max)',
        })
      );
      expect(error4).toBeUndefined();

      // Fetch full thread
      const [fetchError, fullThread] = await safeExecute(
        repository.findFullThread(root!.id)
      );

      expect(fetchError).toBeUndefined();
      expect(fullThread).toBeDefined();
      expect(fullThread!.length).toBe(4);

      // Verify depths
      const depths = fullThread!.map((p) => p.thread_depth).sort();
      expect(depths).toEqual([0, 1, 2, 3]);

      // Verify maximum depth
      const maxDepthPrayer = fullThread!.find((p) => p.id === depth3!.id);
      expect(maxDepthPrayer!.thread_depth).toBe(3);
    });
  });

  describe('Thread Depth Validation at Max Depth', () => {
    it('should prevent creating response beyond max depth (depth 4)', async () => {
      // Create thread chain to max depth
      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root (depth 0)',
        })
      );
      expect(error1).toBeUndefined();

      const [error2, depth1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Depth 1',
        })
      );
      expect(error2).toBeUndefined();

      const [error3, depth2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: depth1!.id,
          content: 'Depth 2',
        })
      );
      expect(error3).toBeUndefined();

      const [error4, depth3] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          parent_id: depth2!.id,
          content: 'Depth 3 (max)',
        })
      );
      expect(error4).toBeUndefined();

      // Attempt to create depth 4 (should fail)
      const [error5, depth4] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: depth3!.id,
          content: 'Depth 4 - should fail',
        })
      );

      // Assertions
      expect(error5).toBeDefined();
      expect(error5!.message).toContain('Maximum thread depth');
      expect(depth4).toBeUndefined();
    });

    it('should allow creating responses at exactly max depth (depth 3)', async () => {
      // Create chain to depth 2
      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root',
        })
      );
      expect(error1).toBeUndefined();

      const [error2, depth1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Depth 1',
        })
      );
      expect(error2).toBeUndefined();

      const [error3, depth2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: depth1!.id,
          content: 'Depth 2',
        })
      );
      expect(error3).toBeUndefined();

      // Create depth 3 (should succeed)
      const [error4, depth3] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          parent_id: depth2!.id,
          content: 'Depth 3 - max allowed',
        })
      );

      // Assertions
      expect(error4).toBeUndefined();
      expect(depth3).toBeDefined();
      expect(depth3!.thread_depth).toBe(3);
      expect(depth3!.parent_id).toBe(depth2!.id);
    });
  });

  describe('Nested Response Creation at Different Depths', () => {
    it('should create responses at depth 1, 2, and 3 with correct parent relationships', async () => {
      // Create root
      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root prayer',
          anonymity_level: AnonymityLevel.IDENTIFIED,
        })
      );
      expect(error1).toBeUndefined();
      expect(root!.thread_depth).toBe(0);
      expect(root!.parent_id).toBeNull();

      // Create depth 1 response
      const [error2, response] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Response at depth 1',
          anonymity_level: AnonymityLevel.ANONYMOUS_TO_MEMBERS,
        })
      );
      expect(error2).toBeUndefined();
      expect(response!.thread_depth).toBe(1);
      expect(response!.parent_id).toBe(root!.id);

      // Create depth 2 reply
      const [error3, reply] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: response!.id,
          content: 'Reply at depth 2',
          anonymity_level: AnonymityLevel.FULLY_ANONYMOUS,
        })
      );
      expect(error3).toBeUndefined();
      expect(reply!.thread_depth).toBe(2);
      expect(reply!.parent_id).toBe(response!.id);

      // Create depth 3 reply-to-reply
      const [error4, replyToReply] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          parent_id: reply!.id,
          content: 'Reply-to-reply at depth 3',
          anonymity_level: AnonymityLevel.IDENTIFIED,
        })
      );
      expect(error4).toBeUndefined();
      expect(replyToReply!.thread_depth).toBe(3);
      expect(replyToReply!.parent_id).toBe(reply!.id);

      // Verify full thread structure
      const [fetchError, fullThread] = await safeExecute(
        repository.findFullThread(root!.id)
      );
      expect(fetchError).toBeUndefined();
      expect(fullThread!.length).toBe(4);

      // Verify parent-child relationships
      const rootInThread = fullThread!.find((p) => p.id === root!.id);
      const responseInThread = fullThread!.find((p) => p.id === response!.id);
      const replyInThread = fullThread!.find((p) => p.id === reply!.id);
      const replyToReplyInThread = fullThread!.find((p) => p.id === replyToReply!.id);

      expect(rootInThread!.parent_id).toBeNull();
      expect(responseInThread!.parent_id).toBe(root!.id);
      expect(replyInThread!.parent_id).toBe(response!.id);
      expect(replyToReplyInThread!.parent_id).toBe(reply!.id);
    });

    it('should handle multiple branches at same depth level', async () => {
      // Create root
      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root with multiple branches',
        })
      );
      expect(error1).toBeUndefined();

      // Create 3 depth-1 responses (siblings)
      const [error2, branch1] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Branch 1 at depth 1',
        })
      );
      expect(error2).toBeUndefined();
      expect(branch1!.thread_depth).toBe(1);

      const [error3, branch2] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId3,
          parent_id: root!.id,
          content: 'Branch 2 at depth 1',
        })
      );
      expect(error3).toBeUndefined();
      expect(branch2!.thread_depth).toBe(1);

      const [error4, branch3] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          parent_id: root!.id,
          content: 'Branch 3 at depth 1',
        })
      );
      expect(error4).toBeUndefined();
      expect(branch3!.thread_depth).toBe(1);

      // Verify direct children
      const [fetchError, directChildren] = await safeExecute(
        repository.findDirectChildren(root!.id)
      );
      expect(fetchError).toBeUndefined();
      expect(directChildren!.length).toBe(3);

      // All children should be at depth 1 with same parent
      directChildren!.forEach((child) => {
        expect(child.parent_id).toBe(root!.id);
        expect(child.thread_depth).toBe(1);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle non-existent parent ID gracefully', async () => {
      const nonExistentId = randomUUID();

      // Attempt to create prayer with non-existent parent
      const [error, prayer] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          parent_id: nonExistentId,
          content: 'Response to non-existent parent',
        })
      );

      expect(error).toBeDefined();
      expect(error!.message).toContain('Parent prayer request not found');
      expect(prayer).toBeUndefined();
    });

    it('should return empty array for findDirectChildren with non-existent parent', async () => {
      const nonExistentId = randomUUID();

      const [error, children] = await safeExecute(
        repository.findDirectChildren(nonExistentId)
      );

      expect(error).toBeUndefined();
      expect(children).toBeDefined();
      expect(children!.length).toBe(0);
    });

    it('should return empty array for findFullThread with non-existent root', async () => {
      const nonExistentId = randomUUID();

      const [error, thread] = await safeExecute(
        repository.findFullThread(nonExistentId)
      );

      expect(error).toBeUndefined();
      expect(thread).toBeDefined();
      expect(thread!.length).toBe(0);
    });

    it('should handle soft-deleted parent preventing child creation', async () => {
      // Create root and soft delete it
      const [error1, root] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId1,
          content: 'Root to be deleted',
        })
      );
      expect(error1).toBeUndefined();

      const [deleteError] = await safeExecute(
        repository.softDelete(root!.id, testUserId1)
      );
      expect(deleteError).toBeUndefined();

      // Attempt to create child of deleted parent
      const [error2, child] = await safeExecute(
        repository.create({
          wall_id: testWallId,
          author_id: testUserId2,
          parent_id: root!.id,
          content: 'Response to deleted prayer',
        })
      );

      expect(error2).toBeDefined();
      expect(error2!.message).toContain('Parent prayer request not found');
      expect(child).toBeUndefined();
    });
  });
});
