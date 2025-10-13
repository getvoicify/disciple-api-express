import type { Response, NextFunction } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import type { SeriesService } from '../../series/service';
import { safeExecute } from '../../utils/handle-async';

/**
 * @openapi
 * /posts/daily-devotionals:
 *   get:
 *     summary: Get daily devotionals
 *     description: Retrieve the latest published post from each series across all churches the authenticated user is a member of, grouped by publication date (YYYY-MM-DD). This provides a personalized daily devotional feed based on the user's church memberships.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daily devotionals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Post'
 *             example:
 *               "2024-01-15":
 *                 - id: "550e8400-e29b-41d4-a716-446655440001"
 *                   title: "Morning Devotional"
 *                   content: "Today's devotional content..."
 *                   authorId: "550e8400-e29b-41d4-a716-446655440002"
 *                   churchId: "550e8400-e29b-41d4-a716-446655440003"
 *                   status: "published"
 *                   publishedAt: "2024-01-15T08:00:00Z"
 *                   seriesId: "550e8400-e29b-41d4-a716-446655440004"
 *                   seriesName: "Daily Bread"
 *                   tags: ["devotional", "morning"]
 *                   categories: ["spiritual growth"]
 *                   scriptureReferences: []
 *                   image: null
 *                   createdAt: "2024-01-15T00:00:00Z"
 *                   updatedAt: "2024-01-15T00:00:00Z"
 *               "2024-01-16":
 *                 - id: "550e8400-e29b-41d4-a716-446655440005"
 *                   title: "Evening Reflection"
 *                   content: "Tonight's reflection..."
 *                   authorId: "550e8400-e29b-41d4-a716-446655440006"
 *                   churchId: "550e8400-e29b-41d4-a716-446655440007"
 *                   status: "published"
 *                   publishedAt: "2024-01-16T20:00:00Z"
 *                   seriesId: "550e8400-e29b-41d4-a716-446655440008"
 *                   seriesName: "Evening Prayer"
 *                   tags: ["devotional", "evening"]
 *                   categories: ["prayer"]
 *                   scriptureReferences: []
 *                   image: null
 *                   createdAt: "2024-01-16T00:00:00Z"
 *                   updatedAt: "2024-01-16T00:00:00Z"
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
export const dailyDevotionalsEndpoint = (
  seriesService: SeriesService
) => {
  return async (req: EndpointRequest, res: Response, next: NextFunction) => {
    const [error, result] = await safeExecute(async () => {
      // Get authenticated user
      const user = req.user?.[1]?.payload;
      const userId = user?.sub;

      if (!userId) {
        throw new Error('User context is required');
      }

      // Get daily devotionals grouped by date
      return await seriesService.getDailyDevotionals(userId);
    });

    if (error) {
      return next(error);
    }

    return res.status(200).json(result);
  };
};
