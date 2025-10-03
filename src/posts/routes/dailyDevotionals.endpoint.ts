import type { Response, NextFunction } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import type { SeriesService } from '../../series/service';
import { safeExecute } from '../../utils/handle-async';

export const dailyDevotionalsEndpoint = (
  seriesService: SeriesService
) => {
  return async (req: EndpointRequest, res: Response, next: NextFunction) => {
    const [error, result] = await safeExecute(async () => {
      // Get authenticated user
      const user = req.user?.[0];
      const userId = user?.sub;

      if (!userId) {
        throw new Error('User context is required');
      }

      // Get daily devotionals grouped by date
      return await seriesService.getDailyDevotionals(userId);
    });

    if (error) {
      return next(error);
    }

    return res.status(200).json(result);
  };
};