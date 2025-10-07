import {z} from 'zod';
import type {PostService} from '../service';
import express from 'express';
import {safeExecute} from '../../utils/handle-async';
import errorCodeFactory from '../../utils/error-code.factory';

export const PostDeleteParamsInput = z.object({
	id: z.uuid(),
});

/**
 * @openapi
 * /posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     description: Permanently delete a post by its unique identifier. Only the post author can delete their posts.
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
 *         description: The unique identifier of the post to delete
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid post ID format
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
export const postDeleteEndpoint = (service: PostService) =>
	async (req: express.Request, res: express.Response) => {
		const parseResult = PostDeleteParamsInput.safeParse(req.params);
		if (!parseResult.success) {
			res.status(400).json({
				error: parseResult.error.message,
				success: false,
			});
			return;
		}
		const {id} = parseResult.data;

		const user = req['user']?.[0];
		const userId = user?.sub;
		if (!userId) {
			res.status(401).json({
				error: 'User authentication required',
				success: false,
			});
			return;
		}

		const [err] = await safeExecute(service.deletePost(id, userId as string));

		if (err) {
			const code = errorCodeFactory(err);
			res.status(code).json({
				error: err.message,
				success: false,
			});
		} else {
			res.json({
				success: true,
				message: 'Post deleted successfully',
			})
		}
	}