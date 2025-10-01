import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PostService } from '../service';
import { safeExecute } from '../../utils/handle-async';
import type { EndpointRequest } from '../../types/endpoint-handler';

const PublishAction = z.object({
  action: z.enum(['publish', 'unpublish'])
});

export const postPublishEndpoint = (service: PostService) => {
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

    // Validate action
    const [parseError, body] = await safeExecute(() => PublishAction.parse(req.body));
    if (parseError) {
      return next(parseError);
    }

    // Execute action
    let result;
    if (body!.action === 'publish') {
      const [error, post] = await safeExecute(service.publishPost(id!, userId as string));
      if (error) {
        return next(error);
      }
      result = post;
    } else {
      const [error, post] = await safeExecute(service.unpublishPost(id!, userId as string));
      if (error) {
        return next(error);
      }
      result = post;
    }

    res.status(200).json(result);
  };
};