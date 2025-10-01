import type {NextFunction, Response} from 'express';
import type {PostService} from '../service';
import {CreatePostInput} from '../schemas';
import {safeExecute} from '../../utils/handle-async';
import type {EndpointRequest} from '../../types/endpoint-handler';

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
