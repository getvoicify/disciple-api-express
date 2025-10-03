import type {NextFunction, Response} from 'express';
import type {PostService} from '../service';
import {CreatePostInput} from '../schemas';
import {safeExecute} from '../../utils/handle-async';
import type {EndpointRequest} from '../../types/endpoint-handler';

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
 *               $ref: '#/components/schemas/Post'
 *       400:
 *         description: Invalid input - validation error
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
export const postCreateEndpoint = (service: PostService) => {
  return async (req: EndpointRequest, res: Response, next: NextFunction) => {
    // Validate user context
    const user = req.user?.[0];
    const userId = user?.sub;
    if (!userId) {
      return next(new Error('User context is required'));
    }

    // Validate request body
    const [parseError, input] = await safeExecute(() => CreatePostInput.parse(req.body));
    if (parseError) {
      return next(parseError);
    }

    // Create post
    const [error, post] = await safeExecute(service.createPost(input!, userId as string));
    if (error) {
      return next(error);
    }

    res.status(201).json(post);
  };
};
