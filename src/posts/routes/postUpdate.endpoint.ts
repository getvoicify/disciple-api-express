import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { UpdatePostInput } from '../schemas';
import { safeExecute } from '../../utils/handle-async';

export const postUpdateEndpoint = (service: PostService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Validate user context
    if (!req.user?.id) {
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
    const [error, post] = await safeExecute(service.updatePost(id!, input!, req.user.id));
    if (error) {
      return next(error);
    }

    res.status(200).json(post);
  };
};