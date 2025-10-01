import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { PostFilters, PostStatus } from '../schemas';
import { safeExecute } from '../../utils/handle-async';

// Extended request type to handle authorized resource IDs from middleware
interface RequestWithAuth extends Request {
  authorizedResourceIds?: string[];
}

export const postListEndpoint = (service: PostService) => {
  return async (req: RequestWithAuth, res: Response, next: NextFunction) => {
    // Build filters from query parameters
    const filters: any = {};

    // Add authorized IDs from middleware if present
    if (req.authorizedResourceIds && req.authorizedResourceIds.length > 0) {
      filters.authorizedIds = req.authorizedResourceIds;
    }

    // Church filter
    if (req.query.churchId) {
      filters.churchId = req.query.churchId;
    }

    // Author filter
    if (req.query.authorId) {
      filters.authorId = req.query.authorId;
    }

    // Status filter
    if (req.query.status) {
      filters.status = req.query.status;
    }

    // Series filter
    if (req.query.seriesId) {
      filters.seriesId = req.query.seriesId;
    }

    // Date filters
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
    }

    // Tags filter (comma-separated)
    if (req.query.tags) {
      const tags = req.query.tags as string;
      filters.tags = tags.split(',').map(tag => tag.trim());
    }

    // Categories filter (comma-separated)
    if (req.query.categories) {
      const categories = req.query.categories as string;
      filters.categories = categories.split(',').map(cat => cat.trim());
    }

    // Scripture filter
    if (req.query['scripture.book'] || req.query['scripture.chapter'] || req.query['scripture.verse']) {
      filters.scripture = {};
      if (req.query['scripture.book']) {
        filters.scripture.book = req.query['scripture.book'];
      }
      if (req.query['scripture.chapter']) {
        filters.scripture.chapter = parseInt(req.query['scripture.chapter'] as string);
      }
      if (req.query['scripture.verse']) {
        filters.scripture.verse = parseInt(req.query['scripture.verse'] as string);
      }
    }

    // Validate filters - only if we have filters
    let validFilters;
    if (Object.keys(filters).length > 0) {
      const [parseError, parsed] = await safeExecute(() => PostFilters.parse(filters));
      if (parseError) {
        return next(parseError);
      }
      validFilters = parsed;
    }

    // List posts
    const [error, posts] = await safeExecute(service.listPosts(validFilters));
    if (error) {
      return next(error);
    }

    res.status(200).json(posts);
  };
};