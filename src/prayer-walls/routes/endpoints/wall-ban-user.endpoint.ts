import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerWallService } from "../../services/prayer-wall.service";
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /prayer-walls/{wallId}/ban/{userId}:
 *   post:
 *     summary: Ban a user from a prayer wall
 *     description: Ban a user from accessing a prayer wall. Only pastors can ban users.
 *     tags: [Prayer Walls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: wallId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The prayer wall ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The user ID to ban
 *     responses:
 *       200:
 *         description: User banned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 banned:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: User authentication required
 *       403:
 *         description: Forbidden - Only pastors can ban users
 */
export const wallBanUserEndpoint = (service: IPrayerWallService) =>
  async (req: EndpointRequest, res: Response) => {
    const { wallId, userId: bannedUserId } = req.params;

    const user = req.user?.[1]?.payload;
    const userId = user?.sub as string;

    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    // Get wall to extract churchId
    const [wallError, wall] = await safeExecute(service.getWall(wallId, userId));

    if (wallError || !wall) {
      const statusCode = wallError ? errorCodeFactory(wallError) : 404;
      res.status(statusCode).json({
        error: wallError?.message || 'Prayer wall not found',
        success: false,
      });
      return;
    }

    const [error, success] = await safeExecute(
      service.banUser(wallId, bannedUserId, userId, wall.church_id)
    );

    if (error) {
      const statusCode = errorCodeFactory(error);
      res.status(statusCode).json({
        error: error.message,
        success: false,
      });
      return;
    }

    res.status(200).json({
      success: true,
      banned: success,
    });
  };