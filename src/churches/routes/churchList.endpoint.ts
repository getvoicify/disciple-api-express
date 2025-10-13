import {z} from 'zod';
import type {ChurchService} from "../service";
import type {EndpointHandler} from "../../types/endpoint-handler";
import {type ChurchFilters} from "../schemas";
import {safeExecute} from "../../utils/handle-async";

export const ChurchListFilterSchema = z.object({
	search: z.string().optional().nullable(),
	approvalStatus: z.enum(['Pending', 'Approved', 'Rejected']).optional().nullable(),
	visibility: z.enum(['Public', 'Hidden']).optional().nullable(),
	page: z.coerce.number().int().positive().optional().nullable(),
	pageSize: z.coerce.number().int().positive().max(100).optional().nullable(),
});

/**
 * @openapi
 * /churches:
 *   get:
 *     summary: List all churches
 *     description: Retrieve a paginated list of churches with optional filtering. Returns public churches for unauthenticated users and all accessible churches for authenticated users.
 *     tags: [Churches]
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search churches by name (partial match)
 *         example: "Grace"
 *       - in: query
 *         name: approvalStatus
 *         schema:
 *           type: string
 *           enum: [Pending, Approved, Rejected]
 *         description: Filter by approval status
 *         example: "Approved"
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [Public, Hidden]
 *         description: Filter by visibility status
 *         example: "Public"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *         example: 20
 *     responses:
 *       200:
 *         description: List of churches retrieved successfully
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
 *                       description: Total number of churches matching the filters
 *                       example: 42
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
const publicListing: (service: ChurchService) => EndpointHandler = (service: ChurchService) => async (req, res) => {
	const publicFilters: Partial<ChurchFilters> = {};
	const query = ChurchListFilterSchema.parse(req.query);
	if (query.search) {
		publicFilters.name = query.search;
	}

	if (query.visibility) {
		publicFilters.visibility = query.visibility;
	}

	if (query.approvalStatus) {
		publicFilters.approvalStatus = query.approvalStatus;
	}

	if (query.page) {
		publicFilters.page = query.page;
	}

	if (query.pageSize) {
		publicFilters.pageSize = query.pageSize;
	}

	const [err, result] = await safeExecute(service.listChurchesPublic(publicFilters));

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
};

const privateListing: (service: ChurchService) => EndpointHandler = (service: ChurchService) => async (req, res) => {
	const filters: Partial<ChurchFilters> = {};
	const query = ChurchListFilterSchema.parse(req.query);

	if (query.search) {
		filters.name = query.search;
	}

	if (query.approvalStatus) {
		filters.approvalStatus = query.approvalStatus;
	}

	if (query.visibility) {
		filters.visibility = query.visibility;
	}

	if (query.page) {
		filters.page = query.page;
	}

	if (query.pageSize) {
		filters.pageSize = query.pageSize;
	}

	const [err, result] = await safeExecute(service.listChurches(filters));

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

export const churchListEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const user = req['user']?.[1].payload;
	if (user) {
		await privateListing(service)(req, res);
	} else {
		await publicListing(service)(req, res);
	}
};
