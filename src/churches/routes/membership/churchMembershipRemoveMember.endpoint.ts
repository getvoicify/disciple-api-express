import {type ChurchMembershipService} from "../../membership-service";
import {type EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchIdInput, UserIdInput} from "../../schemas";
import {safeExecute} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

/**
 * @openapi
 * /churches/{churchId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from the church
 *     description: Remove a member from the church (requires Owner or Manager role)
 *     tags: [Churches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: churchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Church ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID of the member to remove
 *     responses:
 *       204:
 *         description: Member removed successfully
 *       400:
 *         description: Invalid request or business rule violation
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
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Church or member not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const churchMembershipRemoveMemberEndpoint = (service: ChurchMembershipService): EndpointHandler => async (req, res) => {
	const actor = req.user?.[1]?.payload;
	const actorId = actor?.sub;
	const { churchId } = ChurchIdInput.parse(req.params);
	const { userId: targetUserId } = UserIdInput.parse(req.params);

	const [err] = await safeExecute(service.removeMember(churchId, targetUserId, actorId));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.status(204).send();
	}
};