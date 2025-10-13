import {type EndpointRequest} from "../../types/endpoint-handler";

import {KeycloakAuthError} from "../../utils/errors";
import {type Middleware} from "../../utils/middleware";
import {safeExecute} from "../../utils/handle-async";
import errorCodeFactory from "../../utils/error-code.factory";

export interface KeycloakPermission {
	scopes: string[];
	rsid: string;
	rsname: string;
}

export interface KeycloakAuthOptions {
	keycloakUrl?: string;
	realm?: string;
	clientId?: string;
	resource?: string;
	scope: string;
	queryUri?: string;
	responseMode?: 'decision' | 'permissions';
}

function extractAccessToken(authHeader?: string): string {
	if (!authHeader) {
		throw new KeycloakAuthError('Unauthorized: Missing or invalid token', 401);
	}

	const parts = authHeader.split(' ');
	if (parts.length !== 2 || parts[0] !== 'Bearer') {
		throw new KeycloakAuthError('Unauthorized: Missing or invalid token', 401);
	}

	return parts[1];
}

export const canAccessMiddleware = (options: KeycloakAuthOptions): Middleware => async (req: EndpointRequest, res: any, next: any) => {
	const {
		keycloakUrl = process.env.IAM_ENDPOINT,
		realm = process.env.IAM_REALM,
		clientId = process.env.KEYCLOAK_CLIENT_ID,
		resource,
		scope,
		queryUri,
		responseMode = 'permissions',
	} = options;

	const tokenEndpoint = `${keycloakUrl}/${realm}/protocol/openid-connect/token`;

	const params = new URLSearchParams({
		grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
		audience: clientId,
		response_mode: responseMode,
	});

	if (queryUri) {
		params.append('permission', `${queryUri}#${scope}`);
		params.append('permission_resource_format', 'uri');
	} else {
		params.append('permission', `${resource}#${scope}`);
	}

	const [tokenError, token] = await safeExecute(() => extractAccessToken(req.headers.authorization));

	if (tokenError) {
		const code = errorCodeFactory(tokenError);
		res.status(code).json({
			error: tokenError.message,
			success: false,
		});
		return;
	}

	const [authError, authResponse] = await safeExecute(fetch(tokenEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Authorization': `Bearer ${token}`,
		},
		body: params,
	}));

	if (authError) {
		const code = errorCodeFactory(authError);
		res.status(code).json({
			error: authError.message,
			success: false,
		});
		return;
	}

	if (!authResponse.ok) {
		res.status(authResponse.status).json({
			error: `Failed to obtain resource: ${authResponse.statusText}`,
			success: false,
		});
		return;
	}

	const [, authData] = await safeExecute(authResponse.json() as Promise<KeycloakPermission[]>);

	if (responseMode === 'permissions') {
		req['ids'] = authData.map(d => d.rsname.replaceAll('_', '-'));
	}
	next();
}
