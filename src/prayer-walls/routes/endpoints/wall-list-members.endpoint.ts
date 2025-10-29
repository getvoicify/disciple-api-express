import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerWallService } from "../../services/prayer-wall.service";
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /prayer-walls/{wallId}/members:
 *   get:
 *     summary: List members of a prayer wall
 *     description: Get a list of all members in a prayer wall. Only members can view the member list.
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
 *       200:
 *         description: List of wall members
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       wall_id:
 *                         type: string
 *                         format: uuid
 *                       user_id:
 *                         type: string
 *                         format: uuid
 *                       joined_at:
 *                         type: string
 *                         format: date-time
 *                       invited_by:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *       401:
 *         description: User authentication required
 *       403:
 *         description: Forbidden - Only members can view member list
 *       404:
 *         description: Prayer wall not found
 */
export const wallListMembersEndpoint = (service: IPrayerWallService) =>
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

    const [error, members] = await safeExecute(service.listMembers(wallId, userId));

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
      members,
    });
  };
