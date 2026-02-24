import type { RawDb } from '../utils/database';
import type { ResourceInfo, ResourceType } from './types';

export type ResourceResolver = (id: string) => Promise<ResourceInfo | null>;

export function createResolvers(db: RawDb): Record<ResourceType, ResourceResolver> {
  return {
    post: async (id: string) => {
      const result = await db`SELECT author_id, church_id FROM posts WHERE id = ${id}`;
      if (result.length === 0) return null;
      return { authorId: result[0].author_id, churchId: result[0].church_id };
    },

    series: async (id: string) => {
      const result = await db`SELECT author_id, church_id FROM series WHERE id = ${id}`;
      if (result.length === 0) return null;
      return { authorId: result[0].author_id, churchId: result[0].church_id };
    },

    gallery: async (id: string) => {
      const result = await db`SELECT church_id FROM galleries WHERE id = ${id}`;
      if (result.length === 0) return null;
      return { churchId: result[0].church_id };
    },

    note: async (id: string) => {
      const result = await db`SELECT owner_id FROM notes WHERE id = ${id}`;
      if (result.length === 0) return null;
      return { ownerId: result[0].owner_id };
    },

    church: async (id: string) => {
      const result = await db`SELECT created_by FROM churches WHERE id = ${id} AND deleted_at IS NULL`;
      if (result.length === 0) return null;
      return { authorId: result[0].created_by, churchId: id };
    },
  };
}
