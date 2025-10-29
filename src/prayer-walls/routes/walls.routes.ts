import { Router } from 'express';
import { jwtVerify } from 'jose';
import type { IPrayerWallService } from '../services/prayer-wall.service';
import { validate } from '../../utils/validate.middleware';
import { validateToken } from '../../utils/validate-token.middleware';
import {
  CreateWallInput,
  UpdateWallInput,
  ChurchIdParams,
  ChurchWallParams,
  WallIdParams,
  WallUserParams,
  InviteMemberInput,
  PaginationQuery,
} from '../schemas/wall.schemas';

// Import individual endpoint handlers
import { wallCreateEndpoint } from './endpoints/wall-create.endpoint';
import { wallListEndpoint } from './endpoints/wall-list.endpoint';
import { wallGetEndpoint } from './endpoints/wall-get.endpoint';
import { wallUpdateEndpoint } from './endpoints/wall-update.endpoint';
import { wallArchiveEndpoint } from './endpoints/wall-archive.endpoint';
import { wallJoinEndpoint } from './endpoints/wall-join.endpoint';
import { wallLeaveEndpoint } from './endpoints/wall-leave.endpoint';
import { wallInviteEndpoint } from './endpoints/wall-invite.endpoint';
import { wallRemoveMemberEndpoint } from './endpoints/wall-remove-member.endpoint';
import { wallBanUserEndpoint } from './endpoints/wall-ban-user.endpoint';
import { wallListMembersEndpoint } from './endpoints/wall-list-members.endpoint';

/**
 * Prayer Walls Router
 * Registers all wall-related endpoints
 */
export const wallsRouter = (service: IPrayerWallService) => {
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

  // POST /churches/:churchId/prayer-walls - Create wall (pastors only)
  router.post(
    '/churches/:churchId/prayer-walls',
    [tokenVerifier(), validate(ChurchIdParams, 'params'), validate(CreateWallInput, 'body')],
    wallCreateEndpoint(service)
  );

  // GET /churches/:churchId/prayer-walls - List walls
  router.get(
    '/churches/:churchId/prayer-walls',
    [tokenVerifier(), validate(ChurchIdParams, 'params'), validate(PaginationQuery, 'query')],
    wallListEndpoint(service)
  );

  // GET /churches/:churchId/prayer-walls/:wallId - Get wall details
  router.get(
    '/churches/:churchId/prayer-walls/:wallId',
    [tokenVerifier(), validate(ChurchWallParams, 'params')],
    wallGetEndpoint(service)
  );

  // PATCH /churches/:churchId/prayer-walls/:wallId - Update wall (creator only)
  router.patch(
    '/churches/:churchId/prayer-walls/:wallId',
    [
      tokenVerifier(),
      validate(ChurchWallParams, 'params'),
      validate(UpdateWallInput, 'body'),
    ],
    wallUpdateEndpoint(service)
  );

  // DELETE /churches/:churchId/prayer-walls/:wallId - Archive wall (soft delete)
  router.delete(
    '/churches/:churchId/prayer-walls/:wallId',
    [tokenVerifier(), validate(ChurchWallParams, 'params')],
    wallArchiveEndpoint(service)
  );

  // POST /prayer-walls/:wallId/join - Join wall
  router.post(
    '/prayer-walls/:wallId/join',
    [tokenVerifier(), validate(WallIdParams, 'params')],
    wallJoinEndpoint(service)
  );

  // POST /prayer-walls/:wallId/leave - Leave wall
  router.post(
    '/prayer-walls/:wallId/leave',
    [tokenVerifier(), validate(WallIdParams, 'params')],
    wallLeaveEndpoint(service)
  );

  // POST /prayer-walls/:wallId/invite - Invite member (pastors)
  router.post(
    '/prayer-walls/:wallId/invite',
    [
      tokenVerifier(),
      validate(WallIdParams, 'params'),
      validate(InviteMemberInput, 'body'),
    ],
    wallInviteEndpoint(service)
  );

  // DELETE /prayer-walls/:wallId/members/:userId - Remove member (pastors)
  router.delete(
    '/prayer-walls/:wallId/members/:userId',
    [tokenVerifier(), validate(WallUserParams, 'params')],
    wallRemoveMemberEndpoint(service)
  );

  // POST /prayer-walls/:wallId/ban/:userId - Ban user (pastors)
  router.post(
    '/prayer-walls/:wallId/ban/:userId',
    [tokenVerifier(), validate(WallUserParams, 'params')],
    wallBanUserEndpoint(service)
  );

  // GET /prayer-walls/:wallId/members - List members
  router.get(
    '/prayer-walls/:wallId/members',
    [tokenVerifier(), validate(WallIdParams, 'params')],
    wallListMembersEndpoint(service)
  );

  return router;
};