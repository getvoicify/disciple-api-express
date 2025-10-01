import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { UpdatePostInput } from '../schemas';
import { safeExecute } from '../../utils/handle-async';
import type { EndpointRequest } from '../../types/endpoint-handler';

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