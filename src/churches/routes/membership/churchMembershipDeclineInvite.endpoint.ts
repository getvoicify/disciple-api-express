import {ChurchMembershipService} from "../../membership-service";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchIdInput} from "../../schemas";
import {handleAsync} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

/**
 * @openapi
 * /churches/{churchId}/decline-invitation:
 *   post:
 *     summary: Decline a church invitation
 *     description: Decline a pending invitation to join a church
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
 *     responses:
 *       204:
 *         description: Invitation declined successfully
 *       400:
 *         description: No pending invitation found or invalid request
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
 *       404:
 *         description: Church or invitation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const churchMembershipDeclineInviteEndpoint = (service: ChurchMembershipService): EndpointHandler => async (req, res) => {
	const user = req.user?.[0];
	const userId = user?.sub;
	const { churchId } = ChurchIdInput.parse(req.params);

	const [err] = await handleAsync(service.declineInvitation(churchId, userId));

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