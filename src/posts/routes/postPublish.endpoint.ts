import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { safeExecute } from '../../utils/handle-async';
import type { EndpointRequest } from '../../types/endpoint-handler';

const PublishAction = z.object({
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
 *               $ref: '#/components/schemas/Post'
 *       400:
 *         description: Invalid input - validation error
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Not the post author
 *       404:
 *         description: Post not found
 *       500:
 *         description: Internal server error
 */
export const postPublishEndpoint = (service: PostService) => {
  return async (req: EndpointRequest, res: Response, next: NextFunction) => {
    // Validate user context
    const user = req.user?.[0];
    const userId = user?.sub;
    if (!userId) {
      return next(new Error('User context is required'));
    }

    // Validate id parameter
    const [idError, id] = await safeExecute(() => z.string().uuid().parse(req.params.id));
    if (idError) {
      return next(idError);
    }

    // Validate action
    const [parseError, body] = await safeExecute(() => PublishAction.parse(req.body));
    if (parseError) {
      return next(parseError);
    }

    // Execute action
    let result;
    if (body!.action === 'publish') {
      const [error, post] = await safeExecute(service.publishPost(id!, userId as string));
      if (error) {
        return next(error);
      }
      result = post;
    } else {
      const [error, post] = await safeExecute(service.unpublishPost(id!, userId as string));
      if (error) {
        return next(error);
      }
      result = post;
    }

    res.status(200).json(result);
  };
};