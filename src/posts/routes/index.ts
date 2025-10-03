import type {RequestHandler} from 'express';
import {Router} from 'express';
import type {PostService} from '../service';
import type {SeriesService} from '../../series/service';
import {postCreateEndpoint} from './postCreate.endpoint';
import {postFetchEndpoint} from './postFetch.endpoint';
import {postUpdateEndpoint} from './postUpdate.endpoint';
import {postDeleteEndpoint} from './postDelete.endpoint';
import {postListEndpoint} from './postList.endpoint';
import {postPublishEndpoint} from './postPublish.endpoint';
import {dailyDevotionalsEndpoint} from './dailyDevotionals.endpoint';

export function postRoutes(
  service: PostService,
  authMiddleware: RequestHandler,
  seriesService: SeriesService,
  roleMiddleware?: RequestHandler
): Router {
  const router = Router();

  // Public endpoints (with optional role filtering)
  router.get('/', roleMiddleware || ((req, res, next) => next()), postListEndpoint(service));
  router.get('/:id', postFetchEndpoint(service));

  // Daily devotionals endpoint (requires authentication)
  router.get('/daily-devotionals', authMiddleware, dailyDevotionalsEndpoint(seriesService));

  // Protected endpoints (require authentication)
  router.post('/', authMiddleware, postCreateEndpoint(service));
  router.patch('/:id', authMiddleware, postUpdateEndpoint(service));
  router.delete('/:id', authMiddleware, postDeleteEndpoint(service));
  router.patch('/:id/publish', authMiddleware, postPublishEndpoint(service));

  return router;
}
