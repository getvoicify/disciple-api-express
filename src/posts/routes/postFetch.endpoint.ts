import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { safeExecute } from '../../utils/handle-async';

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