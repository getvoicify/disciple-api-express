import { Request } from 'express';
import { Middleware } from "../utils/middleware";
import { keyEnvPrefixer } from '../utils/key-env-prefixer.util';

interface UserPayload {
	sub?: string;
}

interface AuthenticatedRequest extends Request {
	user?: [unknown, { payload?: UserPayload }];
	ids?: string[];
	key?: string;
}

const SEPARATOR = ':';

const extractUserId = (req: AuthenticatedRequest): string | undefined =>
	req.user?.[1]?.payload?.sub;

const formatIds = (ids: string[] | undefined): string =>
	(ids ?? []).join('-');

const buildListKey = (resource: string, userId: string | undefined, ids: string): string => {
	const baseKey = `${resource}list`;
	if (userId) {
		return `${baseKey}${SEPARATOR}${userId}${SEPARATOR}${ids}`;
	}
	return ids ? `${baseKey}${SEPARATOR}${ids}` : baseKey;
};

const buildSingleKey = (resource: string, userId: string | undefined, id: string | undefined): string => {
	return userId
		? `${resource}${SEPARATOR}${userId}${SEPARATOR}${id}`
		: `${resource}${id}`;
};

export const keyGenerator = (
	resource: string,
	isList = true,
	resourceParamsId?: string
): Middleware => (req, _, next) => {
	const request = req as AuthenticatedRequest;
	const userId = extractUserId(request);

	const key = isList
		? buildListKey(resource, userId, formatIds(request.ids))
		: buildSingleKey(resource, userId, request.params[resourceParamsId]);

	request.key = keyEnvPrefixer(key);

	next();
}
