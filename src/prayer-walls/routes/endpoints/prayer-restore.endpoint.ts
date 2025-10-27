import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerRequestService } from '../../services/prayer-request.service';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /prayer-walls/{wallId}/prayers/{prayerId}/restore:
 *   post:
 *     summary: Restore a soft-deleted prayer request
 *     description: Restore a previously deleted prayer request. Author can restore within 24 hours, pastors within 30 days.
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
 *         description: Prayer request restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Prayer request restored successfully
 *       401:
 *         description: User authentication required
 *       403:
 *         description: User not authorized or restoration window expired
 *       404:
 *         description: Prayer request not found
 */
export const prayerRestoreEndpoint = (service: IPrayerRequestService) =>
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

    const [error] = await safeExecute(service.restore(prayerId, userId));

    if (error) {
      const statusCode = errorCodeFactory(error);
      res.status(statusCode).json({
        error: error.message,
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: 'Prayer request restored successfully',
      success: true,
    });
  };
