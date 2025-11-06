import type { UserInfoService } from './service';
import type { UserInfo } from './types';
import type { ProfileRepository } from '../profiles/repository';
import type { CacheRepository } from '../cache/cache.repository';
import type { Profile } from '../profiles/schemas';
import { safeExecute } from '../utils/handle-async';
import { logger } from '../logging';

export class UserInfoServiceImpl implements UserInfoService {
  private readonly CACHE_TTL = 900;

  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly cacheRepository: CacheRepository
  ) {}

  async getBatchUserInfo(userIds: string[], requestingUserId: string): Promise<Map<string, UserInfo>> {
    const uniqueUserIds = Array.from(new Set(userIds));
    const { cacheHits, cacheMisses } = await this.checkCache(uniqueUserIds);
    const dbResults = await this.fetchFromDatabase(cacheMisses);

    return new Map([...cacheHits, ...dbResults]);
  }

  private async checkCache(userIds: string[]): Promise<{ cacheHits: Map<string, UserInfo>; cacheMisses: string[] }> {
    const cacheHits = new Map<string, UserInfo>();
    const cacheMisses: string[] = [];

    for (const userId of userIds) {
      const userInfo = await this.getCachedUserInfo(userId);
      if (userInfo) {
        cacheHits.set(userId, userInfo);
      } else {
        cacheMisses.push(userId);
      }
    }

    return { cacheHits, cacheMisses };
  }

  private async getCachedUserInfo(userId: string): Promise<UserInfo | null> {
    const cacheKey = `user:profile:${userId}`;
    const [error, cached] = await safeExecute(this.cacheRepository.read<UserInfo>(cacheKey));

    if (!error && cached) {
      logger.debug({ userId, cacheKey }, 'User info cache hit');
      return cached;
    }

    return null;
  }

  private async fetchFromDatabase(userIds: string[]): Promise<Map<string, UserInfo>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const [error, profiles] = await safeExecute(this.profileRepository.findByIds(userIds));

    if (error) {
      logger.error({ error, userIds }, 'Failed to fetch user profiles');
      return new Map();
    }

    return this.processProfiles(profiles || []);
  }

  private async processProfiles(profiles: Profile[]): Promise<Map<string, UserInfo>> {
    const result = new Map<string, UserInfo>();

    for (const profile of profiles) {
      const userInfo = this.profileToUserInfo(profile);
      result.set(profile.userId, userInfo);
      await this.cacheUserInfo(profile.userId, userInfo);
    }

    logger.debug({ count: profiles.length }, 'Fetched user profiles from database');
    return result;
  }

  private async cacheUserInfo(userId: string, userInfo: UserInfo): Promise<void> {
    const cacheKey = `user:profile:${userId}`;
    const [error] = await safeExecute(this.cacheRepository.write(cacheKey, userInfo, this.CACHE_TTL));

    if (error) {
      logger.warn({ error, userId }, 'Failed to cache user info');
    }
  }

  private profileToUserInfo(profile: Profile): UserInfo {
    return {
      userId: profile.userId,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      displayName: profile.displayName ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      email: profile.email ?? null,
    };
  }
}
