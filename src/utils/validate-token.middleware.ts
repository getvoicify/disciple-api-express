import {extractToken, validateTokenService, type Verifier} from "./token.service";
import {type Middleware} from "./middleware";
import {safeExecute} from "./handle-async";
import * as jose from "jose";

/**
 * User type representing the JWT verification result tuple.
 *
 * Structure: [undefined, JWTVerifyResult]
 * - user[0]: Always undefined (from safeExecute tuple pattern)
 * - user[1]: JWTVerifyResult containing:
 *   - payload: JWTPayload with claims (including 'sub' for user ID)
 *   - protectedHeader: JWSHeaderParameters
 *
 * @example
 * // Access user ID:
 * const userId = req.user?.[1]?.payload?.sub;
 *
 * // Or with destructuring:
 * const user = req.user?.[1]?.payload;
 * const userId = user?.sub;
 */
export type User = [undefined, jose.JWTVerifyResult];

const tokenValidateMiddleware = (
	verifier: Verifier,
	endpoint: string,
	realm: string,
	enforce = true
): Middleware => async (req, res, next) => {
	const query: Record<string, string | undefined> = req.query as any;
	const token = extractToken(req.headers.authorization, query);

	if (!token) {
		if (enforce) {
			res.status(401).json({
				error: 'Unauthorized',
				success: false,
			});
		} else {
			next();
		}
		return;
	}

	const [error, payload] = await safeExecute(validateTokenService(
		token,
		endpoint,
		realm,
		verifier,
	));

	if (error) {
		if (
			error instanceof jose.errors.JWTExpired
		) {
			res.status(401).json({
				error: 'Token expired',
				success: false,
			});
			return;
		}
		if (
			error instanceof jose.errors.JWTInvalid
		) {
			res.status(401).json({
				error: 'Invalid token',
				success: false,
			});
			return;
		}
		if (
			error.message === 'Failed to get public keys' ||
			error.message === 'No public keys found' ||
			error.message === 'Failed to import public key'
		) {
			res.status(500).json({
				error: 'Internal Server Error',
				success: false,
			});
			return;
		}

		res.status(401).json({
			error: 'Unauthorized',
			success: false,
		});
		return;
	}

	if (!payload) {
		res.status(401).json({
			error: 'Unauthorized',
			success: false,
		});
		return;
	}

	req['user'] = payload;
	next();
}

export const validateToken = (
    verifier: Verifier,
    endpoint: string,
    realm: string,
): (enforce?: boolean) => Middleware => (enforce = true) => tokenValidateMiddleware(verifier, endpoint, realm, enforce);
