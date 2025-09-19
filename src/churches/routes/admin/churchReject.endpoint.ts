import type {ChurchApprovalService} from "../../approval-service";
import type {EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchIdInput, RejectionInput} from "../../schemas";
import {User} from "../../../utils/validate-token.middleware";
import {handleAsync} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

export const churchRejectEndpoint = (service: ChurchApprovalService): EndpointHandler => async (req, res) => {
	const { churchId } = ChurchIdInput.parse(req.params);
	const rejectionInput = RejectionInput.parse(req.body);
	const user = req['user']?.[0] as unknown as User;
	const rejectorId = user?.sub;

	const [err, church] = await handleAsync(service.rejectChurch(churchId, rejectionInput, rejectorId));

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
};
