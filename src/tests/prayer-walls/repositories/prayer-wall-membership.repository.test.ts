import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../../utils/database';
import { safeExecute } from '../../../utils/handle-async';
import { logger } from '../../../logging';
import { PrayerWallMembershipRepository } from '../../../prayer-walls/repositories/prayer-wall-membership.repository';
import { randomUUID } from 'crypto';

describe('PrayerWallMembershipRepository', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  let repository: PrayerWallMembershipRepository;
  let testChurchId: string;
  let testUserId: string;
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
    repository = new PrayerWallMembershipRepository(db);

    // Create test users
    testUserId = randomUUID();
    testUserId2 = randomUUID();
    testUserId3 = randomUUID();

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

  it('should join a prayer wall and create membership record with timestamps', async () => {
    const [error, membership] = await safeExecute(
      repository.join(testWallId, testUserId)
    );

    expect(error).toBeUndefined();
    expect(membership).toBeDefined();
    expect(membership!.id).toBeDefined();
    expect(membership!.wall_id).toBe(testWallId);
    expect(membership!.user_id).toBe(testUserId);
    expect(membership!.joined_at).toBeInstanceOf(Date);
    expect(membership!.invited_by).toBeNull();
    expect(membership!.left_at).toBeNull();
    expect(membership!.is_banned).toBe(false);
    expect(membership!.banned_at).toBeNull();
    expect(membership!.banned_by).toBeNull();
    expect(membership!.created_at).toBeInstanceOf(Date);
    expect(membership!.updated_at).toBeInstanceOf(Date);
  });

  it('should join with invitation tracking and capture invited_by', async () => {
    const inviterId = testUserId;
    const inviteeId = testUserId2;

    const [error, membership] = await safeExecute(
      repository.join(testWallId, inviteeId, inviterId)
    );

    expect(error).toBeUndefined();
    expect(membership).toBeDefined();
    expect(membership!.wall_id).toBe(testWallId);
    expect(membership!.user_id).toBe(inviteeId);
    expect(membership!.invited_by).toBe(inviterId);
    expect(membership!.joined_at).toBeInstanceOf(Date);
    expect(membership!.left_at).toBeNull();
    expect(membership!.is_banned).toBe(false);
  });

  it('should check isMember returns true for active member and false for non-member', async () => {
    // Join a user to the wall
    const [joinError] = await safeExecute(
      repository.join(testWallId, testUserId3)
    );
    expect(joinError).toBeUndefined();

    // Check that the user is a member
    const [checkError1, isMember] = await safeExecute(
      repository.isMember(testWallId, testUserId3)
    );
    expect(checkError1).toBeUndefined();
    expect(isMember).toBe(true);

    // Check that a non-existent user is not a member
    const nonExistentUserId = randomUUID();
    const [checkError2, isNotMember] = await safeExecute(
      repository.isMember(testWallId, nonExistentUserId)
    );
    expect(checkError2).toBeUndefined();
    expect(isNotMember).toBe(false);
  });

  it('should leave a prayer wall and set left_at timestamp', async () => {
    // Create a unique user for this test
    const userId = randomUUID();

    // Join the wall
    const [joinError, membership] = await safeExecute(
      repository.join(testWallId, userId)
    );
    expect(joinError).toBeUndefined();
    expect(membership!.left_at).toBeNull();

    // Verify user is a member
    const [checkError1, isMemberBefore] = await safeExecute(
      repository.isMember(testWallId, userId)
    );
    expect(checkError1).toBeUndefined();
    expect(isMemberBefore).toBe(true);

    // Leave the wall
    const [leaveError, leaveResult] = await safeExecute(
      repository.leave(testWallId, userId)
    );
    expect(leaveError).toBeUndefined();
    expect(leaveResult).toBe(true);

    // Verify user is no longer an active member
    const [checkError2, isMemberAfter] = await safeExecute(
      repository.isMember(testWallId, userId)
    );
    expect(checkError2).toBeUndefined();
    expect(isMemberAfter).toBe(false);

    // Verify left_at is set in database
    const [queryError, dbResult] = await safeExecute(
      db`
        SELECT left_at
        FROM prayer_wall_memberships
        WHERE wall_id = ${testWallId}::uuid AND user_id = ${userId}::uuid
      `
    );
    expect(queryError).toBeUndefined();
    expect(dbResult).toHaveLength(1);
    expect(dbResult![0].left_at).toBeInstanceOf(Date);
  });

  it('should find all active members of a wall excluding left and banned members', async () => {
    // Create a fresh wall for this test to avoid conflicts
    const [wallError, wallResult] = await safeExecute(
      db`
        INSERT INTO prayer_walls (church_id, name, created_by)
        VALUES (${testChurchId}::uuid, 'Members Test Wall', ${testUserId}::uuid)
        RETURNING id
      `
    );
    expect(wallError).toBeUndefined();
    const membersWallId = wallResult![0].id;

    // Create test users
    const activeUser1 = randomUUID();
    const activeUser2 = randomUUID();
    const leftUser = randomUUID();
    const bannedUser = randomUUID();

    // Join active users
    await safeExecute(repository.join(membersWallId, activeUser1));
    await safeExecute(repository.join(membersWallId, activeUser2));

    // Join and then leave
    await safeExecute(repository.join(membersWallId, leftUser));
    await safeExecute(repository.leave(membersWallId, leftUser));

    // Join and then ban
    await safeExecute(repository.join(membersWallId, bannedUser));
    await safeExecute(repository.ban(membersWallId, bannedUser, testUserId));

    // Find all active members
    const [findError, members] = await safeExecute(
      repository.findMembers(membersWallId)
    );

    expect(findError).toBeUndefined();
    expect(members).toBeDefined();
    expect(members!.length).toBe(2);

    // Verify only active users are returned
    const memberUserIds = members!.map(m => m.user_id);
    expect(memberUserIds).toContain(activeUser1);
    expect(memberUserIds).toContain(activeUser2);
    expect(memberUserIds).not.toContain(leftUser);
    expect(memberUserIds).not.toContain(bannedUser);

    // Verify all returned members have correct state
    members!.forEach(member => {
      expect(member.left_at).toBeNull();
      expect(member.is_banned).toBe(false);
      expect(member.joined_at).toBeInstanceOf(Date);
      expect(member.created_at).toBeInstanceOf(Date);
      expect(member.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should ban a user and set is_banned, banned_at, and banned_by', async () => {
    // Create a unique user for this test
    const userId = randomUUID();
    const banningUserId = testUserId;

    // Join the wall
    await safeExecute(repository.join(testWallId, userId));

    // Verify user is a member before ban
    const [checkError1, isMemberBefore] = await safeExecute(
      repository.isMember(testWallId, userId)
    );
    expect(checkError1).toBeUndefined();
    expect(isMemberBefore).toBe(true);

    // Ban the user
    const [banError, banResult] = await safeExecute(
      repository.ban(testWallId, userId, banningUserId)
    );
    expect(banError).toBeUndefined();
    expect(banResult).toBe(true);

    // Verify user is banned
    const [isBannedError, isBanned] = await safeExecute(
      repository.isBanned(testWallId, userId)
    );
    expect(isBannedError).toBeUndefined();
    expect(isBanned).toBe(true);

    // Verify user is no longer considered an active member
    const [checkError2, isMemberAfter] = await safeExecute(
      repository.isMember(testWallId, userId)
    );
    expect(checkError2).toBeUndefined();
    expect(isMemberAfter).toBe(false);

    // Verify ban details in database
    const [queryError, dbResult] = await safeExecute(
      db`
        SELECT is_banned, banned_at, banned_by
        FROM prayer_wall_memberships
        WHERE wall_id = ${testWallId}::uuid AND user_id = ${userId}::uuid
      `
    );
    expect(queryError).toBeUndefined();
    expect(dbResult).toHaveLength(1);
    expect(dbResult![0].is_banned).toBe(true);
    expect(dbResult![0].banned_at).toBeInstanceOf(Date);
    expect(dbResult![0].banned_by).toBe(banningUserId);
  });

  it('should verify banned users are excluded from active members list', async () => {
    // Create a fresh wall for this test
    const [wallError, wallResult] = await safeExecute(
      db`
        INSERT INTO prayer_walls (church_id, name, created_by)
        VALUES (${testChurchId}::uuid, 'Ban Test Wall', ${testUserId}::uuid)
        RETURNING id
      `
    );
    expect(wallError).toBeUndefined();
    const banWallId = wallResult![0].id;

    // Create two users
    const user1 = randomUUID();
    const user2 = randomUUID();

    // Both join
    await safeExecute(repository.join(banWallId, user1));
    await safeExecute(repository.join(banWallId, user2));

    // Verify both are members
    const [findError1, membersBefore] = await safeExecute(
      repository.findMembers(banWallId)
    );
    expect(findError1).toBeUndefined();
    expect(membersBefore!.length).toBe(2);

    // Ban user2
    await safeExecute(repository.ban(banWallId, user2, testUserId));

    // Verify only user1 is in active members list
    const [findError2, membersAfter] = await safeExecute(
      repository.findMembers(banWallId)
    );
    expect(findError2).toBeUndefined();
    expect(membersAfter!.length).toBe(1);
    expect(membersAfter![0].user_id).toBe(user1);
    expect(membersAfter![0].is_banned).toBe(false);
  });

  it('should unban a user and clear is_banned flag', async () => {
    // Create a unique user for this test
    const userId = randomUUID();

    // Join and ban the user
    await safeExecute(repository.join(testWallId, userId));
    await safeExecute(repository.ban(testWallId, userId, testUserId));

    // Verify user is banned
    const [isBannedError1, isBannedBefore] = await safeExecute(
      repository.isBanned(testWallId, userId)
    );
    expect(isBannedError1).toBeUndefined();
    expect(isBannedBefore).toBe(true);

    // Unban the user
    const [unbanError, unbanResult] = await safeExecute(
      repository.unban(testWallId, userId)
    );
    expect(unbanError).toBeUndefined();
    expect(unbanResult).toBe(true);

    // Verify user is no longer banned
    const [isBannedError2, isBannedAfter] = await safeExecute(
      repository.isBanned(testWallId, userId)
    );
    expect(isBannedError2).toBeUndefined();
    expect(isBannedAfter).toBe(false);

    // Verify user is now an active member again (can rejoin if they left)
    const [checkError, isMember] = await safeExecute(
      repository.isMember(testWallId, userId)
    );
    expect(checkError).toBeUndefined();
    expect(isMember).toBe(true);

    // Verify is_banned is false in database
    const [queryError, dbResult] = await safeExecute(
      db`
        SELECT is_banned, banned_at, banned_by
        FROM prayer_wall_memberships
        WHERE wall_id = ${testWallId}::uuid AND user_id = ${userId}::uuid
      `
    );
    expect(queryError).toBeUndefined();
    expect(dbResult).toHaveLength(1);
    expect(dbResult![0].is_banned).toBe(false);
    // Note: banned_at and banned_by may still contain historical data
  });

  it('should handle rejoin scenario - user leaves and rejoins the same wall', async () => {
    // Create a unique user for this test
    const userId = randomUUID();

    // Initial join
    const [joinError1, membership1] = await safeExecute(
      repository.join(testWallId, userId)
    );
    expect(joinError1).toBeUndefined();
    expect(membership1!.left_at).toBeNull();

    // Leave the wall
    await safeExecute(repository.leave(testWallId, userId));

    // Verify user is not an active member
    const [checkError1, isMemberAfterLeave] = await safeExecute(
      repository.isMember(testWallId, userId)
    );
    expect(checkError1).toBeUndefined();
    expect(isMemberAfterLeave).toBe(false);

    // Rejoin the wall
    const [joinError2, membership2] = await safeExecute(
      repository.join(testWallId, userId)
    );
    expect(joinError2).toBeUndefined();
    expect(membership2!.left_at).toBeNull();

    // Verify user is an active member again
    const [checkError2, isMemberAfterRejoin] = await safeExecute(
      repository.isMember(testWallId, userId)
    );
    expect(checkError2).toBeUndefined();
    expect(isMemberAfterRejoin).toBe(true);

    // Verify the membership record was updated (left_at cleared)
    const [queryError, dbResult] = await safeExecute(
      db`
        SELECT left_at, joined_at
        FROM prayer_wall_memberships
        WHERE wall_id = ${testWallId}::uuid AND user_id = ${userId}::uuid
      `
    );
    expect(queryError).toBeUndefined();
    expect(dbResult).toHaveLength(1);
    expect(dbResult![0].left_at).toBeNull();
    expect(dbResult![0].joined_at).toBeInstanceOf(Date);
  });

  it('should handle removeMember by admin and set left_at with tracking', async () => {
    // Create a unique user for this test
    const userId = randomUUID();
    const removingUserId = testUserId;

    // Join the wall
    await safeExecute(repository.join(testWallId, userId));

    // Verify user is a member
    const [checkError1, isMemberBefore] = await safeExecute(
      repository.isMember(testWallId, userId)
    );
    expect(checkError1).toBeUndefined();
    expect(isMemberBefore).toBe(true);

    // Admin removes the member
    const [removeError, removeResult] = await safeExecute(
      repository.removeMember(testWallId, userId, removingUserId)
    );
    expect(removeError).toBeUndefined();
    expect(removeResult).toBe(true);

    // Verify user is no longer an active member
    const [checkError2, isMemberAfter] = await safeExecute(
      repository.isMember(testWallId, userId)
    );
    expect(checkError2).toBeUndefined();
    expect(isMemberAfter).toBe(false);

    // Verify left_at is set (indicating removal)
    const [queryError, dbResult] = await safeExecute(
      db`
        SELECT left_at
        FROM prayer_wall_memberships
        WHERE wall_id = ${testWallId}::uuid AND user_id = ${userId}::uuid
      `
    );
    expect(queryError).toBeUndefined();
    expect(dbResult).toHaveLength(1);
    expect(dbResult![0].left_at).toBeInstanceOf(Date);
  });
});
