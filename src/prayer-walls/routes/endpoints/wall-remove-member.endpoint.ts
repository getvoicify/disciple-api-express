import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerWallService } from "../../services/prayer-wall.service";
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /prayer-walls/{wallId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a prayer wall
 *     description: Remove a user from a prayer wall. Only pastors can remove members.
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
 *         description: The user ID to remove
 *     responses:
 *       200:
 *         description: Member removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 removed:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: User authentication required
 *       403:
 *         description: Forbidden - Only pastors can remove members
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
 */
export const wallRemoveMemberEndpoint = (service: IPrayerWallService) =>
  async (req: EndpointRequest, res: Response) => {
    const { wallId, userId: memberId } = req.params;

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
      service.removeMember(wallId, memberId, userId, wall.church_id)
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
      removed: success,
    });
  };