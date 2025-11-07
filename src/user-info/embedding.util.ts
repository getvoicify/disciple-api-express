import type { UserInfo } from './types';

/**
 * Extract unique user IDs from an array of entities
 *
 * @template T - The entity type
 * @param entities - Array of entities
 * @param extractor - Function to extract user IDs from an entity
 * @returns Array of unique user IDs
 *
 * @example
 * const authorIds = extractUniqueUserIds(posts, (post) => [post.authorId]);
 */
export function extractUniqueUserIds<T>(
  entities: T[],
  extractor: (entity: T) => string[]
): string[] {
  const allUserIds = entities.flatMap(extractor);
  return Array.from(new Set(allUserIds));
}

/**
 * Generic utility to embed user info into entity arrays
 *
 * @template T - The entity type
 * @param entities - Array of entities to embed user info into
 * @param userIdExtractor - Function to extract user IDs from an entity
 * @param userInfoMap - Map of userId to UserInfo
 * @param embedder - Function to embed user info into an entity
 * @returns Array of entities with embedded user info
 *
 * @example
 * const posts = embedUserInfo(
 *   postList,
 *   (post) => [post.authorId],
 *   userInfoMap,
 *   (post, userMap) => ({ ...post, author: userMap.get(post.authorId) })
 * );
 */
export function embedUserInfo<T>(
  entities: T[],
  userIdExtractor: (entity: T) => string[],
  userInfoMap: Map<string, UserInfo>,
  embedder: (entity: T, users: Map<string, UserInfo>) => T
): T[] {
  return entities.map((entity) => embedder(entity, userInfoMap));
}
