import {z} from "zod";
import type {ChurchService} from "../service";
import {EndpointHandler} from "../../types/endpoint-handler";
import {handleAsync} from "../../utils/handle-async";

export const ChurchSearchInput = z.object({
	q: z.string(),
	latitude: z.number().nullable(),
	longitude: z.number().nullable(),
});

export const churchSearchEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const { q } = ChurchSearchInput.parse(req.query);
	const [ err, result ] = await handleAsync(service.searchChurches(q));

	if (err) {
		res.status(400).json({
			success: false,
			error: err instanceof Error ? err.message : 'An error occurred'
		});
	} else {
		res.json({
			success: true,
			churches: result.churches,
			total: result.total,
		})
	}
}
