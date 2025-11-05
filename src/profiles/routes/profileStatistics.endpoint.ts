import type { ProfileService } from '../service';
import type { Response } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import { z } from 'zod';
import { safeExecute } from '../../utils/handle-async';
import errorCodeFactory from '../../utils/error-code.factory';

export const ProfileStatisticsParamsInput = z.object({
  userId: z.string().uuid(),
});

/**
 * @openapi
 * /profiles/{userId}/statistics:
 *   get:
 *     summary: Get user engagement statistics
 *     description: Retrieve aggregated statistics including notes count, prayers count, devotionals count, and days active. Respects field visibility settings.
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
 *         description: The unique identifier of the user
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     statistics:
 *                       $ref: '#/components/schemas/ProfileStatistics'
 *       400:
 *         description: Invalid user ID format or error calculating statistics
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
 *       404:
 *         description: User profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const profileStatisticsEndpoint = (service: ProfileService) =>
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
    const [paramsError, params] = await safeExecute(() => ProfileStatisticsParamsInput.parse(req.params));
    if (paramsError) {
      res.status(400).json({
        error: paramsError.message,
        success: false,
      });
      return;
    }

    const { userId } = params;

    // Fetch statistics
    const [error, statistics] = await safeExecute(service.getStatistics(userId));

    if (error) {
      const code = errorCodeFactory(error);
      res.status(code).json({
        error: error.message,
        success: false,
      });
    } else {
      res.status(200).json({
        statistics,
        success: true,
      });
    }
  };
