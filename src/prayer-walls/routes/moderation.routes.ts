import { Router } from 'express';
import { jwtVerify } from 'jose';
import type { Server as SocketServer } from 'socket.io';
import type { IModerationService } from '../services/moderation.service';
import type { IPrayerRequestRepository } from '../repositories/prayer-request.repository';
import { validate } from '../../utils/validate.middleware';
import { validateToken } from '../../utils/validate-token.middleware';
import {
  flagContentSchema,
  reviewFlaggedContentSchema,
  banUserSchema,
  PrayerIdParam,
  WallIdParam,
  ChurchIdParam,
  FlagIdParam,
  UserIdParam,
} from '../schemas/moderation.schemas';

// Import individual endpoint handlers
import { flagContentEndpoint } from './endpoints/moderation/flag-content.endpoint';
import { listFlaggedContentEndpoint } from './endpoints/moderation/list-flagged.endpoint';
import { reviewFlaggedContentEndpoint } from './endpoints/moderation/review-flagged.endpoint';
import { banUserEndpoint } from './endpoints/moderation/ban-user.endpoint';

/**
 * Moderation Router
 * Registers all moderation-related endpoints for content flagging, review, and user banning
 */
export const moderationRouter = (
  service: IModerationService,
  prayerRepository: IPrayerRequestRepository,
  io?: SocketServer
) => {
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

  // POST /prayer-walls/:wallId/prayers/:prayerId/flag - Flag content
  router.post(
    '/prayer-walls/:wallId/prayers/:prayerId/flag',
    [
      tokenVerifier(),
      validate(
        WallIdParam.merge(PrayerIdParam),
        'params'
      ),
      validate(flagContentSchema, 'body'),
    ],
    flagContentEndpoint(service, io)
  );

  // GET /churches/:churchId/moderation/flagged - List flagged content (pastor-only)
  router.get(
    '/churches/:churchId/moderation/flagged',
    [tokenVerifier(), validate(ChurchIdParam, 'params')],
    listFlaggedContentEndpoint(service)
  );

  // POST /moderation/flagged/:flagId/review - Review flagged content (pastor-only)
  router.post(
    '/moderation/flagged/:flagId/review',
    [
      tokenVerifier(),
      validate(FlagIdParam, 'params'),
      validate(reviewFlaggedContentSchema, 'body'),
    ],
    reviewFlaggedContentEndpoint(service, prayerRepository, io)
  );

  // POST /prayer-walls/:wallId/members/:userId/ban - Ban user from wall (pastor-only)
  router.post(
    '/prayer-walls/:wallId/members/:userId/ban',
    [
      tokenVerifier(),
      validate(
        WallIdParam.merge(UserIdParam),
        'params'
      ),
      validate(banUserSchema, 'body'),
    ],
    banUserEndpoint(service, io)
  );

  return router;
};
