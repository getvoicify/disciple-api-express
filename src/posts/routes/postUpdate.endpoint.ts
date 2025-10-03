import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { UpdatePostInput } from '../schemas';
import { safeExecute } from '../../utils/handle-async';
import type { EndpointRequest } from '../../types/endpoint-handler';

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
export const postUpdateEndpoint = (service: PostService) => {
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

    // Validate request body
    const [parseError, input] = await safeExecute(() => UpdatePostInput.parse(req.body));
    if (parseError) {
      return next(parseError);
    }

    // Update post
    const [error, post] = await safeExecute(service.updatePost(id!, input!, userId as string));
    if (error) {
      return next(error);
    }

    res.status(200).json(post);
  };
};