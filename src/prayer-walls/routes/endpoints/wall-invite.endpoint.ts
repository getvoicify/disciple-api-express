import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerWallService } from "../../services/prayer-wall.service";
import { InviteMemberInput } from '../../schemas/wall.schemas';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /prayer-walls/{wallId}/invite:
 *   post:
 *     summary: Invite a member to a prayer wall
 *     description: Invite a user to join a prayer wall. Only pastors and wall creators can send invitations.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: The user ID to invite
 *           example:
 *             userId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       201:
 *         description: Member invited successfully
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
 *       401:
 *         description: User authentication required
 *       403:
 *         description: Forbidden - Only pastors/creators can invite
 */
export const wallInviteEndpoint = (service: IPrayerWallService) =>
  async (req: EndpointRequest, res: Response) => {
    const { wallId } = req.params;
    const { userId: inviteeId } = InviteMemberInput.parse(req.body);

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

    const [error, membership] = await safeExecute(
      service.inviteMember(wallId, inviteeId, userId, wall.church_id)
    );

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