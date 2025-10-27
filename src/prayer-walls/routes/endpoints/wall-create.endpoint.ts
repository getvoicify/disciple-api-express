import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerWallService } from "../../services/prayer-wall.service";
import { CreateWallInput } from '../../schemas/wall.schemas';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /churches/{churchId}/prayer-walls:
 *   post:
 *     summary: Create a new prayer wall
 *     description: Create a new prayer wall for a church. Only pastors and admins can create walls. Only pastors can create private walls.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Name of the prayer wall
 *               description:
 *                 type: string
 *                 description: Description of the prayer wall
 *               is_private:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the wall is private (pastor-only creation)
 *               has_restricted_access:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the wall requires invitation to join
 *               schedule:
 *                 type: object
 *                 description: Recurring meeting schedule
 *               video_call_link:
 *                 type: string
 *                 format: uri
 *                 maxLength: 500
 *                 description: Video call link for prayer meetings
 *           examples:
 *             basic:
 *               summary: Basic prayer wall
 *               value:
 *                 name: "Youth Prayer Circle"
 *                 description: "Weekly prayer gathering for youth"
 *             withSchedule:
 *               summary: Scheduled prayer wall
 *               value:
 *                 name: "Morning Prayer"
 *                 description: "Daily morning prayer"
 *                 schedule:
 *                   frequency: "daily"
 *                   time: "06:00"
 *                   timezone: "Africa/Lagos"
 *                 video_call_link: "https://zoom.us/j/123456789"
 *     responses:
 *       201:
 *         description: Prayer wall created successfully
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
 *                   example: User authentication required
 *       403:
 *         description: Forbidden - Only pastors/admins can create walls
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
 *                   example: Only pastors and administrators can create prayer walls
 */
export const wallCreateEndpoint = (service: IPrayerWallService) =>
  async (req: EndpointRequest, res: Response) => {
    const wallData = CreateWallInput.parse(req.body);
    const churchId = req.params.churchId;

    // Extract user ID from authenticated token
    const user = req.user?.[1]?.payload;
    const userId = user?.sub as string;

    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    const [error, wall] = await safeExecute(
      service.createWall({ ...wallData, church_id: churchId, created_by: userId }, userId, churchId)
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
      wall,
      success: true,
    });
  };
