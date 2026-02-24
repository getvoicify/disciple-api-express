import {type ChurchMembershipService} from "../../membership-service";
import {type EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchIdInput} from "../../schemas";
import {safeExecute} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

export const churchMembershipLeaveEndpoint = (
	service: ChurchMembershipService,
): EndpointHandler => async (req, res) => {
	const user = req.user?.[1]?.payload;
	const userId = user?.sub;
	const {churchId} = ChurchIdInput.parse(req.params);

	const [err] = await safeExecute(service.leaveChurch(churchId, userId));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
		return;
	}

	res.status(204).send();
};
