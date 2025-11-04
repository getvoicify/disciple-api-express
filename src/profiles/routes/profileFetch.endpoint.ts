import type { ProfileService } from '../service';
import type { Response } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import { z } from 'zod';
import { safeExecute } from '../../utils/handle-async';
import errorCodeFactory from '../../utils/error-code.factory';

export const ProfileFetchParamsInput = z.object({
  userId: z.string().uuid(),
});

/**
 * @openapi
 * /profiles/{userId}:
 *   get:
 *     summary: Get a user profile
 *     description: Retrieve a user profile by ID with privacy enforcement
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the user profile to retrieve
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
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
 *         description: Invalid user ID format
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
 *       403:
 *         description: Access denied - profile is private or not accessible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const profileFetchEndpoint = (service: ProfileService) =>
  async (req: EndpointRequest, res: Response) => {
    // Extract authenticated user ID
    const requestingUserId = req.user?.[1]?.payload?.sub;
    if (!requestingUserId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    // Validate path parameters
    const [paramsError, params] = await safeExecute(() => ProfileFetchParamsInput.parse(req.params));
    if (paramsError) {
      res.status(400).json({
        error: paramsError.message,
        success: false,
      });
      return;
    }

    const { userId } = params;

    // Fetch profile with privacy enforcement
    const [error, profile] = await safeExecute(
      service.getProfile(userId, requestingUserId as string)
    );

    if (error) {
      const code = errorCodeFactory(error);
      res.status(code).json({
        error: error.message,
        success: false,
      });
    } else {
      res.status(200).json({
        profile,
        success: true,
      });
    }
  };
