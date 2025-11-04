import type { ProfileService } from '../service';
import type { Response } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import { z } from 'zod';
import { safeExecute } from '../../utils/handle-async';
import errorCodeFactory from '../../utils/error-code.factory';

export const DashboardFetchParamsInput = z.object({
  userId: z.string().uuid(),
});

/**
 * @openapi
 * /profiles/{userId}/dashboard:
 *   get:
 *     summary: Get user dashboard data
 *     description: Retrieve personalized dashboard showing recent notes, active prayer requests, devotional progress, and statistics. Users can only view their own dashboard.
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
 *         description: Dashboard retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     dashboard:
 *                       $ref: '#/components/schemas/DashboardData'
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
 *         description: Forbidden - can only view own dashboard
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const dashboardFetchEndpoint = (service: ProfileService) =>
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
    const [paramsError, params] = await safeExecute(() => DashboardFetchParamsInput.parse(req.params));
    if (paramsError) {
      res.status(400).json({
        error: paramsError.message,
        success: false,
      });
      return;
    }

    const { userId } = params;

    // Fetch dashboard data (authorization handled in service layer)
    const [error, dashboard] = await safeExecute(service.getDashboard(userId, authenticatedUserId));

    if (error) {
      const code = errorCodeFactory(error);
      res.status(code).json({
        error: error.message,
        success: false,
      });
    } else {
      res.status(200).json({
        dashboard,
        success: true,
      });
    }
  };
