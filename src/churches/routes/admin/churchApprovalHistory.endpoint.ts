import {ChurchApprovalService} from "../../approval-service";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchIdInput} from "../../schemas";
import {safeExecute} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

/**
 * @openapi
 * /churches/{churchId}/approval-history:
 *   get:
 *     summary: Get church approval history
 *     description: Retrieve the approval history and current status of a church. Only administrators can view approval history.
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
 *         description: The unique identifier of the church
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Approval history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     history:
 *                       type: object
 *                       properties:
 *                         churchId:
 *                           type: string
 *                           format: uuid
 *                           description: The church's unique identifier
 *                         currentStatus:
 *                           type: string
 *                           enum: [Pending, Approved, Rejected]
 *                           description: Current approval status
 *                         approvedBy:
 *                           type: string
 *                           format: uuid
 *                           nullable: true
 *                           description: ID of the user who approved the church
 *                         approvedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                           description: Timestamp when the church was approved
 *                         rejectedBy:
 *                           type: string
 *                           format: uuid
 *                           nullable: true
 *                           description: ID of the user who rejected the church
 *                         rejectedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                           description: Timestamp when the church was rejected
 *                         rejectionReason:
 *                           type: string
 *                           nullable: true
 *                           description: Reason for rejection
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                           description: When the church was created
 *                         lastUpdated:
 *                           type: string
 *                           format: date-time
 *                           description: Last update timestamp
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
 */
export const churchApprovalHistoryEndpoint = (service: ChurchApprovalService): EndpointHandler => async (req, res) => {
	const {churchId} = ChurchIdInput.parse(req.params);

	const [err, history] = await safeExecute(service.getApprovalHistory(churchId));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.json({
			success: true,
			history,
		});
	}
};
