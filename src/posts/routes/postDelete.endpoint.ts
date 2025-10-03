import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { safeExecute } from '../../utils/handle-async';
import type { EndpointRequest } from '../../types/endpoint-handler';

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
 *       204:
 *         description: Post deleted successfully (no content)
 *       400:
 *         description: Invalid UUID format
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Not the post author
 *       404:
 *         description: Post not found
 *       500:
 *         description: Internal server error
 */
export const postDeleteEndpoint = (service: PostService) => {
  return async (req: EndpointRequest, res: Response, next: NextFunction) => {
    // Validate user context
    const user = req.user?.[0];
    const userId = user?.sub;
    if (!userId) {
      return next(new Error('User context is required'));
    }

    // Validate id parameter
    const [parseError, id] = await safeExecute(() => z.string().uuid().parse(req.params.id));
    if (parseError) {
      return next(parseError);
    }

    // Delete post
    const [error] = await safeExecute(service.deletePost(id!, userId as string));
    if (error) {
      return next(error);
    }

    res.status(204).json({ message: 'Post deleted successfully' });
  };
};