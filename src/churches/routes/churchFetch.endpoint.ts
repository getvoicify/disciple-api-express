import type {ChurchService} from "../service";
import type {EndpointHandler} from "../../types/endpoint-handler";
import {handleAsync} from "../../utils/handle-async";
import {ChurchFetchInput} from "../schemas";



export const churchFetchEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const {churchId} = ChurchFetchInput.parse(req.params);
	const [err, church] = await handleAsync(service.getChurchById(churchId));
	const errCodeFn = (err: Error) => {
		if (err.message.includes('not found')) {
			return 404;
		}
		return 400;
	}

	if (err) {
		const code = errCodeFn(err);
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
