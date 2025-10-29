import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerRequestService } from '../../services/prayer-request.service';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /prayer-walls/{wallId}/prayers/{prayerId}:
 *   get:
 *     summary: Get a single prayer request
 *     description: Retrieve a single prayer request by ID with its thread. User must be a member of the wall.
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
 *         description: The prayer request ID
 *     responses:
 *       200:
 *         description: Prayer request retrieved successfully
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
 *       401:
 *         description: User authentication required
 *       403:
 *         description: User must be a member of the wall
 *       404:
 *         description: Prayer request not found
 */
export const prayerGetEndpoint = (service: IPrayerRequestService) =>
  async (req: EndpointRequest, res: Response) => {
    const prayerId = req.params.prayerId;

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

    const [error, prayer] = await safeExecute(service.getPrayer(prayerId, userId));

    if (error) {
      const statusCode = errorCodeFactory(error);
      res.status(statusCode).json({
        error: error.message,
        success: false,
      });
      return;
    }

    if (!prayer) {
      res.status(404).json({
        error: 'Prayer request not found',
        success: false,
      });
      return;
    }

    res.status(200).json({
      prayer,
      success: true,
    });
  };
