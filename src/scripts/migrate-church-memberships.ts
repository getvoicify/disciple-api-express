#!/usr/bin/env tsx
/**
 * Migration Script: Sync Existing Church Memberships to Keycloak
 *
 * This standalone script migrates all existing church memberships from the database
 * to Keycloak user attributes. It is idempotent and can be safely run multiple times.
 *
 * Usage:
 *   tsx src/scripts/migrate-church-memberships.ts
 *   tsx src/scripts/migrate-church-memberships.ts --dry-run
 */

import dotenv from 'dotenv';
import { getRawDb, type RawDb } from '../utils/database';
import { KeycloakAdminClientImpl, type KeycloakAdminConfig } from '../keycloak/admin-client';
import { ChurchMembershipQueryService } from '../churches/church-membership-query.service';
import { PostgresChurchMemberRepository } from '../churches/postgres-repository';
import { safeExecute } from '../utils/handle-async';
import { logger } from '../logging';

// Load environment variables
dotenv.config();

interface MigrationStats {
  totalUsers: number;
  processedUsers: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  unchangedCount: number;
}

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    batchSize: 100,
  };
}

/**
 * Get all distinct user IDs with active church memberships
 */
async function getAllUsersWithMemberships(db: RawDb): Promise<string[]> {
  logger.info('Querying all users with active church memberships');

  const [error, result] = await safeExecute(
    db<{ user_id: string }[]>`
      SELECT DISTINCT user_id
      FROM church_members
      WHERE status = 'Active'
      ORDER BY user_id
    `
  );

  if (error) {
    logger.error({ error }, 'Failed to query users with memberships');
    throw error;
  }

  const userIds = result.map((row) => row.user_id);
  logger.info({ userCount: userIds.length }, 'Found users with active memberships');

  return userIds;
}

/**
 * Migrate a single user's church memberships to Keycloak
 */
async function migrateUser(
  userId: string,
  membershipService: ChurchMembershipQueryService,
  keycloakClient: KeycloakAdminClientImpl,
  options: MigrationOptions
): Promise<{ success: boolean; skipped: boolean; unchanged: boolean; error?: Error }> {
  try {
    // Get current memberships from database
    const [membershipError, memberships] = await safeExecute(
      membershipService.getUserChurchMemberships(userId)
    );

    if (membershipError) {
      logger.error({ error: membershipError, userId }, 'Failed to query user memberships');
      return { success: false, skipped: false, unchanged: false, error: membershipError };
    }

    // Get existing attributes from Keycloak
    const [getAttrError, existingAttributes] = await safeExecute(
      keycloakClient.getUserAttributes(userId)
    );

    if (getAttrError) {
      // Handle user not found gracefully
      if (isGracefulError(getAttrError)) {
        logger.warn({ userId, error: getAttrError.message }, 'User not found in Keycloak, skipping');
        return { success: false, skipped: true, unchanged: false };
      }
      logger.error({ error: getAttrError, userId }, 'Failed to get user attributes from Keycloak');
      return { success: false, skipped: false, unchanged: false, error: getAttrError };
    }

    // Check if update is needed (idempotency)
    const newAttrValue = JSON.stringify(memberships);
    const existingAttrValue = existingAttributes?.church_membership;

    if (newAttrValue === existingAttrValue) {
      logger.debug({ userId, membershipCount: memberships.length }, 'User attributes already up to date, skipping update');
      return { success: true, skipped: false, unchanged: true };
    }

    if (options.dryRun) {
      logger.info(
        { userId, membershipCount: memberships.length, existingValue: existingAttrValue, newValue: newAttrValue },
        '[DRY RUN] Would update user attributes'
      );
      return { success: true, skipped: false, unchanged: false };
    }

    // Update Keycloak attributes
    const [updateError] = await safeExecute(
      keycloakClient.updateUserAttributes(userId, {
        church_membership: newAttrValue,
      })
    );

    if (updateError) {
      // Handle user not found during update
      if (isGracefulError(updateError)) {
        logger.warn({ userId, error: updateError.message }, 'User not found in Keycloak during update, skipping');
        return { success: false, skipped: true, unchanged: false };
      }
      logger.error({ error: updateError, userId }, 'Failed to update user attributes in Keycloak');
      return { success: false, skipped: false, unchanged: false, error: updateError };
    }

    logger.info({ userId, membershipCount: memberships.length }, 'Successfully synced user memberships to Keycloak');
    return { success: true, skipped: false, unchanged: false };
  } catch (error) {
    logger.error({ error, userId }, 'Unexpected error migrating user');
    return { success: false, skipped: false, unchanged: false, error: error as Error };
  }
}

/**
 * Determine if an error should be handled gracefully (no retry)
 */
function isGracefulError(error: Error): boolean {
  const gracefulErrorNames = ['UserNotFoundError'];
  const gracefulErrorMessages = ['user not found', 'does not exist'];

  return (
    gracefulErrorNames.includes(error.name) ||
    gracefulErrorMessages.some((msg) => error.message?.toLowerCase().includes(msg))
  );
}

/**
 * Process users in batches
 */
async function processBatch(
  userIds: string[],
  batchNumber: number,
  membershipService: ChurchMembershipQueryService,
  keycloakClient: KeycloakAdminClientImpl,
  options: MigrationOptions,
  stats: MigrationStats
): Promise<void> {
  logger.info(
    { batchNumber, batchSize: userIds.length, processedSoFar: stats.processedUsers },
    'Processing batch'
  );

  for (const userId of userIds) {
    const result = await migrateUser(userId, membershipService, keycloakClient, options);

    stats.processedUsers++;

    if (result.success) {
      if (result.unchanged) {
        stats.unchangedCount++;
      } else {
        stats.successCount++;
      }
    } else if (result.skipped) {
      stats.skippedCount++;
    } else {
      stats.failureCount++;
    }
  }

  logger.info(
    {
      batchNumber,
      processed: stats.processedUsers,
      total: stats.totalUsers,
      success: stats.successCount,
      failures: stats.failureCount,
      skipped: stats.skippedCount,
      unchanged: stats.unchangedCount,
    },
    'Batch processing complete'
  );
}

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  const options = parseArgs();

  if (options.dryRun) {
    logger.warn('Running in DRY RUN mode - no changes will be made to Keycloak');
  }

  logger.info('Starting church membership migration to Keycloak');

  // Validate environment variables
  const {
    POSTGRES_DB: DB_NAME,
    POSTGRES_USER: DB_USER,
    POSTGRES_PASSWORD: DB_PASSWORD,
    DB_HOST,
    DB_PORT,
    IAM_ENDPOINT,
    IAM_REALM,
    KEYCLOAK_CLIENT_ID,
    KEYCLOAK_CLIENT_SECRET,
  } = process.env;

  if (!DB_NAME || !DB_USER || !DB_PASSWORD || !DB_HOST || !DB_PORT) {
    logger.error('Missing database configuration environment variables');
    throw new Error('Missing database configuration');
  }

  if (!IAM_ENDPOINT || !IAM_REALM || !KEYCLOAK_CLIENT_ID || !KEYCLOAK_CLIENT_SECRET) {
    logger.error('Missing Keycloak configuration environment variables');
    throw new Error('Missing Keycloak configuration');
  }

  // Initialize database connection
  const db = getRawDb({ DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT });

  // Initialize Keycloak client
  const keycloakConfig: KeycloakAdminConfig = {
    realm: IAM_REALM,
    keycloakUrl: IAM_ENDPOINT.replace('realms', ''),
    clientId: KEYCLOAK_CLIENT_ID,
    clientSecret: KEYCLOAK_CLIENT_SECRET,
  };

  const keycloakClient = new KeycloakAdminClientImpl(keycloakConfig);

  // Initialize membership query service
  const memberRepository = new PostgresChurchMemberRepository(db);
  const membershipService = new ChurchMembershipQueryService(memberRepository);

  // Get all users with memberships
  const [usersError, userIds] = await safeExecute(getAllUsersWithMemberships(db));

  if (usersError) {
    logger.error({ error: usersError }, 'Failed to get users with memberships');
    await db.end();
    process.exit(1);
  }

  if (userIds.length === 0) {
    logger.info('No users with active memberships found');
    await db.end();
    process.exit(0);
  }

  // Initialize stats
  const stats: MigrationStats = {
    totalUsers: userIds.length,
    processedUsers: 0,
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
    unchangedCount: 0,
  };

  logger.info({ totalUsers: stats.totalUsers, batchSize: options.batchSize }, 'Starting migration');

  // Process in batches
  const batches: string[][] = [];
  for (let i = 0; i < userIds.length; i += options.batchSize) {
    batches.push(userIds.slice(i, i + options.batchSize));
  }

  logger.info({ batchCount: batches.length }, 'Split users into batches');

  for (let i = 0; i < batches.length; i++) {
    await processBatch(batches[i], i + 1, membershipService, keycloakClient, options, stats);
  }

  // Final statistics
  logger.info(
    {
      totalUsers: stats.totalUsers,
      processed: stats.processedUsers,
      successful: stats.successCount,
      failed: stats.failureCount,
      skipped: stats.skippedCount,
      unchanged: stats.unchangedCount,
      successRate: ((stats.successCount / stats.totalUsers) * 100).toFixed(2) + '%',
    },
    'Migration completed'
  );

  // Close database connection
  await db.end();

  // Exit with appropriate code
  if (stats.failureCount > 0) {
    logger.warn({ failureCount: stats.failureCount }, 'Migration completed with failures');
    process.exit(1);
  } else {
    logger.info('Migration completed successfully');
    process.exit(0);
  }
}

// Run migration
if (require.main === module) {
  migrate().catch((error) => {
    logger.error({ error }, 'Migration failed with unhandled error');
    process.exit(1);
  });
}

// Export for testing
export { migrate, migrateUser, getAllUsersWithMemberships, parseArgs };
