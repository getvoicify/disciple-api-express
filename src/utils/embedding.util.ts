/**
 * Generic embedding utilities for extracting IDs and embedding related data into entities.
 * These utilities provide type-safe, reusable patterns for batch data embedding across the application.
 */

/**
 * Extract unique IDs from an array of entities
 *
 * @template T - The entity type
 * @template ID - The ID type (defaults to string)
 * @param entities - Array of entities
 * @param extractor - Function to extract IDs from an entity
 * @returns Array of unique IDs
 *
 * @example
 * const authorIds = extractUniqueIds(posts, (post) => [post.authorId]);
 * const participantIds = extractUniqueIds(conversations, (conv) => conv.participantIds);
 */
export function extractUniqueIds<T, ID = string>(
  entities: T[],
  extractor: (entity: T) => ID[]
): ID[] {
  const allIds = entities.flatMap(extractor);
  return Array.from(new Set(allIds));
}

/**
 * Generic utility to embed related info into entity arrays
 *
 * @template T - The entity type
 * @template Info - The info type to embed
 * @param entities - Array of entities to embed info into
 * @param infoMap - Map of ID to Info
 * @param embedder - Function to embed info into an entity
 * @returns Array of entities with embedded info
 *
 * @example
 * const posts = embedInfo(
 *   postList,
 *   userInfoMap,
 *   (post, userMap) => ({ ...post, author: userMap.get(post.authorId) })
 * );
 */
export function embedInfo<T, Info>(
  entities: T[],
  infoMap: Map<string, Info>,
  embedder: (entity: T, infoMap: Map<string, Info>) => T
): T[] {
  return entities.map((entity) => embedder(entity, infoMap));
}
