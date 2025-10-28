import type { Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerRequestService } from '../../services/prayer-request.service';
import { PrayerResponseInput } from '../../schemas/prayer.schemas';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';
import { broadcastPrayerResponse } from '../../../websocket/handlers/prayer.handler';

/**
 * @openapi
 * /prayer-walls/{wallId}/prayers/{prayerId}/responses:
 *   post:
 *     summary: Add a response to a prayer request
 *     description: Create a threaded response to a prayer request. Maximum thread depth of 3 levels is enforced. User must be a member of the wall.
 *     tags: [Prayer Requests]
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
 *         name: prayerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The parent prayer request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *                 description: Response content
 *               anonymity_level:
 *                 type: string
 *                 enum: [identified, anonymous_to_members, fully_anonymous]
 *                 default: identified
 *                 description: Anonymity level for this response
 *           examples:
 *             response:
 *               summary: Prayer response
 *               value:
 *                 content: "Praying for your family during this difficult time!"
 *             anonymousResponse:
 *               summary: Anonymous response
 *               value:
 *                 content: "I'm praying for you. God is with you."
 *                 anonymity_level: "anonymous_to_members"
 *     responses:
 *       201:
 *         description: Response created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 prayer:
 *                   $ref: '#/components/schemas/PrayerRequest'
 *       400:
 *         description: Thread depth exceeded or invalid content
 *       401:
 *         description: User authentication required
 *       403:
 *         description: User must be a member of the wall
 *       404:
 *         description: Parent prayer request not found
 */
export const prayerAddResponseEndpoint = (service: IPrayerRequestService, io?: SocketServer) =>
  async (req: EndpointRequest, res: Response) => {
    const parentId = req.params.prayerId;

    // Parse and validate request body
    const parseResult = PrayerResponseInput.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
        success: false,
      });
      return;
    }
    const responseData = parseResult.data;

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

    const [error, prayer] = await safeExecute(
      service.addResponse(
        parentId,
        responseData.content,
        userId,
        responseData.anonymity_level
      )
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
      prayer,
      success: true,
    });

    // Broadcast prayer:response event via WebSocket
    if (io) {
      broadcastPrayerResponse(io, prayer, 'John Doe'); // TODO: Get actual author name
    }
  };
