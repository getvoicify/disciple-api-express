import type {EndpointRequest} from '../../types/endpoint-handler';
import type express from 'express';
import {z} from 'zod';
import type {PostService} from '../service';
import {type PostFilters} from '../schemas';
import {safeExecute} from '../../utils/handle-async';
import {type CacheRepository} from '../../cache';
import type {ChurchMembershipService} from '../../churches/membership-service';
import errorCodeFactory from '../../utils/error-code.factory';

export const ParamsSchema = z.object({
	churchId: z.uuid(),
});

export const QuerySchema = z.object({
	authorId: z.uuid().optional().nullable(),
	status: z.enum(['draft', 'published']).optional().nullable(),
	seriesId: z.uuid().optional().nullable(),
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
 * /churches/{churchId}/posts:
 *   get:
 *     summary: List posts for a church
 *     description: Retrieve a list of posts for a specific church. User must be an active member of the church. Supports optional filtering by author, status, series, date range, tags, categories, or scripture references.
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: churchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The church ID to list posts for
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
 *         description: Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - User is not an active member of the church
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const postListEndpoint = (service: PostService, cacheRepo: CacheRepository, membershipService: ChurchMembershipService) =>
	async (req: EndpointRequest, res: express.Response) => {
		// Validate path params
		const paramsResult = ParamsSchema.safeParse(req.params);
		if (!paramsResult.success) {
			res.status(400).json({
				error: paramsResult.error.message,
				success: false,
			});
			return;
		}

		const { churchId } = paramsResult.data;

		// Validate query params
		const queryResult = QuerySchema.safeParse(req.query);
		if (!queryResult.success) {
			res.status(400).json({
				error: queryResult.error.message,
				success: false,
			});
			return;
		}

		const {
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
		} = queryResult.data;

		// Draft posts require authentication and active church membership
		const isRequestingDraftPosts = status === 'draft';

		if (isRequestingDraftPosts) {
			// Extract and validate user from JWT payload
			const userPayload = req.user?.[1]?.payload;
			const authenticatedUserId = userPayload?.sub;

			if (!authenticatedUserId) {
				res.status(401).json({
					error: 'User authentication required',
					success: false,
				});
				return;
			}

			// Verify user has active membership in the church
			const [membershipErr, membership] = await safeExecute(
				membershipService.getMembershipByUserAndChurch(authenticatedUserId, churchId)
			);

			if (membershipErr) {
				(req as any).log?.error({ error: membershipErr, userId: authenticatedUserId, churchId }, 'Failed to verify church membership');
				const code = errorCodeFactory(membershipErr);
				res.status(code).json({
					error: membershipErr.message,
					success: false,
				});
				return;
			}

			if (!membership) {
				res.status(403).json({
					error: 'You are not a member of this church',
					success: false,
				});
				return;
			}

			if (membership.status !== 'Active') {
				res.status(403).json({
					error: 'You must be an active member of this church',
					success: false,
				});
				return;
			}
		}

		// Build filters - churchId is required from path
		// Default to published posts for public access
		const filters: PostFilters = {
			churchId,
			authorId,
			status: status || 'published',
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
			(req as any).log?.error({ error: err, filters }, 'Failed to list posts');
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
			(req as any).log?.debug({ key }, 'Writing cache');
			await safeExecute(cacheRepo.write(key, response));
		}
	}
