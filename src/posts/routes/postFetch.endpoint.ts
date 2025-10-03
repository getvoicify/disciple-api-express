import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { safeExecute } from '../../utils/handle-async';

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
 *               $ref: '#/components/schemas/Post'
 *       400:
 *         description: Invalid UUID format
 *       404:
 *         description: Post not found
 *       500:
 *         description: Internal server error
 */
export const postFetchEndpoint = (service: PostService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Validate id parameter
    const [parseError, id] = await safeExecute(() => z.string().uuid().parse(req.params.id));
    if (parseError) {
      return next(parseError);
    }

    // Fetch post
    const [error, post] = await safeExecute(service.getPostById(id!));
    if (error) {
      return next(error);
    }

    res.status(200).json(post);
  };
};