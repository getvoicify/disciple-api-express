import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerWallService } from "../../services/prayer-wall.service";
import { WallStatus } from '../../types/prayer-wall.types';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /churches/{churchId}/prayer-walls/{wallId}:
 *   delete:
 *     summary: Archive prayer wall
 *     description: Soft delete a prayer wall by archiving it. Only the creator can archive the wall.
 *     tags: [Prayer Walls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: churchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: wallId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Prayer wall archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 wall:
 *                   $ref: '#/components/schemas/PrayerWall'
 *       401:
 *         description: User authentication required
 *       403:
 *         description: Forbidden - Only creator can archive
 */
export const wallArchiveEndpoint = (service: IPrayerWallService) =>
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

    // Archive is just an update with status = 'archived'
    const [error, wall] = await safeExecute(
      service.updateWall(wallId, { status: WallStatus.ARCHIVED }, userId)
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
      wall,
      success: true,
    });
  };