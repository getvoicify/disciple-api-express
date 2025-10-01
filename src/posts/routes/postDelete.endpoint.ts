import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { safeExecute } from '../../utils/handle-async';
import type { EndpointRequest } from '../../types/endpoint-handler';

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