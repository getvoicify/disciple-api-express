import {z} from 'zod';
import type {ChurchService} from "../service";
import type {EndpointHandler} from "../../types/endpoint-handler";
import {ChurchFilters} from "../schemas";
import {handleAsync} from "../../utils/handle-async";

export const ChurchListFilterSchema = z.object({
	search: z.string().optional().nullable(),
	approvalStatus: z.enum(['Pending', 'Approved', 'Rejected']).optional().nullable(),
	visibility: z.enum(['Public', 'Hidden']).optional().nullable(),
	page: z.coerce.number().int().positive().optional().nullable(),
	pageSize: z.coerce.number().int().positive().max(100).optional().nullable(),
});


const publicListing: (service: ChurchService) => EndpointHandler = (service: ChurchService) => async (req, res) => {
	const publicFilters: Partial<ChurchFilters> = {};
	const query = ChurchListFilterSchema.parse(req.query);
	if (query.search) {
		publicFilters.name = query.search;
	}

	if (query.visibility) {
		publicFilters.visibility = query.visibility;
	}

	if (query.approvalStatus) {
		publicFilters.approvalStatus = query.approvalStatus;
	}

	if (query.page) {
		publicFilters.page = query.page;
	}

	if (query.pageSize) {
		publicFilters.pageSize = query.pageSize;
	}

	const [err, result] = await handleAsync(service.listChurchesPublic(publicFilters));

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
};

const privateListing: (service: ChurchService) => EndpointHandler = (service: ChurchService) => async (req, res) => {
	const filters: Partial<ChurchFilters> = {};
	const query = ChurchListFilterSchema.parse(req.query);

	if (query.search) {
		filters.name = query.search;
	}

	if (query.approvalStatus) {
		filters.approvalStatus = query.approvalStatus;
	}

	if (query.visibility) {
		filters.visibility = query.visibility;
	}

	if (query.page) {
		filters.page = query.page;
	}

	if (query.pageSize) {
		filters.pageSize = query.pageSize;
	}

	const [err, result] = await handleAsync(service.listChurches(filters));

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

export const churchListEndpoint = (service: ChurchService): EndpointHandler => async (req, res) => {
	const user = req['user']?.[0];
	if (user) {
		await privateListing(service)(req, res);
	} else {
		await publicListing(service)(req, res);
	}
};
