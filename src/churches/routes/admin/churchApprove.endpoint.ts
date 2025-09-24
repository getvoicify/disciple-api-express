import {ChurchApprovalService} from "../../approval-service";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {ApprovalInput, ChurchIdInput} from "../../schemas";
import {User} from "../../../utils/validate-token.middleware";
import {safeExecute} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

/**
 * @openapi
 * /churches/{churchId}/approve:
 *   post:
 *     summary: Approve a church
 *     description: Approve a pending church for public visibility. Only administrators can approve churches.
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
 *         description: The unique identifier of the church to approve
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApprovalInput'
 *           examples:
 *             withReason:
 *               summary: Approval with reason
 *               value:
 *                 reason: "Church meets all requirements and has been verified"
 *             withoutReason:
 *               summary: Approval without reason
 *               value: {}
 *     responses:
 *       200:
 *         description: Church approved successfully
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
 *         description: Bad request - Church is not in pending status
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
export const churchApproveEndpoint = (service: ChurchApprovalService): EndpointHandler => async (req, res) => {
	const { churchId } = ChurchIdInput.parse(req.params);
	const input = ApprovalInput.optional().parse(req.body) ?? {};
	const user = req['user']?.[1].payload as any;
	const approverId = user?.sub;

	const [err, church] = await safeExecute(service.approveChurch(churchId, input, approverId));

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
}
