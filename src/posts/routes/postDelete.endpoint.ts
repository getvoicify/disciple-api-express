import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { safeExecute } from '../../utils/handle-async';

export const postDeleteEndpoint = (service: PostService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Validate user context
    if (!req.user?.id) {
      return next(new Error('User context is required'));
    }

    // Validate id parameter
    const [parseError, id] = await safeExecute(() => z.string().uuid().parse(req.params.id));
    if (parseError) {
      return next(parseError);
    }

    // Delete post
    const [error] = await safeExecute(service.deletePost(id!, req.user.id));
    if (error) {
      return next(error);
    }

    res.status(204).json({ message: 'Post deleted successfully' });
  };
};