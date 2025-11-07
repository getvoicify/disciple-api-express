import type { ChurchInfoService } from './service';
import type { ChurchInfo } from './types';
import type { IChurchRepository } from '../churches/repository';
import type { CacheRepository } from '../cache';
import type { Church } from '../churches/schemas';
import { safeExecute } from '../utils/handle-async';
import { logger } from '../logging';

export class ChurchInfoServiceImpl implements ChurchInfoService {
  private readonly CACHE_TTL = parseInt(
    process.env['CHURCH_INFO_CACHE_TTL'] || '3600',
    10
  );

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly cacheRepository: CacheRepository
  ) {}

  async getBatchChurchInfo(churchIds: string[]): Promise<Map<string, ChurchInfo>> {
    const uniqueChurchIds = Array.from(new Set(churchIds));
    const { cacheHits, cacheMisses } = await this.checkCache(uniqueChurchIds);
    const dbResults = await this.fetchFromDatabase(cacheMisses);

    return new Map([...cacheHits, ...dbResults]);
  }

  private async checkCache(churchIds: string[]): Promise<{ cacheHits: Map<string, ChurchInfo>; cacheMisses: string[] }> {
    const cacheHits = new Map<string, ChurchInfo>();
    const cacheMisses: string[] = [];

    for (const churchId of churchIds) {
      const churchInfo = await this.getCachedChurchInfo(churchId);
      if (churchInfo) {
        cacheHits.set(churchId, churchInfo);
      } else {
        cacheMisses.push(churchId);
      }
    }

    return { cacheHits, cacheMisses };
  }

  private async getCachedChurchInfo(churchId: string): Promise<ChurchInfo | null> {
    const cacheKey = `church:info:${churchId}`;
    const [error, cached] = await safeExecute(this.cacheRepository.read<ChurchInfo>(cacheKey));

    if (!error && cached) {
      logger.debug({ churchId, cacheKey }, 'Church info cache hit');
      return cached;
    }

    return null;
  }

  private async fetchFromDatabase(churchIds: string[]): Promise<Map<string, ChurchInfo>> {
    if (churchIds.length === 0) {
      return new Map();
    }

    const [error, churches] = await safeExecute(this.churchRepository.findByIds(churchIds));

    if (error) {
      logger.error({ error, churchIds }, 'Failed to fetch churches');
      return new Map();
    }

    return this.processChurches(churches || []);
  }

  private async processChurches(churches: Church[]): Promise<Map<string, ChurchInfo>> {
    const result = new Map<string, ChurchInfo>();

    for (const church of churches) {
      const churchInfo = this.churchToChurchInfo(church);
      result.set(church.id, churchInfo);
      await this.cacheChurchInfo(church.id, churchInfo);
    }

    logger.debug({ count: churches.length }, 'Fetched churches from database');
    return result;
  }

  private async cacheChurchInfo(churchId: string, churchInfo: ChurchInfo): Promise<void> {
    const cacheKey = `church:info:${churchId}`;
    const [error] = await safeExecute(this.cacheRepository.write(cacheKey, churchInfo, this.CACHE_TTL));

    if (error) {
      logger.warn({ error, churchId }, 'Failed to cache church info');
    }
  }

  private churchToChurchInfo(church: Church): ChurchInfo {
    return {
      id: church.id,
      slug: church.slug,
      name: church.name,
      description: church.description ?? null,
      logoUrl: church.logoUrl ?? null,
      byline: church.byline ?? null,
    };
  }
}
