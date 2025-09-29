import { Request } from 'express';
import { Middleware } from "../utils/middleware";
import { keyEnvPrefixer } from '../utils/key-env-prefixer.util';

interface UserPayload {
	sub?: string;
}

interface AuthenticatedRequest extends Request {
	user?: [unknown, { payload?: UserPayload }];
	ids?: string[];
	filters?: Record<string, any>;
	key?: string;
}

const SEPARATOR = ':';

const extractUserId = (req: AuthenticatedRequest): string | undefined =>
	req.user?.[1]?.payload?.sub;

const formatIds = (ids: string[] | undefined): string =>
	(ids ?? []).join('-');

const formatFilters = (filters: Record<string, any> | undefined): string => {
	if (!filters || Object.keys(filters).length === 0) {
		return '';
	}

	return Object.keys(filters)
		.sort()
		.filter(key => filters[key] !== undefined && filters[key] !== null)
		.map(key => {
			const value = filters[key];
			const formattedValue = Array.isArray(value) ? value.join(',') : value;
			return `${key}=${formattedValue}`;
		})
		.join(SEPARATOR);
};

const buildListKey = (resource: string, userId: string | undefined, ids: string, filters: string): string => {
	const baseKey = `${resource}list`;
	const parts = [baseKey];

	if (userId) {
		parts.push(userId);
		parts.push(ids); // Always include ids position when user exists
	} else if (ids) {
		parts.push(ids);
	}

	if (filters) {
		parts.push(filters);
	}

	return parts.join(SEPARATOR);
};

const buildSingleKey = (resource: string, userId: string | undefined, id: string | undefined, filters: string): string => {
	const parts = [resource];

	if (userId) {
		parts.push('');
		parts.push(userId);
		parts.push(id || '');
	} else {
		parts[0] = `${resource}${id}`;
	}

	if (filters) {
		if (parts.length === 1) {
			// No user, so we need to add filters after resource+id
			parts.push(filters);
		} else {
			// User exists, add filters at the end
			parts.push(filters);
		}
	}

	return parts.filter(p => p !== '').join(SEPARATOR);
};

export const keyGenerator = (
	resource: string,
	isList = true,
	resourceParamsId?: string
): Middleware => (req, _, next) => {
	const request = req as AuthenticatedRequest;
	const userId = extractUserId(request);
	const formattedFilters = formatFilters(request.filters);

	const key = isList
		? buildListKey(resource, userId, formatIds(request.ids), formattedFilters)
		: buildSingleKey(resource, userId, request.params[resourceParamsId], formattedFilters);

	request.key = keyEnvPrefixer(key);

	next();
}
