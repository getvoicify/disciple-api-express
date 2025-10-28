import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerRequestService } from '../../services/prayer-request.service';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /prayer-walls/{wallId}/prayers/{prayerId}/children:
 *   get:
 *     summary: Get immediate children of a prayer
 *     description: |
 *       Retrieve only the direct/immediate children (one level) of a parent prayer.
 *       Optimized for lazy-loading responses without fetching deeper nested replies.
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
 *         description: The parent prayer ID
 *     responses:
 *       200:
 *         description: Direct children retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 children:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PrayerRequest'
 *                 count:
 *                   type: integer
 *                   description: Number of direct children returned
 *       401:
 *         description: User authentication required
 *       403:
 *         description: User must be a member of the wall
 *       404:
 *         description: Parent prayer not found
 */
export const prayerGetChildrenEndpoint = (service: IPrayerRequestService) =>
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

    const [error, children] = await safeExecute(service.getDirectChildren(prayerId, userId));

    if (error) {
      const statusCode = errorCodeFactory(error);
      res.status(statusCode).json({
        error: error.message,
        success: false,
      });
      return;
    }

    res.status(200).json({
      children,
      count: children?.length || 0,
      success: true,
    });
  };
