import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerWallService } from "../../services/prayer-wall.service";
import { UpdateWallInput } from '../../schemas/wall.schemas';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /churches/{churchId}/prayer-walls/{wallId}:
 *   patch:
 *     summary: Update prayer wall
 *     description: Update prayer wall details. Only the creator can update the wall.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               schedule:
 *                 type: object
 *               video_call_link:
 *                 type: string
 *                 format: uri
 *               status:
 *                 type: string
 *                 enum: [active, archived]
 *     responses:
 *       200:
 *         description: Prayer wall updated successfully
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
 *         description: Forbidden - Only creator can update
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
export const wallUpdateEndpoint = (service: IPrayerWallService) =>
  async (req: EndpointRequest, res: Response) => {
    const { wallId } = req.params;
    const updateData = UpdateWallInput.parse(req.body);

    const user = req.user?.[1]?.payload;
    const userId = user?.sub as string;

    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    const [error, wall] = await safeExecute(service.updateWall(wallId, updateData, userId));

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