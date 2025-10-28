import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerRequestService } from '../../services/prayer-request.service';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /prayer-walls/{wallId}/prayers/{prayerId}/thread:
 *   get:
 *     summary: Get complete thread tree for a prayer
 *     description: |
 *       Retrieve the complete thread tree starting from a root prayer.
 *       Includes the root prayer plus all nested descendants using a recursive query.
 *       Optimized for displaying the full conversation thread.
 *       User must be a member of the wall.
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
 *         description: The root prayer ID
 *     responses:
 *       200:
 *         description: Full thread tree retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 thread:
 *                   type: array
 *                   description: Array containing root prayer and all descendants ordered chronologically
 *                   items:
 *                     $ref: '#/components/schemas/PrayerRequest'
 *                 count:
 *                   type: integer
 *                   description: Total number of prayers in the thread (including root)
 *       401:
 *         description: User authentication required
 *       403:
 *         description: User must be a member of the wall
 *       404:
 *         description: Root prayer not found
 */
export const prayerGetThreadEndpoint = (service: IPrayerRequestService) =>
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

    const [error, thread] = await safeExecute(service.getFullThread(prayerId, userId));

    if (error) {
      const statusCode = errorCodeFactory(error);
      res.status(statusCode).json({
        error: error.message,
        success: false,
      });
      return;
    }

    res.status(200).json({
      thread,
      count: thread?.length || 0,
      success: true,
    });
  };
