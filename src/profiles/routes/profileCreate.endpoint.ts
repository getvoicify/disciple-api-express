import type { ProfileService } from '../service';
import type { Response } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import { CreateProfileInput, JwtClaims } from '../schemas';
import { safeExecute } from '../../utils/handle-async';
import errorCodeFactory from '../../utils/error-code.factory';

/**
 * @openapi
 * /profiles:
 *   post:
 *     summary: Create a new user profile
 *     description: Create a user profile with auto-population from JWT authentication claims
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProfileInput'
 *           examples:
 *             basic:
 *               summary: Basic profile
 *               value:
 *                 bio: "Member of the church since 2020"
 *                 testimony: "God changed my life..."
 *             withPhoto:
 *               summary: Profile with photo
 *               value:
 *                 bio: "Church member and youth leader"
 *                 testimony: "I found Christ in 2018"
 *                 profilePhotoMediaId: "550e8400-e29b-41d4-a716-446655440000"
 *                 privacyMode: "church_only"
 *     responses:
 *       201:
 *         description: Profile created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     profile:
 *                       $ref: '#/components/schemas/Profile'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const profileCreateEndpoint = (service: ProfileService) =>
  async (req: EndpointRequest, res: Response) => {
    // Extract user ID from authenticated user's token
    const userId = req.user?.[1]?.payload?.sub;
    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    // Validate input
    const [parseError, profileInput] = await safeExecute(() => CreateProfileInput.parse(req.body));
    if (parseError) {
      res.status(400).json({
        error: parseError.message,
        success: false,
      });
      return;
    }

    // Extract standard OIDC claims from JWT payload for populating profile
    const jwtPayload = req.user?.[1]?.payload;
    const [claimsParseError, jwtClaims] = await safeExecute(() =>
      JwtClaims.parse({
        given_name: jwtPayload?.given_name,
        family_name: jwtPayload?.family_name,
        email: jwtPayload?.email,
      })
    );

    // Log if JWT claims parsing fails (non-blocking)
    if (claimsParseError) {
      (req as any).log?.warn({ error: claimsParseError, userId }, 'Failed to parse JWT claims');
    }

    // Create profile with JWT claims
    const [error, profile] = await safeExecute(
      service.createProfile(
        userId as string,
        profileInput,
        claimsParseError ? undefined : jwtClaims
      )
    );

    if (error) {
      const code = errorCodeFactory(error);
      res.status(code).json({
        error: error.message,
        success: false,
      });
    } else {
      (req as any).log?.info({ userId, profileId: profile.userId }, 'Profile created successfully');
      res.status(201).json({
        profile,
        success: true,
      });
    }
  };
