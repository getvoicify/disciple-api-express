import type {ChurchService} from "../service";
import type {EndpointHandler} from "../../types/endpoint-handler";
import {CreateChurchInput} from "../schemas";
import type {User} from "../../utils/validate-token.middleware";
import {handleAsync} from "../../utils/handle-async";

export const churchCreateEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const churchToCreate = CreateChurchInput.parse(req.body);
	const user = req['user']?.[0] as unknown as User;

	if (!user) {
		res.status(401).json({
			error: 'Unauthorized',
			success: false,
		});
		return;
	}
	const ownerId = user.sub;

	const [err, createdChurch] = await handleAsync(service.createChurch(churchToCreate, ownerId));

	if (err) {
		res.status(400).json({
			error: err.message,
			success: false,
		});
	} else {
		res.status(201).json({
			success: true,
			church: createdChurch
		})
	}
};
