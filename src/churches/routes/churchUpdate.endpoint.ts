import type {ChurchService} from "../service";
import type {EndpointHandler} from "../../types/endpoint-handler";
import {ChurchUpdateInput, ChurchUpdateParamsInput} from "../schemas";
import {handleAsync} from "../../utils/handle-async";
import errorCodeFactory from "../../utils/error-code.factory";

export const churchUpdateEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const {churchId} = ChurchUpdateParamsInput.parse(req.params);
	const {version, ...updateData} = ChurchUpdateInput.parse(req.body);

	const [err, church] = await handleAsync(service.updateChurch(churchId, updateData, version));

	if (err) {
		const code = errorCodeFactory(err);
		res.status(code).json({
			error: err.message,
			success: false,
		});
	} else {
		res.json({
			success: true,
			church
		})
	}
};
