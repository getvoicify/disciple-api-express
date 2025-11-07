import type { ChurchInfo } from './types';

/**
 * Church info service interface for batch fetching and caching church data
 */
export interface ChurchInfoService {
  /**
   * Get batch church info with caching
   * @param churchIds - Array of church IDs to fetch
   * @returns Map of churchId to ChurchInfo
   */
  getBatchChurchInfo(churchIds: string[]): Promise<Map<string, ChurchInfo>>;
}
