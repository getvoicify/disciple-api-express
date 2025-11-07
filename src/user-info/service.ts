import type { UserInfo } from './types';

/**
 * User info service interface for batch fetching and caching user data
 */
export interface UserInfoService {
  /**
   * Get batch user info with caching
   * @param userIds - Array of user IDs to fetch
   * @returns Map of userId to UserInfo
   */
  getBatchUserInfo(userIds: string[]): Promise<Map<string, UserInfo>>;
}
