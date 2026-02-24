// Authorization: Prayer request routes use service-level authorization (membership checks,
// role verification, creator-only operations) rather than the centralized authorize() middleware.
// See: prayer-request.service.ts

import { Router } from 'express';
import { jwtVerify } from 'jose';
import type { Server as SocketServer } from 'socket.io';
import type { IPrayerRequestService } from '../services/prayer-request.service';
import { validate } from '../../utils/validate.middleware';
import { validateToken } from '../../utils/validate-token.middleware';
import {
  CreatePrayerInput,
  UpdatePrayerInput,
  PrayerResponseInput,
  PrayerIdParams,
  WallIdParams,
  CursorPaginationQuery,
} from '../schemas/prayer.schemas';
import { logger } from '../../logging';
import { JwtUserInfoExtractor } from '../../websocket/services/user-info-extractor.service';

// Import individual endpoint handlers
import { prayerCreateEndpoint } from './endpoints/prayer-create.endpoint';
import { prayerListEndpoint } from './endpoints/prayer-list.endpoint';
import { prayerListRootEndpoint } from './endpoints/prayer-list-root.endpoint';
import { prayerGetEndpoint } from './endpoints/prayer-get.endpoint';
import { prayerGetChildrenEndpoint } from './endpoints/prayer-get-children.endpoint';
import { prayerGetThreadEndpoint } from './endpoints/prayer-get-thread.endpoint';
import { prayerUpdateEndpoint } from './endpoints/prayer-update.endpoint';
import { prayerDeleteEndpoint } from './endpoints/prayer-delete.endpoint';
import { prayerRestoreEndpoint } from './endpoints/prayer-restore.endpoint';
import { prayerAddResponseEndpoint } from './endpoints/prayer-add-response.endpoint';

/**
 * Prayer Requests Router
 * Registers all prayer request-related endpoints
 *
 * Note: File attachments use the existing /api/media/upload endpoint.
 * Prayers reference media IDs via the has_attachment field.
 * Full attachment integration will be implemented in Task Group 20.
 */
export const prayersRouter = (service: IPrayerRequestService, io?: SocketServer) => {
  const router = Router();
  const { IAM_ENDPOINT, IAM_REALM } = process.env;

  // Validate required environment variables
  if (!IAM_ENDPOINT || !IAM_ENDPOINT.trim()) {
    throw new Error('Missing required environment variable: IAM_ENDPOINT');
  }

  if (!IAM_REALM || !IAM_REALM.trim()) {
    throw new Error('Missing required environment variable: IAM_REALM');
  }

  const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

  // Initialize user info extractor for extracting author names from JWT tokens
  const userInfoExtractor = new JwtUserInfoExtractor(logger);

  // GET /prayer-walls/:wallId/prayers - List prayers (paginated, 20 per page)
  router.get(
    '/prayer-walls/:wallId/prayers',
    [tokenVerifier(), validate(WallIdParams, 'params'), validate(CursorPaginationQuery, 'query')],
    prayerListEndpoint(service)
  );

  // GET /prayer-walls/:wallId/prayers/root - List only root prayers (optimized query)
  router.get(
    '/prayer-walls/:wallId/prayers/root',
    [tokenVerifier(), validate(WallIdParams, 'params'), validate(CursorPaginationQuery, 'query')],
    prayerListRootEndpoint(service)
  );

  // POST /prayer-walls/:wallId/prayers - Submit prayer
  router.post(
    '/prayer-walls/:wallId/prayers',
    [tokenVerifier(), validate(WallIdParams, 'params'), validate(CreatePrayerInput, 'body')],
    prayerCreateEndpoint(service, io, userInfoExtractor)
  );

  // GET /prayer-walls/:wallId/prayers/:prayerId - Get prayer with thread
  router.get(
    '/prayer-walls/:wallId/prayers/:prayerId',
    [tokenVerifier(), validate(PrayerIdParams, 'params')],
    prayerGetEndpoint(service)
  );

  // PATCH /prayer-walls/:wallId/prayers/:prayerId - Edit prayer (5 min window)
  router.patch(
    '/prayer-walls/:wallId/prayers/:prayerId',
    [
      tokenVerifier(),
      validate(PrayerIdParams, 'params'),
      validate(UpdatePrayerInput, 'body'),
    ],
    prayerUpdateEndpoint(service, io)
  );

  // DELETE /prayer-walls/:wallId/prayers/:prayerId - Soft-delete prayer
  router.delete(
    '/prayer-walls/:wallId/prayers/:prayerId',
    [tokenVerifier(), validate(PrayerIdParams, 'params')],
    prayerDeleteEndpoint(service, io)
  );

  // POST /prayer-walls/:wallId/prayers/:prayerId/restore - Restore deleted prayer
  router.post(
    '/prayer-walls/:wallId/prayers/:prayerId/restore',
    [tokenVerifier(), validate(PrayerIdParams, 'params')],
    prayerRestoreEndpoint(service)
  );

  // POST /prayer-walls/:wallId/prayers/:prayerId/responses - Add response (threading)
  router.post(
    '/prayer-walls/:wallId/prayers/:prayerId/responses',
    [
      tokenVerifier(),
      validate(PrayerIdParams, 'params'),
      validate(PrayerResponseInput, 'body'),
    ],
    prayerAddResponseEndpoint(service, io, userInfoExtractor)
  );

  // GET /prayer-walls/:wallId/prayers/:prayerId/children - Get immediate children (lazy loading)
  router.get(
    '/prayer-walls/:wallId/prayers/:prayerId/children',
    [tokenVerifier(), validate(PrayerIdParams, 'params')],
    prayerGetChildrenEndpoint(service)
  );

  // GET /prayer-walls/:wallId/prayers/:prayerId/thread - Get full thread tree (recursive)
  router.get(
    '/prayer-walls/:wallId/prayers/:prayerId/thread',
    [tokenVerifier(), validate(PrayerIdParams, 'params')],
    prayerGetThreadEndpoint(service)
  );

  return router;
};
