import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerRequestService } from '../../services/prayer-request.service';
import { UpdatePrayerInput } from '../../schemas/prayer.schemas';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /prayer-walls/{wallId}/prayers/{prayerId}:
 *   patch:
 *     summary: Update a prayer request
 *     description: Update prayer content within 5-minute edit window. Only the author can edit their own prayers.
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
 *                 description: Updated prayer content
 *           examples:
 *             update:
 *               summary: Update prayer content
 *               value:
 *                 content: "Please pray for my family during this very difficult time. Update: my father is in hospital."
 *     responses:
 *       200:
 *         description: Prayer request updated successfully
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
 *         description: Edit window expired or user not authorized
 *       404:
 *         description: Prayer request not found
 */
export const prayerUpdateEndpoint = (service: IPrayerRequestService) =>
  async (req: EndpointRequest, res: Response) => {
    const prayerId = req.params.prayerId;

    // Parse and validate request body
    const parseResult = UpdatePrayerInput.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
        success: false,
      });
      return;
    }
    const updateData = parseResult.data;

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
      service.updatePrayer(prayerId, updateData.content, userId)
    );

    if (error) {
      const statusCode = errorCodeFactory(error);
      res.status(statusCode).json({
        error: error.message,
        success: false,
      });
      return;
    }

    res.status(200).json({
      prayer,
      success: true,
    });
  };
