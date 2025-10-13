import type express from 'express';
import {z} from 'zod';
import type {PostService} from '../service';
import {type PostFilters} from '../schemas';
import {safeExecute} from '../../utils/handle-async';
import {type CacheRepository} from '../../cache';
import errorCodeFactory from '../../utils/error-code.factory';

export const InputSchema = z.object({
	churchId: z.string().uuid().optional().nullable(),
	authorId: z.string().uuid().optional().nullable(),
	status: z.enum(['draft', 'published']).optional().nullable(),
	seriesId: z.string().uuid().optional().nullable(),
	startDate: z.coerce.date().optional().nullable(),
	endDate: z.coerce.date().optional().nullable(),
	tags: z.string().optional().nullable(),
	categories: z.string().optional().nullable(),
	'scripture.book': z.string().optional().nullable(),
	'scripture.chapter': z.coerce.number().int().positive().optional().nullable(),
	'scripture.verse': z.coerce.number().int().positive().optional().nullable(),
})

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
 *           format: date
 *         description: Filter posts published after this date
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter posts published before this date
 *         example: "2024-12-31"
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
 *           minimum: 1
 *         description: Filter by scripture chapter number
 *         example: 3
 *       - in: query
 *         name: scripture.verse
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter by scripture verse number
 *         example: 16
 *     responses:
 *       200:
 *         description: List of posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Post'
 *                     count:
 *                       type: integer
 *                       description: Number of posts returned
 *                       example: 5
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const postListEndpoint = (service: PostService, cacheRepo: CacheRepository) =>
	async (req: express.Request, res: express.Response) => {
		const parseResult = InputSchema.safeParse(req.query);

		if (!parseResult.success) {
			res.status(400).json({
				error: parseResult.error.message,
				success: false,
			});
			return;
		}

		const {
			churchId,
			authorId,
			status,
			seriesId,
			startDate,
			endDate,
			tags,
			categories,
			'scripture.book': scriptureBook,
			'scripture.chapter': scriptureChapter,
			'scripture.verse': scriptureVerse
		} = parseResult.data;

		const authorizedIds = Array.isArray(req['ids']) ? req['ids'] : [];

		// Build filters with authorization constraint
		const filters: PostFilters = {
			authorizedIds,
			churchId,
			authorId,
			status,
			seriesId,
			startDate,
			endDate,
		};

		// Parse tags and categories if provided
		if (tags) {
			filters.tags = tags.split(',').map(tag => tag.trim()).filter(Boolean);
		}
		if (categories) {
			filters.categories = categories.split(',').map(cat => cat.trim()).filter(Boolean);
		}

		// Only add scripture filter if at least one scripture field is provided
		if (scriptureBook || scriptureChapter !== undefined || scriptureVerse !== undefined) {
			filters.scripture = {};
			if (scriptureBook) {
				filters.scripture.book = scriptureBook;
			}
			if (scriptureChapter !== undefined) {
				filters.scripture.chapter = scriptureChapter;
			}
			if (scriptureVerse !== undefined) {
				filters.scripture.verse = scriptureVerse;
			}
		}

		const [err, posts] = await safeExecute(service.listPosts(filters));

		if (err) {
			const code = errorCodeFactory(err);
			res.status(code).json({
				error: err.message,
				success: false,
			});
			return;
		}

		const response = {
			posts,
			success: true,
			count: posts.length,
		};

		res.json(response);

		const key = req['key'];

		if (key) {
			await safeExecute(cacheRepo.write(key, response));
		}
	}
