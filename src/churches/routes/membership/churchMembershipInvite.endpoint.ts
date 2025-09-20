import {ChurchMembershipService} from "../../membership-service";
import {ChurchIdInput, InvitationInput} from "../../schemas";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {handleAsync} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

/**
 * @openapi
 * /churches/{churchId}/invite:
 *   post:
 *     summary: Invite a user to join the church
 *     description: Send an invitation to a user to join the church with a specified role
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InvitationInput'
 *           examples:
 *             memberInvite:
 *               summary: Invite as member
 *               value:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 role: "Member"
 *             managerInvite:
 *               summary: Invite as manager
 *               value:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 role: "Manager"
 *     responses:
 *       200:
 *         description: Invitation sent successfully
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
 *         description: Invalid input data or business rule violation
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
 *         description: Church not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const churchMembershipInviteEndpoint = (service: ChurchMembershipService): EndpointHandler => async (req , res) => {
	const { churchId } = ChurchIdInput.parse(req.params);
	const invitationInput = InvitationInput.parse(req.body);
	const inviterId = req.user?.[0]?.sub;

	const [err, membership] = await handleAsync(service.inviteUser(churchId, invitationInput, inviterId));

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
}
