import type {PostService} from '../service';
import type express from 'express';
import {UpdatePostInput} from '../schemas';
import {z} from 'zod';
import {safeExecute} from '../../utils/handle-async';
import errorCodeFactory from '../../utils/error-code.factory';

export const PostUpdateParamsInput = z.object({
	id: z.uuid(),
});

/**
 * @openapi
 * /posts/{id}:
 *   patch:
 *     summary: Update an existing post
 *     description: Update a post's title, content, scripture references, tags, categories, or other fields. All fields are optional. Only the post author can update their posts.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the post to update
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePostInput'
 *     responses:
 *       200:
 *         description: Post updated successfully
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
 *         description: Invalid input data or post ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Not the post author
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
export const postUpdateEndpoint = (service: PostService) =>
	async (req: express.Request, res: express.Response) => {
		const paramsParseResult = PostUpdateParamsInput.safeParse(req.params);
		if (!paramsParseResult.success) {
			res.status(400).json({
				error: paramsParseResult.error.message,
				success: false,
			});
			return;
		}
		const {id} = paramsParseResult.data;

		const bodyParseResult = UpdatePostInput.safeParse(req.body);
		if (!bodyParseResult.success) {
			res.status(400).json({
				error: bodyParseResult.error.message,
				success: false,
			});
			return;
		}
		const updateData = bodyParseResult.data;

		const user = req['user']?.[1]?.payload;
		const userId = user?.sub;
		if (!userId || typeof userId !== 'string') {
			res.status(401).json({
				error: 'User authentication required',
				success: false,
			});
			return;
		}

		const [err, post] = await safeExecute(service.updatePost(id, updateData, userId));

		if (err) {
			const code = errorCodeFactory(err);
			res.status(code).json({
				error: err.message,
				success: false,
			});
		} else {
			res.json({
				post,
				success: true,
			})
		}
	}