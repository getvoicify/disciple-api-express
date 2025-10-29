import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getRawDb, type RawDb } from '../../utils/database';
import { safeExecute } from '../../utils/handle-async';
import { logger } from '../../logging';
import { FlaggedContentRepository } from '../../prayer-walls/repositories/flagged-content.repository';
import { PrayerRequestRepository } from '../../prayer-walls/repositories/prayer-request.repository';
import { PrayerWallMembershipRepository } from '../../prayer-walls/repositories/prayer-wall-membership.repository';
import { PrayerWallRepository } from '../../prayer-walls/repositories/prayer-wall.repository';
import { ModerationService } from '../../prayer-walls/services/moderation.service';
import type { ChurchMembershipService } from '../../churches/membership-service';
import { randomUUID } from 'crypto';
import { FlaggedContentStatus } from '../../prayer-walls/types/prayer-wall.types';

/**
 * Test Suite: Moderation Service Tests (Task Group 21)
 *
 * Tests the moderation workflow for the Prayer Wall Foundation feature.
 * Covers:
 * - Flag content (auto-hide functionality)
 * - Pastor review workflow (list pending flags)
 * - Delete action (pastor soft-deletes flagged prayers)
 * - Restore action (pastor restores falsely flagged prayers)
 * - Ban user action (pastor bans users from walls)
 * - Audit trail logging (all moderation actions tracked)
 */
describe('Moderation Service Tests', () => {
  let container: StartedPostgreSqlContainer;
  let db: RawDb;
  let moderationService: ModerationService;
  let testChurchId: string;
  let testPastorId: string;
  let testMemberId: string;
  let testDisruptiveUserId: string;
  let testWallId: string;
  let testPrayerId: string;

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

    // Run prerequisite migrations (001-014) in order
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
      '014_add_deleted_at_to_prayer_attachments.sql',
      '015_add_hidden_at_to_prayer_requests.sql',
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

    // Create test data
    testPastorId = randomUUID();
    testMemberId = randomUUID();
    testDisruptiveUserId = randomUUID();

    const [churchError, churchResult] = await safeExecute(
      db`
        INSERT INTO churches (id, slug, name, created_by)
        VALUES (
          gen_random_uuid(),
          'test-church',
          'Test Church',
          ${testPastorId}::uuid
        )
        RETURNING id
      `
    );

    if (churchError) {
      logger.error({ error: churchError }, 'Failed to create test church');
      throw churchError;
    }

    testChurchId = churchResult![0].id;

    const [wallError, wallResult] = await safeExecute(
      db`
        INSERT INTO prayer_walls (id, church_id, name, created_by, is_private, has_restricted_access, status)
        VALUES (
          gen_random_uuid(),
          ${testChurchId}::uuid,
          'Test Prayer Wall',
          ${testPastorId}::uuid,
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

    // Add church memberships for authorization testing
    const [churchMembershipError] = await safeExecute(
      db`
        INSERT INTO church_members (church_id, user_id, role, status)
        VALUES
          (${testChurchId}::uuid, ${testPastorId}::uuid, 'Owner', 'Active'),
          (${testChurchId}::uuid, ${testMemberId}::uuid, 'Member', 'Active')
      `
    );

    if (churchMembershipError) {
      logger.error({ error: churchMembershipError }, 'Failed to add church memberships');
      throw churchMembershipError;
    }

    // Add members to the wall
    const [memberError] = await safeExecute(
      db`
        INSERT INTO prayer_wall_memberships (wall_id, user_id, joined_at)
        VALUES
          (${testWallId}::uuid, ${testPastorId}::uuid, NOW()),
          (${testWallId}::uuid, ${testMemberId}::uuid, NOW()),
          (${testWallId}::uuid, ${testDisruptiveUserId}::uuid, NOW())
      `
    );

    if (memberError) {
      logger.error({ error: memberError }, 'Failed to add users as wall members');
      throw memberError;
    }

    const [prayerError, prayerResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (id, wall_id, author_id, content)
        VALUES (
          gen_random_uuid(),
          ${testWallId}::uuid,
          ${testDisruptiveUserId}::uuid,
          'This is inappropriate content that should be flagged'
        )
        RETURNING id
      `
    );

    if (prayerError) {
      logger.error({ error: prayerError }, 'Failed to create test prayer request');
      throw prayerError;
    }

    testPrayerId = prayerResult![0].id;

    // Initialize service with repositories
    const flaggedContentRepository = new FlaggedContentRepository(db);
    const prayerRequestRepository = new PrayerRequestRepository(db);
    const membershipRepository = new PrayerWallMembershipRepository(db);
    const prayerWallRepository = new PrayerWallRepository(db);

    // Create mock ChurchMembershipService that reads from test database
    const mockChurchMembershipService: ChurchMembershipService = {
      getMembershipByUserAndChurch: async (userId: string, churchId: string) => {
        const [error, result] = await safeExecute(
          db`
            SELECT user_id, church_id, role, status
            FROM church_members
            WHERE user_id = ${userId}::uuid AND church_id = ${churchId}::uuid
          `
        );

        if (error || !result || result.length === 0) {
          return null;
        }

        return {
          user_id: result[0].user_id,
          church_id: result[0].church_id,
          role: result[0].role,
          status: result[0].status,
        } as any;
      },
    } as any;

    moderationService = new ModerationService(
      flaggedContentRepository,
      prayerRequestRepository,
      membershipRepository,
      prayerWallRepository,
      mockChurchMembershipService
    );

    logger.info({ testChurchId, testPastorId, testMemberId, testWallId, testPrayerId }, 'Test data initialized');
  }, 120000);

  afterAll(async () => {
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

  it('should flag content and auto-hide prayer request immediately', async () => {
    // Flag the prayer request
    const reason = 'Inappropriate content';
    const [flagError, flaggedContent] = await safeExecute(
      moderationService.flagContent(testPrayerId, testMemberId, reason)
    );

    expect(flagError).toBeUndefined();
    expect(flaggedContent).toBeDefined();
    expect(flaggedContent!.prayer_request_id).toBe(testPrayerId);
    expect(flaggedContent!.flagged_by).toBe(testMemberId);
    expect(flaggedContent!.reason).toBe(reason);
    expect(flaggedContent!.status).toBe(FlaggedContentStatus.PENDING);
    expect(flaggedContent!.reviewed_by).toBeNull();
    expect(flaggedContent!.reviewed_at).toBeNull();
    expect(flaggedContent!.resolution_action).toBeNull();
    expect(flaggedContent!.resolution_notes).toBeNull();

    // Verify prayer was auto-hidden
    const [prayerError, prayer] = await safeExecute(
      db`
        SELECT hidden_at
        FROM prayer_requests
        WHERE id = ${testPrayerId}::uuid
      `
    );

    expect(prayerError).toBeUndefined();
    expect(prayer).toBeDefined();
    expect(prayer![0].hidden_at).not.toBeNull();
    expect(prayer![0].hidden_at).toBeInstanceOf(Date);
  });

  it('should allow pastor to list all pending flagged content for their church', async () => {
    // Create additional flagged content for testing
    const [prayer2Error, prayer2Result] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testWallId}::uuid,
          ${testDisruptiveUserId}::uuid,
          'Another inappropriate prayer'
        )
        RETURNING id
      `
    );

    expect(prayer2Error).toBeUndefined();
    const prayer2Id = prayer2Result![0].id;

    const [flag2Error] = await safeExecute(
      moderationService.flagContent(prayer2Id, testMemberId, 'Spam content')
    );

    expect(flag2Error).toBeUndefined();

    // List pending flags
    const [listError, pendingFlags] = await safeExecute(
      moderationService.listFlaggedContent(testChurchId, testPastorId)
    );

    expect(listError).toBeUndefined();
    expect(pendingFlags).toBeDefined();
    expect(pendingFlags!.length).toBeGreaterThanOrEqual(2);

    // Verify all are pending status
    for (const flag of pendingFlags!) {
      expect(flag.status).toBe(FlaggedContentStatus.PENDING);
      expect(flag.reviewed_by).toBeNull();
      expect(flag.reviewed_at).toBeNull();
    }

    // Verify they belong to this church
    const prayerIds = pendingFlags!.map(f => f.prayer_request_id);

    // Use IN clause instead of ANY() to avoid array literal issues
    const [verifyError, prayers] = await safeExecute(
      db`
        SELECT pr.id, pw.church_id
        FROM prayer_requests pr
        INNER JOIN prayer_walls pw ON pr.wall_id = pw.id
        WHERE pr.id IN ${db(prayerIds)}
      `
    );

    expect(verifyError).toBeUndefined();
    for (const prayer of prayers!) {
      expect(prayer.church_id).toBe(testChurchId);
    }
  });

  it('should allow pastor to soft-delete flagged prayer with delete action', async () => {
    // Create a new prayer to flag and delete
    const [prayerError, prayerResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testWallId}::uuid,
          ${testDisruptiveUserId}::uuid,
          'Prayer to be deleted by pastor'
        )
        RETURNING id
      `
    );

    expect(prayerError).toBeUndefined();
    const prayerToDeleteId = prayerResult![0].id;

    // Flag the prayer
    const [flagError, flaggedContent] = await safeExecute(
      moderationService.flagContent(prayerToDeleteId, testMemberId, 'Violates community guidelines')
    );

    expect(flagError).toBeUndefined();
    const flagId = flaggedContent!.id;

    // Pastor reviews and deletes
    const resolutionNotes = 'Content violates our community standards';
    const [reviewError, reviewedFlag] = await safeExecute(
      moderationService.reviewFlaggedContent(flagId, 'delete', testPastorId, resolutionNotes)
    );

    expect(reviewError).toBeUndefined();
    expect(reviewedFlag).toBeDefined();
    expect(reviewedFlag!.status).toBe(FlaggedContentStatus.ACTIONED);
    expect(reviewedFlag!.reviewed_by).toBe(testPastorId);
    expect(reviewedFlag!.reviewed_at).not.toBeNull();
    expect(reviewedFlag!.reviewed_at).toBeInstanceOf(Date);
    expect(reviewedFlag!.resolution_action).toBe('delete');
    expect(reviewedFlag!.resolution_notes).toBe(resolutionNotes);

    // Verify prayer was soft-deleted
    const [prayerCheckError, deletedPrayer] = await safeExecute(
      db`
        SELECT deleted_at, deleted_by
        FROM prayer_requests
        WHERE id = ${prayerToDeleteId}::uuid
      `
    );

    expect(prayerCheckError).toBeUndefined();
    expect(deletedPrayer![0].deleted_at).not.toBeNull();
    expect(deletedPrayer![0].deleted_at).toBeInstanceOf(Date);
    expect(deletedPrayer![0].deleted_by).toBe(testPastorId);
  });

  it('should allow pastor to restore falsely flagged prayer with restore action', async () => {
    // Create a new prayer to flag and restore
    const [prayerError, prayerResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testWallId}::uuid,
          ${testMemberId}::uuid,
          'Legitimate prayer falsely flagged'
        )
        RETURNING id
      `
    );

    expect(prayerError).toBeUndefined();
    const prayerToRestoreId = prayerResult![0].id;

    // Flag the prayer (falsely)
    const [flagError, flaggedContent] = await safeExecute(
      moderationService.flagContent(prayerToRestoreId, testDisruptiveUserId, 'False report')
    );

    expect(flagError).toBeUndefined();
    const flagId = flaggedContent!.id;

    // Verify prayer was auto-hidden
    const [hiddenCheckError, hiddenPrayer] = await safeExecute(
      db`
        SELECT hidden_at
        FROM prayer_requests
        WHERE id = ${prayerToRestoreId}::uuid
      `
    );

    expect(hiddenCheckError).toBeUndefined();
    expect(hiddenPrayer![0].hidden_at).not.toBeNull();

    // Pastor reviews and restores
    const resolutionNotes = 'False flag - content is appropriate';
    const [reviewError, reviewedFlag] = await safeExecute(
      moderationService.reviewFlaggedContent(flagId, 'restore', testPastorId, resolutionNotes)
    );

    expect(reviewError).toBeUndefined();
    expect(reviewedFlag).toBeDefined();
    expect(reviewedFlag!.status).toBe(FlaggedContentStatus.DISMISSED);
    expect(reviewedFlag!.reviewed_by).toBe(testPastorId);
    expect(reviewedFlag!.reviewed_at).not.toBeNull();
    expect(reviewedFlag!.reviewed_at).toBeInstanceOf(Date);
    expect(reviewedFlag!.resolution_action).toBe('restore');
    expect(reviewedFlag!.resolution_notes).toBe(resolutionNotes);

    // Verify prayer was restored (hidden_at cleared)
    const [restoredCheckError, restoredPrayer] = await safeExecute(
      db`
        SELECT hidden_at, deleted_at
        FROM prayer_requests
        WHERE id = ${prayerToRestoreId}::uuid
      `
    );

    expect(restoredCheckError).toBeUndefined();
    expect(restoredPrayer![0].hidden_at).toBeNull();
    expect(restoredPrayer![0].deleted_at).toBeNull();
  });

  it('should allow pastor to ban disruptive user from wall', async () => {
    // Verify user is not banned initially
    const [initialCheckError, initialMembership] = await safeExecute(
      db`
        SELECT is_banned, banned_at, banned_by
        FROM prayer_wall_memberships
        WHERE wall_id = ${testWallId}::uuid
          AND user_id = ${testDisruptiveUserId}::uuid
      `
    );

    expect(initialCheckError).toBeUndefined();
    expect(initialMembership![0].is_banned).toBe(false);
    expect(initialMembership![0].banned_at).toBeNull();
    expect(initialMembership![0].banned_by).toBeNull();

    // Pastor bans the user
    const [banError, banResult] = await safeExecute(
      moderationService.banUser(testWallId, testDisruptiveUserId, testPastorId, false)
    );

    expect(banError).toBeUndefined();
    expect(banResult).toBe(true);

    // Verify user is now banned
    const [bannedCheckError, bannedMembership] = await safeExecute(
      db`
        SELECT is_banned, banned_at, banned_by
        FROM prayer_wall_memberships
        WHERE wall_id = ${testWallId}::uuid
          AND user_id = ${testDisruptiveUserId}::uuid
      `
    );

    expect(bannedCheckError).toBeUndefined();
    expect(bannedMembership![0].is_banned).toBe(true);
    expect(bannedMembership![0].banned_at).not.toBeNull();
    expect(bannedMembership![0].banned_at).toBeInstanceOf(Date);
    expect(bannedMembership![0].banned_by).toBe(testPastorId);
  });

  it('should maintain complete audit trail for all moderation actions', async () => {
    // Create a new prayer and go through full moderation workflow
    const [prayerError, prayerResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testWallId}::uuid,
          ${testDisruptiveUserId}::uuid,
          'Prayer for audit trail test'
        )
        RETURNING id
      `
    );

    expect(prayerError).toBeUndefined();
    const auditPrayerId = prayerResult![0].id;

    // Step 1: Flag content
    const [flagError, flaggedContent] = await safeExecute(
      moderationService.flagContent(auditPrayerId, testMemberId, 'Audit trail test')
    );

    expect(flagError).toBeUndefined();
    expect(flaggedContent).toBeDefined();

    // Verify initial audit state
    expect(flaggedContent!.flagged_by).toBe(testMemberId);
    expect(flaggedContent!.status).toBe(FlaggedContentStatus.PENDING);
    expect(flaggedContent!.created_at).toBeInstanceOf(Date);
    expect(flaggedContent!.reviewed_by).toBeNull();
    expect(flaggedContent!.reviewed_at).toBeNull();
    expect(flaggedContent!.resolution_action).toBeNull();
    expect(flaggedContent!.resolution_notes).toBeNull();

    // Step 2: Pastor reviews and deletes
    const resolutionNotes = 'Full audit trail test - deleting';
    const [reviewError, reviewedFlag] = await safeExecute(
      moderationService.reviewFlaggedContent(
        flaggedContent!.id,
        'delete',
        testPastorId,
        resolutionNotes
      )
    );

    expect(reviewError).toBeUndefined();

    // Verify complete audit trail is preserved
    expect(reviewedFlag!.id).toBe(flaggedContent!.id);
    expect(reviewedFlag!.prayer_request_id).toBe(auditPrayerId);
    expect(reviewedFlag!.flagged_by).toBe(testMemberId);
    expect(reviewedFlag!.reason).toBe('Audit trail test');
    expect(reviewedFlag!.status).toBe(FlaggedContentStatus.ACTIONED);
    expect(reviewedFlag!.reviewed_by).toBe(testPastorId);
    expect(reviewedFlag!.reviewed_at).not.toBeNull();
    expect(reviewedFlag!.reviewed_at).toBeInstanceOf(Date);
    expect(reviewedFlag!.resolution_action).toBe('delete');
    expect(reviewedFlag!.resolution_notes).toBe(resolutionNotes);
    expect(reviewedFlag!.created_at).toBeInstanceOf(Date);
    expect(reviewedFlag!.updated_at).toBeInstanceOf(Date);

    // Verify audit trail is permanently stored in database
    const [auditError, auditRecord] = await safeExecute(
      db`
        SELECT *
        FROM flagged_content
        WHERE id = ${flaggedContent!.id}
      `
    );

    expect(auditError).toBeUndefined();
    expect(auditRecord![0]).toBeDefined();
    expect(auditRecord![0].flagged_by).toBe(testMemberId);
    expect(auditRecord![0].reviewed_by).toBe(testPastorId);
    expect(auditRecord![0].resolution_action).toBe('delete');
    expect(auditRecord![0].resolution_notes).toBe(resolutionNotes);
  });

  it('should allow pastor to delete content directly without flag review workflow', async () => {
    // Create a new prayer
    const [prayerError, prayerResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (
          ${testWallId}::uuid,
          ${testDisruptiveUserId}::uuid,
          'Prayer to be deleted directly'
        )
        RETURNING id
      `
    );

    expect(prayerError).toBeUndefined();
    const directDeleteId = prayerResult![0].id;

    // Pastor deletes directly (not through flag review)
    const [deleteError, deleteResult] = await safeExecute(
      moderationService.deleteContent(directDeleteId, testPastorId)
    );

    expect(deleteError).toBeUndefined();
    expect(deleteResult).toBe(true);

    // Verify prayer was soft-deleted
    const [verifyError, deletedPrayer] = await safeExecute(
      db`
        SELECT deleted_at, deleted_by
        FROM prayer_requests
        WHERE id = ${directDeleteId}::uuid
      `
    );

    expect(verifyError).toBeUndefined();
    expect(deletedPrayer![0].deleted_at).not.toBeNull();
    expect(deletedPrayer![0].deleted_at).toBeInstanceOf(Date);
    expect(deletedPrayer![0].deleted_by).toBe(testPastorId);
  });

  it('should allow pastor to restore content directly without flag review workflow', async () => {
    // Create a new prayer and soft-delete it
    const [prayerError, prayerResult] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content, deleted_at, deleted_by)
        VALUES (
          ${testWallId}::uuid,
          ${testMemberId}::uuid,
          'Prayer to be restored directly',
          NOW(),
          ${testPastorId}::uuid
        )
        RETURNING id
      `
    );

    expect(prayerError).toBeUndefined();
    const directRestoreId = prayerResult![0].id;

    // Verify prayer is deleted
    const [checkError, deletedPrayer] = await safeExecute(
      db`
        SELECT deleted_at
        FROM prayer_requests
        WHERE id = ${directRestoreId}::uuid
      `
    );

    expect(checkError).toBeUndefined();
    expect(deletedPrayer![0].deleted_at).not.toBeNull();

    // Pastor restores directly
    const [restoreError, restoreResult] = await safeExecute(
      moderationService.restoreContent(directRestoreId, testPastorId)
    );

    expect(restoreError).toBeUndefined();
    expect(restoreResult).toBe(true);

    // Verify prayer was restored
    const [verifyError, restoredPrayer] = await safeExecute(
      db`
        SELECT deleted_at, deleted_by
        FROM prayer_requests
        WHERE id = ${directRestoreId}::uuid
      `
    );

    expect(verifyError).toBeUndefined();
    expect(restoredPrayer![0].deleted_at).toBeNull();
    expect(restoredPrayer![0].deleted_by).toBeNull();
  });

  it('should prevent non-pastor from listing flagged content', async () => {
    // Attempt to list flagged content as a regular member (not pastor)
    const [error, _] = await safeExecute(
      moderationService.listFlaggedContent(testChurchId, testMemberId)
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('Insufficient permissions');
  });

  it('should prevent non-pastor from reviewing flagged content', async () => {
    // Create and flag a prayer first
    const [prayerError, prayer] = await safeExecute(
      db`
        INSERT INTO prayer_requests (wall_id, author_id, content)
        VALUES (${testWallId}::uuid, ${testDisruptiveUserId}::uuid, 'Test prayer for auth')
        RETURNING id
      `
    );

    expect(prayerError).toBeUndefined();

    const [flagError, flag] = await safeExecute(
      moderationService.flagContent(prayer![0].id, testMemberId, 'Test flag for auth')
    );

    expect(flagError).toBeUndefined();

    // Try to review as non-pastor (should fail)
    const [reviewError, _] = await safeExecute(
      moderationService.reviewFlaggedContent(flag!.id, 'delete', testMemberId, 'notes')
    );

    expect(reviewError).toBeDefined();
    expect(reviewError?.message).toContain('Insufficient permissions');
  });

  it('should prevent non-pastor from banning users', async () => {
    // Attempt to ban user as a regular member (not pastor)
    const [error, _] = await safeExecute(
      moderationService.banUser(testWallId, testDisruptiveUserId, testMemberId, false)
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('Insufficient permissions');
  });
});
