import type {ChurchService} from "../service";
import type {EndpointHandler} from "../../types/endpoint-handler";
import {ChurchDeleteInput} from "../schemas";
import {handleAsync} from "../../utils/handle-async";
import errorCodeFactory from "../../utils/error-code.factory";

export const churchDeleteEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const {churchId} = ChurchDeleteInput.parse(req.params);

	const [err] = await handleAsync(service.deleteChurch(churchId));

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
