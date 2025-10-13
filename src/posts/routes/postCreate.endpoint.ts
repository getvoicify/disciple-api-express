import type {PostService} from '../service';
import type express from 'express';
import {CreatePostInput} from '../schemas';
import {safeExecute} from '../../utils/handle-async';
import errorCodeFactory from '../../utils/error-code.factory';

/**
 * @openapi
 * /posts:
 *   post:
 *     summary: Create a new post
 *     description: Create a new post with optional scripture references, tags, categories, and series association. The post will be created in draft status by default.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePostInput'
 *     responses:
 *       201:
 *         description: Post created successfully
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
 *         description: Invalid input - validation error
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
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const postCreateEndpoint = (service: PostService) =>
	async (req: express.Request, res: express.Response) => {
		const parseResult = CreatePostInput.safeParse(req.body);
		if (!parseResult.success) {
			res.status(400).json({
				error: parseResult.error.message,
				success: false,
			});
			return;
		}
		const postToCreate = parseResult.data;

		// Extract owner ID from the authenticated user's token
		const user = req['user']?.[1]?.payload;
		const userId = user?.sub;
		if (!userId) {
			res.status(401).json({
				error: 'User authentication required',
				success: false,
			});
			return;
		}
		const [err, post] = await safeExecute(service.createPost(postToCreate, userId as string));

		if (err) {
			const code = errorCodeFactory(err);
			res.status(code).json({
				error: err.message,
				success: false,
			});
		} else {
			res.status(201).json({
				post,
				success: true,
			})
		}
	}
