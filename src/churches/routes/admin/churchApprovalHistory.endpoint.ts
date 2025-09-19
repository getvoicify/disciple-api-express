import {ChurchApprovalService} from "../../approval-service";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchIdInput} from "../../schemas";
import {handleAsync} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

export const churchApprovalHistoryEndpoint = (service: ChurchApprovalService): EndpointHandler => async (req, res) => {
	const {churchId} = ChurchIdInput.parse(req.params);

	const [err, history] = await handleAsync(service.getApprovalHistory(churchId));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.json({
			success: true,
			history,
		});
	}
};
