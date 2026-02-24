import type { RedisCacheRepository } from '../../cache/redis-cache.repository';
import { safeExecute } from '../../utils/handle-async';
import { logger } from '../../logging';

/**
 * Service interface for managing user presence and typing indicators
 */
export interface IPresenceService {
  setOnline(userId: string, wallId: string): Promise<[Error] | [undefined, void]>;
  setOffline(userId: string, wallId: string): Promise<[Error] | [undefined, void]>;
  setAway(userId: string, wallId: string): Promise<[Error] | [undefined, void]>;
  getOnlineUsers(wallId: string): Promise<[Error] | [undefined, string[]]>;
  setTyping(userId: string, wallId: string, prayerId?: string): Promise<[Error] | [undefined, void]>;
  clearTyping(userId: string, wallId: string, prayerId?: string): Promise<[Error] | [undefined, void]>;
  getTypingUsers(wallId: string, prayerId?: string): Promise<[Error] | [undefined, string[]]>;
}

/**
 * Service for managing real-time presence and typing indicators in prayer walls
 *
 * Uses Redis for scalable presence tracking:
 * - Sorted sets for online presence (score = timestamp)
 * - Strings with TTL for typing indicators (auto-expire after 5 seconds)
 */
export class PresenceService implements IPresenceService {
  private readonly ONLINE_PRESENCE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly TYPING_TTL = 5; // 5 seconds

  constructor(private readonly redis: RedisCacheRepository) {}

  /**
   * Mark user as online in a prayer wall
   * Stores in Redis sorted set with current timestamp
   */
  async setOnline(userId: string, wallId: string): Promise<[Error] | [undefined, void]> {
    const key = `presence:online:${wallId}`;
    const score = Date.now();

    logger.debug({ userId, wallId, key, score }, 'Setting user online');

    const [error] = await safeExecute(async () => {
      // Use the Redis client directly for zadd operation
      const redis = (this.redis as any).redis;
      await redis.zadd(key, score, userId);
    });

    if (error) {
      logger.error({ error, userId, wallId }, 'Failed to set user online');
      return [error];
    }

    // Clean up stale entries (older than 5 minutes)
    const cleanupThreshold = Date.now() - this.ONLINE_PRESENCE_TTL;
    const [cleanupError] = await safeExecute(async () => {
      const redis = (this.redis as any).redis;
      await redis.zremrangebyscore(key, '-inf', cleanupThreshold);
    });

    if (cleanupError) {
      logger.warn({ error: cleanupError, wallId }, 'Failed to cleanup stale presence entries');
    }

    logger.info({ userId, wallId }, 'User marked as online');
    return [undefined, undefined];
  }

  /**
   * Mark user as offline in a prayer wall
   * Removes from Redis sorted set
   */
  async setOffline(userId: string, wallId: string): Promise<[Error] | [undefined, void]> {
    const key = `presence:online:${wallId}`;

    logger.debug({ userId, wallId, key }, 'Setting user offline');

    const [error] = await safeExecute(async () => {
      const redis = (this.redis as any).redis;
      await redis.zrem(key, userId);
    });

    if (error) {
      logger.error({ error, userId, wallId }, 'Failed to set user offline');
      return [error];
    }

    logger.info({ userId, wallId }, 'User marked as offline');
    return [undefined, undefined];
  }

  /**
   * Mark user as away in a prayer wall
   * Currently updates timestamp in sorted set (same as online)
   */
  async setAway(userId: string, wallId: string): Promise<[Error] | [undefined, void]> {
    // For now, away is tracked the same as online in the sorted set
    // Future enhancement: separate away status tracking
    logger.debug({ userId, wallId }, 'Setting user away');
    return this.setOnline(userId, wallId);
  }

  /**
   * Get list of users currently online in a prayer wall
   * Returns users active within the last 5 minutes
   */
  async getOnlineUsers(wallId: string): Promise<[Error] | [undefined, string[]]> {
    const key = `presence:online:${wallId}`;
    const minScore = Date.now() - this.ONLINE_PRESENCE_TTL;

    logger.debug({ wallId, key, minScore }, 'Fetching online users');

    const [error, users] = await safeExecute(async () => {
      const redis = (this.redis as any).redis;
      return await redis.zrangebyscore(key, minScore, '+inf');
    });

    if (error) {
      logger.error({ error, wallId }, 'Failed to get online users');
      return [error];
    }

    logger.debug({ wallId, count: users?.length || 0 }, 'Retrieved online users');
    return [undefined, users || []];
  }

  /**
   * Mark user as typing in a prayer wall or specific prayer
   * Sets Redis key with 5-second TTL for auto-expiration
   */
  async setTyping(userId: string, wallId: string, prayerId?: string): Promise<[Error] | [undefined, void]> {
    const key = prayerId
      ? `typing:${wallId}:${prayerId}:${userId}`
      : `typing:${wallId}:${userId}`;

    logger.debug({ userId, wallId, prayerId, key }, 'Setting user typing');

    const [error] = await safeExecute(async () => {
      const redis = (this.redis as any).redis;
      await redis.setex(key, this.TYPING_TTL, '1');
    });

    if (error) {
      logger.error({ error, userId, wallId, prayerId }, 'Failed to set typing indicator');
      return [error];
    }

    logger.debug({ userId, wallId, prayerId }, 'Typing indicator set');
    return [undefined, undefined];
  }

  /**
   * Clear typing indicator for user in a prayer wall or specific prayer
   * Deletes the Redis key immediately
   */
  async clearTyping(userId: string, wallId: string, prayerId?: string): Promise<[Error] | [undefined, void]> {
    const key = prayerId
      ? `typing:${wallId}:${prayerId}:${userId}`
      : `typing:${wallId}:${userId}`;

    logger.debug({ userId, wallId, prayerId, key }, 'Clearing typing indicator');

    const [error] = await safeExecute(async () => {
      const redis = (this.redis as any).redis;
      await redis.del(key);
    });

    if (error) {
      logger.error({ error, userId, wallId, prayerId }, 'Failed to clear typing indicator');
      return [error];
    }

    logger.debug({ userId, wallId, prayerId }, 'Typing indicator cleared');
    return [undefined, undefined];
  }

  /**
   * Get list of users currently typing in a prayer wall or specific prayer
   * Returns user IDs that have active typing indicators
   *
   * Uses cursor-based SCAN instead of KEYS to avoid blocking the Redis server
   */
  async getTypingUsers(wallId: string, prayerId?: string): Promise<[Error] | [undefined, string[]]> {
    const pattern = prayerId
      ? `typing:${wallId}:${prayerId}:*`
      : `typing:${wallId}:*`;

    logger.debug({ wallId, prayerId, pattern }, 'Fetching typing users');

    const [error, keys] = await safeExecute(async () => {
      const redis = (this.redis as any).redis;
      const collectedKeys: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        collectedKeys.push(...batch);
      } while (cursor !== '0');

      return collectedKeys;
    });

    if (error) {
      logger.error({ error, wallId, prayerId }, 'Failed to get typing users');
      return [error];
    }

    // Extract user IDs from keys
    const userIds = (keys || []).map((key: string) => {
      const parts = key.split(':');
      return parts[parts.length - 1]; // Last segment is userId
    });

    logger.debug({ wallId, prayerId, count: userIds.length }, 'Retrieved typing users');
    return [undefined, userIds];
  }
}
