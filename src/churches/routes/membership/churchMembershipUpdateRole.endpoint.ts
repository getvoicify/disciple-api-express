import {ChurchMembershipService} from "../../membership-service";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchIdInput, UserIdInput, UpdateRoleInput} from "../../schemas";
import {handleAsync} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

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