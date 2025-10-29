import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerWallService } from "../../services/prayer-wall.service";
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /prayer-walls/{wallId}/join:
 *   post:
 *     summary: Join a prayer wall
 *     description: Join a prayer wall. Public walls can be joined freely. Private walls require an invitation.
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
 *     responses:
 *       201:
 *         description: Successfully joined the prayer wall
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 membership:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     wall_id:
 *                       type: string
 *                       format: uuid
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                     joined_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Cannot join (already member, banned, or private without invitation)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *       401:
 *         description: User authentication required
 */
export const wallJoinEndpoint = (service: IPrayerWallService) =>
  async (req: EndpointRequest, res: Response) => {
    const { wallId } = req.params;

    const user = req.user?.[1]?.payload;
    const userId = user?.sub as string;

    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    const [error, membership] = await safeExecute(service.joinWall(wallId, userId));

    if (error) {
      const statusCode = errorCodeFactory(error);
      res.status(statusCode).json({
        error: error.message,
        success: false,
      });
      return;
    }

    res.status(201).json({
      membership,
      success: true,
    });
  };