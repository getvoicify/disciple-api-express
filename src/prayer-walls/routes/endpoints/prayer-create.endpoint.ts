import type { Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerRequestService } from '../../services/prayer-request.service';
import { CreatePrayerInput } from '../../schemas/prayer.schemas';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';
import { broadcastPrayerCreated } from '../../../websocket/handlers/prayer.handler';

/**
 * @openapi
 * /prayer-walls/{wallId}/prayers:
 *   post:
 *     summary: Submit a prayer request
 *     description: Submit a new prayer request to a prayer wall. User must be a member of the wall. Thread depth validation enforced (max 3 levels).
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
 *                 description: Prayer request content
 *               anonymity_level:
 *                 type: string
 *                 enum: [identified, anonymous_to_members, fully_anonymous]
 *                 default: identified
 *                 description: Anonymity level for this prayer
 *               parent_id:
 *                 type: string
 *                 format: uuid
 *                 description: Parent prayer ID if this is a response
 *               category_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Category IDs to assign to prayer
 *               has_attachment:
 *                 type: boolean
 *                 default: false
 *                 description: Whether prayer has file attachments
 *           examples:
 *             basic:
 *               summary: Basic prayer request
 *               value:
 *                 content: "Please pray for my family during this difficult time."
 *             anonymous:
 *               summary: Anonymous prayer request
 *               value:
 *                 content: "Please pray for healing from my illness."
 *                 anonymity_level: "anonymous_to_members"
 *             categorized:
 *               summary: Prayer with categories
 *               value:
 *                 content: "Praying for guidance in my career decision."
 *                 category_ids: ["category-uuid-1", "category-uuid-2"]
 *     responses:
 *       201:
 *         description: Prayer request created successfully
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
 *         description: Invalid request (thread depth exceeded, invalid content)
 *       401:
 *         description: User authentication required
 *       403:
 *         description: User must be a member of the wall
 */
export const prayerCreateEndpoint = (service: IPrayerRequestService, io?: SocketServer) =>
  async (req: EndpointRequest, res: Response) => {
    // Parse and validate request body (middleware already validates, but we parse for type safety)
    const parseResult = CreatePrayerInput.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
        success: false,
      });
      return;
    }
    const prayerData = parseResult.data;
    const wallId = req.params.wallId;

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
      service.createPrayer(wallId, prayerData, userId)
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

    // Broadcast prayer:created event via WebSocket
    if (io) {
      broadcastPrayerCreated(io, prayer, 'John Doe'); // TODO: Get actual author name
    }
  };
