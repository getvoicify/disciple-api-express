import type { ChurchInfo } from './types';
import { extractUniqueIds, embedInfo } from '../utils/embedding.util';

/**
 * Extract unique church IDs from an array of entities
 *
 * @template T - The entity type
 * @param entities - Array of entities
 * @param extractor - Function to extract church IDs from an entity
 * @returns Array of unique church IDs
 *
 * @example
 * const churchIds = extractUniqueChurchIds(posts, (post) => [post.churchId]);
 */
export function extractUniqueChurchIds<T>(
  entities: T[],
  extractor: (entity: T) => string[]
): string[] {
  return extractUniqueIds(entities, extractor);
}

/**
 * Generic utility to embed church info into entity arrays
 *
 * @template T - The entity type
 * @param entities - Array of entities to embed church info into
 * @param churchInfoMap - Map of churchId to ChurchInfo
 * @param embedder - Function to embed church info into an entity
 * @returns Array of entities with embedded church info
 *
 * @example
 * const posts = embedChurchInfo(
 *   postList,
 *   churchInfoMap,
 *   (post, churchMap) => ({ ...post, church: churchMap.get(post.churchId) })
 * );
 */
export function embedChurchInfo<T>(
  entities: T[],
  churchInfoMap: Map<string, ChurchInfo>,
  embedder: (entity: T, churches: Map<string, ChurchInfo>) => T
): T[] {
  return embedInfo(entities, churchInfoMap, embedder);
}
