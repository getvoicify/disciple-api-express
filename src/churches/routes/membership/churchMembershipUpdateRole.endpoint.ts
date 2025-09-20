import {ChurchMembershipService} from "../../membership-service";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchIdInput, UserIdInput, UpdateRoleInput} from "../../schemas";
import {handleAsync} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

/**
 * @openapi
 * /churches/{churchId}/members/{userId}/role:
 *   put:
 *     summary: Update a member's role in the church
 *     description: Update a member's role in the church (requires Owner role)
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
 *         description: User ID of the member whose role to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRoleInput'
 *           examples:
 *             promoteToManager:
 *               summary: Promote to manager
 *               value:
 *                 role: "Manager"
 *             demoteToMember:
 *               summary: Demote to member
 *               value:
 *                 role: "Member"
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     membership:
 *                       $ref: '#/components/schemas/ChurchMember'
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
 *         description: Forbidden - only church owners can update roles
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
export const churchMembershipUpdateRoleEndpoint = (service: ChurchMembershipService): EndpointHandler => async (req, res) => {
	const actor = req.user?.[0];
	const actorId = actor?.sub;
	const { churchId } = ChurchIdInput.parse(req.params);
	const { userId: targetUserId } = UserIdInput.parse(req.params);
	const { role: newRole } = UpdateRoleInput.parse(req.body);

	const [err, membership] = await handleAsync(service.updateMemberRole(churchId, targetUserId, newRole, actorId));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.json({
			success: true,
			membership,
		});
	}
};