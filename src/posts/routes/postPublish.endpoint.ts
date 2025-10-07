import {z} from 'zod';
import type {PostService} from '../service';
import express from 'express';
import {safeExecute} from '../../utils/handle-async';
import errorCodeFactory from '../../utils/error-code.factory';

export const PostPublishParamsInput = z.object({
	id: z.uuid(),
});

export const PublishActionInput = z.object({
	action: z.enum(['publish', 'unpublish'])
});

/**
 * @openapi
 * /posts/{id}/publish:
 *   patch:
 *     summary: Publish or unpublish a post
 *     description: Change the publication status of a post. Publishing makes the post visible to church members, while unpublishing returns it to draft status. Only the post author can change the publication status.
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
 *         description: The unique identifier of the post
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [publish, unpublish]
 *                 description: The action to perform on the post
 *           example:
 *             action: "publish"
 *     responses:
 *       200:
 *         description: Post status updated successfully
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
export const postPublishEndpoint = (service: PostService) =>
	async (req: express.Request, res: express.Response) => {
		const paramsParseResult = PostPublishParamsInput.safeParse(req.params);
		if (!paramsParseResult.success) {
			res.status(400).json({
				error: paramsParseResult.error.message,
				success: false,
			});
			return;
		}
		const {id} = paramsParseResult.data;

		const bodyParseResult = PublishActionInput.safeParse(req.body);
		if (!bodyParseResult.success) {
			res.status(400).json({
				error: bodyParseResult.error.message,
				success: false,
			});
			return;
		}
		const {action} = bodyParseResult.data;

		const user = req['user']?.[0];
		const userId = user?.sub;
		if (!userId || typeof userId !== 'string') {
			res.status(401).json({
				error: 'User authentication required',
				success: false,
			});
			return;
		}

		let err, post;
		if (action === 'publish') {
			[err, post] = await safeExecute(service.publishPost(id, userId));
		} else {
			[err, post] = await safeExecute(service.unpublishPost(id, userId));
		}

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
			});
		}
	}