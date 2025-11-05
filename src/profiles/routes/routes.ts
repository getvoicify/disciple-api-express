import { Router } from 'express';
import { jwtVerify } from 'jose';
import { validateToken } from '../../utils/validate-token.middleware';
import { validate } from '../../utils/validate.middleware';
import type { ProfileService } from '../service';
import { CreateProfileInput, UpdateProfileInput } from '../schemas';
import { profileCreateEndpoint } from './profileCreate.endpoint';
import { profileUpdateEndpoint, ProfileUpdateParamsInput } from './profileUpdate.endpoint';
import { profileFetchEndpoint, ProfileFetchParamsInput } from './profileFetch.endpoint';
import { dashboardFetchEndpoint, DashboardFetchParamsInput } from './dashboardFetch.endpoint';
import { profileStatisticsEndpoint, ProfileStatisticsParamsInput } from './profileStatistics.endpoint';

/**
 * Creates and configures the profiles router with all profile-related endpoints
 * @param service - The profile service instance
 * @returns Configured Express router
 */
export const profilesRouter = (service: ProfileService) => {
  const router = Router();
  const { IAM_ENDPOINT, IAM_REALM } = process.env;

  if (!IAM_ENDPOINT || !IAM_REALM) {
    throw new Error('Missing required environment variables: IAM_ENDPOINT and IAM_REALM');
  }

  const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

  // POST /profiles - Create a new profile
  router.post(
    '/',
    [
      tokenVerifier(),
      validate(CreateProfileInput, 'body'),
    ],
    profileCreateEndpoint(service)
  );

  // PUT /profiles/:userId - Update a profile
  router.put(
    '/:userId',
    [
      tokenVerifier(),
      validate(ProfileUpdateParamsInput, 'params'),
      validate(UpdateProfileInput, 'body'),
    ],
    profileUpdateEndpoint(service)
  );

  // GET /profiles/:userId - Fetch a profile
  router.get(
    '/:userId',
    [
      tokenVerifier(),
      validate(ProfileFetchParamsInput, 'params'),
    ],
    profileFetchEndpoint(service)
  );

  // GET /profiles/:userId/dashboard - Fetch user dashboard
  router.get(
    '/:userId/dashboard',
    [
      tokenVerifier(),
      validate(DashboardFetchParamsInput, 'params'),
    ],
    dashboardFetchEndpoint(service)
  );

  // GET /profiles/:userId/statistics - Fetch user statistics
  router.get(
    '/:userId/statistics',
    [
      tokenVerifier(),
      validate(ProfileStatisticsParamsInput, 'params'),
    ],
    profileStatisticsEndpoint(service)
  );

  return router;
};
