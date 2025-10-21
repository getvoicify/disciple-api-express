import {z} from 'zod';
import type {PostService} from '../service';
import type {EndpointRequest} from '../../types/endpoint-handler';
import type express from 'express';
import {safeExecute} from '../../utils/handle-async';
import errorCodeFactory from '../../utils/error-code.factory';

export const PostFetchParamsInput = z.object({
	id: z.uuid(),
});

/**
 * @openapi
 * /posts/{id}:
 *   get:
 *     summary: Get a specific post
 *     description: Retrieve a single post by its unique identifier
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the post to retrieve
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     post:
 *                       $ref: '#/components/schemas/Post'
 *       400:
 *         description: Invalid post ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const postFetchEndpoint = (service: PostService) =>
	async (req: EndpointRequest, res: express.Response) => {
		const parseResult = PostFetchParamsInput.safeParse(req.params);
		if (!parseResult.success) {
			res.status(400).json({
				error: parseResult.error.message,
				success: false,
			});
			return;
		}
		const {id} = parseResult.data;

		const [err, post] = await safeExecute(service.getPostById(id));

		if (err) {
			(req as any).log?.error({ error: err, postId: id }, 'Failed to fetch post');
			const code = errorCodeFactory(err);
			res.status(code).json({
				error: err.message,
				success: false,
			});
			return;
		}

		// Draft posts require authentication
		const isDraftPost = post.status === 'draft';

		if (isDraftPost) {
			// Extract and validate user from JWT payload
			const userPayload = req.user?.[1]?.payload;
			const authenticatedUserId = userPayload?.sub;

			if (!authenticatedUserId) {
				res.status(401).json({
					error: 'Authentication required to view draft posts',
					success: false,
				});
				return;
			}
		}

		// Return the post (either published or authenticated draft)
		res.json({
			post,
			success: true,
		});
	};