import {ChurchMembershipService} from "../../membership-service";
import {ChurchIdInput, InvitationInput} from "../../schemas";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {handleAsync} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

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
