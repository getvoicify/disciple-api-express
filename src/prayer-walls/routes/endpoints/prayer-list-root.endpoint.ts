import type { Response } from 'express';
import type { EndpointRequest } from '../../../types/endpoint-handler';
import type { IPrayerRequestService } from '../../services/prayer-request.service';
import { CursorPaginationQuery } from '../../schemas/prayer.schemas';
import { safeExecute } from '../../../utils/handle-async';
import errorCodeFactory from '../../../utils/error-code.factory';

/**
 * @openapi
 * /prayer-walls/{wallId}/prayers/root:
 *   get:
 *     summary: List only root prayers on a prayer wall
 *     description: |
 *       Retrieve a paginated list of root prayer requests (parent_id IS NULL) on a wall.
 *       Excludes threaded responses for optimized loading of top-level prayers only.
 *       User must be a member of the wall. Uses cursor-based pagination.
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of root prayers to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Cursor for pagination (last seen prayer ID)
 *     responses:
 *       200:
 *         description: List of root prayers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 prayers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PrayerRequest'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     nextCursor:
 *                       type: string
 *                       nullable: true
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: integer
 *       401:
 *         description: User authentication required
 *       403:
 *         description: User must be a member of the wall
 */
export const prayerListRootEndpoint = (service: IPrayerRequestService) =>
  async (req: EndpointRequest, res: Response) => {
    const wallId = req.params.wallId;
    const pagination = CursorPaginationQuery.parse(req.query);

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

    const [error, prayers] = await safeExecute(
      service.listRootPrayers(wallId, userId, pagination)
    );

    if (error) {
      const statusCode = errorCodeFactory(error);
      res.status(statusCode).json({
        error: error.message,
        success: false,
      });
      return;
    }

    // Include pagination metadata for client navigation
    const nextCursor = prayers && prayers.length > 0 ? prayers[prayers.length - 1].id : null;
    const hasMore = prayers && prayers.length === pagination.limit;

    res.status(200).json({
      prayers,
      pagination: {
        nextCursor,
        hasMore,
        limit: pagination.limit,
      },
      success: true,
    });
  };
