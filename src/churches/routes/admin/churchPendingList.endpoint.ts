import {ChurchApprovalService} from "../../approval-service";
import {EndpointHandler} from "../../../types/endpoint-handler";
import {ChurchFilters, PendingChurchListQueryInput} from "../../schemas";
import {handleAsync} from "../../../utils/handle-async";
import errorCodeFactory from "../../../utils/error-code.factory";

export const churchPendingListEndpoint = (service: ChurchApprovalService): EndpointHandler => async (req, res) => {
	const query = PendingChurchListQueryInput.parse(req.query);

	const filters: Partial<ChurchFilters> = {
		approvalStatus: 'Pending',
	};

	if (query.name) {
		filters.name = query.name;
	}

	if (query.page) {
		filters.page = query.page;
	}

	if (query.pageSize) {
		filters.pageSize = query.pageSize;
	}

	const [err, result] = await handleAsync(service.getPendingChurches(filters));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.json({
			success: true,
			churches: result.churches,
			total: result.total,
		});
	}
};
