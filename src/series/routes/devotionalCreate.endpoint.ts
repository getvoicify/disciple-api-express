import type { SeriesService } from "../service";
import type express from "express";
import { CreateSeriesInput } from "../schemas";
import { safeExecute } from "../../utils/handle-async";

/**
 * @openapi
 * /devotional:
 *   post:
 *     summary: Create a new devotional series
 *     description: Create a new devotional series with title, description, and church association. The series will be created in draft status by default. Only church Owners and Managers can create devotionals.
 *     tags: [Devotionals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSeriesInput'
 *           examples:
 *             basic:
 *               summary: Basic devotional series
 *               value:
 *                 title: "Morning Devotionals"
 *                 description: "Daily morning reflections and prayers"
 *                 churchId: "550e8400-e29b-41d4-a716-446655440001"
 *             withImage:
 *               summary: Devotional series with image
 *               value:
 *                 title: "Evening Prayers"
 *                 description: "Reflections for peaceful evenings"
 *                 churchId: "550e8400-e29b-41d4-a716-446655440001"
 *                 image: "https://example.com/devotional-cover.jpg"
 *     responses:
 *       201:
 *         description: Devotional series created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     series:
 *                       $ref: '#/components/schemas/Series'
 *       400:
 *         description: Invalid input data or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - user must be church Owner or Manager
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const devotionalCreateEndpoint = (service: SeriesService) =>
    async (req: express.Request, res: express.Response) => {
        // Extract owner ID from the authenticated user's token (validation already done by middleware)
        const ownerId = req['user']?.[1].payload?.sub || '';
        if (!ownerId) {
            res.status(401).json({
                error: 'User authentication required',
                success: false,
            });
            return;
        }

        // Body validation is handled by validate middleware, so we can safely parse
        const seriesToCreate = CreateSeriesInput.parse(req.body);
        const [err, series] = await safeExecute(service.createSeries(seriesToCreate, ownerId));

        if (err) {
            res.status(400).json({
                error: err.message,
                success: false,
            });
        } else {
            res.status(201).json({
                series,
                success: true,
            })
        }
    }