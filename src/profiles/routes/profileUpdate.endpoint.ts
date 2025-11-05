import type { ProfileService } from '../service';
import type { Response } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import { UpdateProfileInput } from '../schemas';
import { z } from 'zod';
import { safeExecute } from '../../utils/handle-async';
import errorCodeFactory from '../../utils/error-code.factory';

export const ProfileUpdateParamsInput = z.object({
  userId: z.uuid(),
});

/**
 * @openapi
 * /profiles/{userId}:
 *   put:
 *     summary: Update an existing user profile
 *     description: Update a user profile. Users can only update their own profiles.
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
 *         description: The unique identifier of the user profile to update
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileInput'
 *           examples:
 *             bioOnly:
 *               summary: Update bio only
 *               value:
 *                 bio: "Updated bio text"
 *             fullUpdate:
 *               summary: Full update
 *               value:
 *                 bio: "Updated church member bio"
 *                 testimony: "Updated testimony"
 *                 privacyMode: "public"
 *                 preferredDevotionalTime: "07:00:00"
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *         description: Invalid input data or user ID format
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
 *         description: Forbidden - cannot update another user's profile
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
export const profileUpdateEndpoint = (service: ProfileService) =>
  async (req: EndpointRequest, res: Response) => {
    // Extract authenticated user ID
    const authenticatedUserId = req.user?.[1]?.payload?.sub;
    if (!authenticatedUserId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    // Validate path parameters
    const [paramsError, params] = await safeExecute(() => ProfileUpdateParamsInput.parse(req.params));
    if (paramsError) {
      res.status(400).json({
        error: paramsError.message,
        success: false,
      });
      return;
    }

    const { userId } = params;

    // Validate request body
    const [parseError, updateData] = await safeExecute(() => UpdateProfileInput.parse(req.body));
    if (parseError) {
      res.status(400).json({
        error: parseError.message,
        success: false,
      });
      return;
    }

    // Update profile (authorization handled in service layer)
    const [error, profile] = await safeExecute(service.updateProfile(userId, authenticatedUserId, updateData));

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
