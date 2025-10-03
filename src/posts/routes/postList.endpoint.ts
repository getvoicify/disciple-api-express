import type {NextFunction, Request, Response} from 'express';
import type {PostService} from '../service';
import {PostFilters} from '../schemas';
import {safeExecute} from '../../utils/handle-async';

// Extended request type to handle authorized resource IDs from middleware
interface RequestWithAuth extends Request {
  authorizedResourceIds?: string[];
}

/**
 * @openapi
 * /posts:
 *   get:
 *     summary: List all posts
 *     description: Retrieve a list of posts with optional filtering by church, author, status, series, date range, tags, categories, or scripture references
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: churchId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by church ID
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by author ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published]
 *         description: Filter by post status
 *       - in: query
 *         name: seriesId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by series ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter posts published after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter posts published before this date
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated list of tags to filter by
 *         example: "devotional,prayer"
 *       - in: query
 *         name: categories
 *         schema:
 *           type: string
 *         description: Comma-separated list of categories to filter by
 *         example: "spiritual growth,worship"
 *       - in: query
 *         name: scripture.book
 *         schema:
 *           type: string
 *         description: Filter by scripture book name
 *         example: "John"
 *       - in: query
 *         name: scripture.chapter
 *         schema:
 *           type: integer
 *         description: Filter by scripture chapter number
 *         example: 3
 *       - in: query
 *         name: scripture.verse
 *         schema:
 *           type: integer
 *         description: Filter by scripture verse number
 *         example: 16
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Post'
 *       400:
 *         description: Invalid filter parameters
 *       500:
 *         description: Internal server error
 */
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
