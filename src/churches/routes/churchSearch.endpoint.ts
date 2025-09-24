import {z} from "zod";
import type {ChurchService} from "../service";
import {EndpointHandler} from "../../types/endpoint-handler";
import {safeExecute} from "../../utils/handle-async";

export const ChurchSearchInput = z.object({
	q: z.string(),
	latitude: z.number().nullable(),
	longitude: z.number().nullable(),
});

/**
 * @openapi
 * /churches/search:
 *   get:
 *     summary: Search churches
 *     description: Search for churches by query string with optional location-based filtering
 *     tags: [Churches]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query string
 *         example: "Baptist Church"
 *       - in: query
 *         name: latitude
 *         schema:
 *           type: number
 *           format: float
 *         description: Latitude for location-based search
 *         example: 40.7128
 *       - in: query
 *         name: longitude
 *         schema:
 *           type: number
 *           format: float
 *         description: Longitude for location-based search
 *         example: -74.0060
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     churches:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Church'
 *                     total:
 *                       type: integer
 *                       description: Total number of churches matching the search
 *                       example: 15
 *       400:
 *         description: Invalid search parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const churchSearchEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const { q } = ChurchSearchInput.parse(req.query);
	const [ err, result ] = await safeExecute(service.searchChurches(q));

	if (err) {
		res.status(400).json({
			success: false,
			error: err instanceof Error ? err.message : 'An error occurred'
		});
	} else {
		res.json({
			success: true,
			churches: result.churches,
			total: result.total,
		})
	}
}
