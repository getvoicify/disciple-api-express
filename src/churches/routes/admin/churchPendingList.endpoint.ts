import {ChurchApprovalService} from "../../approval-service";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchFilters, PendingChurchListQueryInput} from "../../schemas";
import {safeExecute} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

/**
 * @openapi
 * /churches/pending:
 *   get:
 *     summary: List pending churches
 *     description: Retrieve a paginated list of churches pending approval. Only administrators can view pending churches.
 *     tags: [Churches Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by church name (partial match)
 *         example: "Grace"
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
 *         description: List of pending churches retrieved successfully
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
 *                       description: Array of churches with pending approval status
 *                     total:
 *                       type: integer
 *                       description: Total number of pending churches
 *                       example: 15
 *             examples:
 *               withResults:
 *                 summary: Response with pending churches
 *                 value:
 *                   success: true
 *                   churches:
 *                     - id: "123e4567-e89b-12d3-a456-426614174000"
 *                       name: "Grace Community Church"
 *                       approvalStatus: "Pending"
 *                       createdAt: "2024-01-15T10:30:00Z"
 *                     - id: "987e6543-e89b-12d3-a456-426614174001"
 *                       name: "Faith Assembly"
 *                       approvalStatus: "Pending"
 *                       createdAt: "2024-01-16T14:00:00Z"
 *                   total: 2
 *               noResults:
 *                 summary: No pending churches
 *                 value:
 *                   success: true
 *                   churches: []
 *                   total: 0
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - User does not have admin privileges
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const churchPendingListEndpoint = (service: ChurchApprovalService): EndpointHandler => async (req, res) => {
	const query = PendingChurchListQueryInput.parse(req.query);

	const filters: Partial<ChurchFilters> = {
		approvalStatus: 'Pending',
	};

	if (query.name) {
		filters.name = query.name;
	}

	if (query.page) {
		filters.page = query.page;
	}

	if (query.pageSize) {
		filters.pageSize = query.pageSize;
	}

	const [err, result] = await safeExecute(service.getPendingChurches(filters));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.json({
			success: true,
			churches: result.churches,
			total: result.total,
		});
	}
};
