import type {ChurchApprovalService} from "../../approval-service";
import type {EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchIdInput, RejectionInput} from "../../schemas";
import {User} from "../../../utils/validate-token.middleware";
import {safeExecute} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

/**
 * @openapi
 * /churches/{churchId}/reject:
 *   post:
 *     summary: Reject a church
 *     description: Reject a pending church with a reason. Only administrators can reject churches.
 *     tags: [Churches Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: churchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the church to reject
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RejectionInput'
 *           examples:
 *             incompleteInfo:
 *               summary: Incomplete information
 *               value:
 *                 reason: "Missing required documentation and contact information"
 *             invalidLocation:
 *               summary: Invalid location
 *               value:
 *                 reason: "Address could not be verified"
 *             inappropriateContent:
 *               summary: Inappropriate content
 *               value:
 *                 reason: "Content violates community guidelines"
 *     responses:
 *       200:
 *         description: Church rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     church:
 *                       $ref: '#/components/schemas/Church'
 *       400:
 *         description: Bad request - Church is not in pending status or invalid input
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
 *       404:
 *         description: Church not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflict - Church is already approved or rejected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const churchRejectEndpoint = (service: ChurchApprovalService): EndpointHandler => async (req, res) => {
	const { churchId } = ChurchIdInput.parse(req.params);
	const rejectionInput = RejectionInput.parse(req.body);
	const user = req['user']?.[1].payload as any;
	const rejectorId = user?.sub;

	const [err, church] = await safeExecute(service.rejectChurch(churchId, rejectionInput, rejectorId));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.json({
			success: true,
			church,
		})
	}
};
