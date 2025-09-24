import {ChurchMembershipService} from "../../membership-service";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchIdInput} from "../../schemas";
import {safeExecute} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

export const churchMembershipJoinEndpoint = (service: ChurchMembershipService): EndpointHandler => async (req, res) => {
	const user = req.user?.[0];
	const userId = user?.sub;
	const { churchId } = ChurchIdInput.parse(req.params);

	const [err, membership] = await safeExecute(service.joinChurch(churchId, userId));

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
