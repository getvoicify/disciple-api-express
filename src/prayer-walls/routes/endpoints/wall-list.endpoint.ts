import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerWallService } from "../../services/prayer-wall.service";
import { safeExecute } from '../../../utils/handle-async';

/**
 * @openapi
 * /churches/{churchId}/prayer-walls:
 *   get:
 *     summary: List prayer walls for a church
 *     description: Get a paginated list of prayer walls for a church. Private walls are only visible to members.
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of walls to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of walls to skip
 *     responses:
 *       200:
 *         description: List of prayer walls
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 walls:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PrayerWall'
 *                 total:
 *                   type: integer
 *                   description: Total number of accessible walls
 *                 hasMore:
 *                   type: boolean
 *                   description: Whether there are more walls available
 *       401:
 *         description: User authentication required
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
export const wallListEndpoint = (service: IPrayerWallService) =>
  async (req: EndpointRequest, res: Response) => {
    const { churchId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const user = req.user?.[1]?.payload;
    const userId = user?.sub as string;

    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    const [error, result] = await safeExecute(
      service.listWalls(churchId, userId, { limit: Number(limit), offset: Number(offset) })
    );

    if (error) {
      res.status(400).json({
        error: error.message,
        success: false,
      });
      return;
    }

    res.status(200).json({
      ...result,
      success: true,
    });
  };