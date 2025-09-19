import {ChurchApprovalService} from "../../approval-service";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {ApprovalInput, ChurchIdInput} from "../../schemas";
import {User} from "../../../utils/validate-token.middleware";
import {handleAsync} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

export const churchApproveEndpoint = (service: ChurchApprovalService): EndpointHandler => async (req, res) => {
	const { churchId } = ChurchIdInput.parse(req.params);
	const input = ApprovalInput.optional().parse(req.body) ?? {};
	const user = req['user']?.[0] as unknown as User;
	const approverId = user?.sub;

	const [err, church] = await handleAsync(service.approveChurch(churchId, input, approverId));

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
}
