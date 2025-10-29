import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerWallService } from "../../services/prayer-wall.service";
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /churches/{churchId}/prayer-walls/{wallId}:
 *   get:
 *     summary: Get prayer wall details
 *     description: Retrieve details of a specific prayer wall. Only members can view private walls.
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
 *         description: The church ID
 *       - in: path
 *         name: wallId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The prayer wall ID
 *     responses:
 *       200:
 *         description: Prayer wall details
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
 *       404:
 *         description: Prayer wall not found
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
 *                   example: Prayer wall not found
 */
export const wallGetEndpoint = (service: IPrayerWallService) =>
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

    const [error, wall] = await safeExecute(service.getWall(wallId, userId));

    if (error) {
      const statusCode = errorCodeFactory(error);
      res.status(statusCode).json({
        error: error.message,
        success: false,
      });
      return;
    }

    if (!wall) {
      res.status(404).json({
        error: 'Prayer wall not found',
        success: false,
      });
      return;
    }

    res.status(200).json({
      wall,
      success: true,
    });
  };