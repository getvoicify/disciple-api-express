import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { CreatePostInput } from '../schemas';
import { safeExecute } from '../../utils/handle-async';

export const postCreateEndpoint = (service: PostService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Validate user context
    if (!req.user?.id) {
      return next(new Error('User context is required'));
    }

    // Validate request body
    const [parseError, input] = await safeExecute(() => CreatePostInput.parse(req.body));
    if (parseError) {
      return next(parseError);
    }

    // Create post
    const [error, post] = await safeExecute(service.createPost(input!, req.user.id));
    if (error) {
      return next(error);
    }

    res.status(201).json(post);
  };
};