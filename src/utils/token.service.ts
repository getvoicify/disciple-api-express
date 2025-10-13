import {type JWTPayload, type jwtVerify} from "jose";
import {getPublicKeys} from "./get-public-keys.util";
import {safeExecute} from "./handle-async";

export type Verifier = typeof jwtVerify;

/**
 * Validates a JWT token using the provided verifier function
 *
 * @param token The JWT token to validate
 * @param endpoint The IAM endpoint
 * @param realm The IAM realm
 * @param verifier The verifier function to use for token validation
 * @returns A tuple containing an error (if any) and the verification result
 */
export async function validateTokenService<T = JWTPayload>(
    token: string,
    endpoint: string,
    realm: string,
    verifier: Verifier,
) {

    const [err, result] = await safeExecute(verifier(
        token,
        getPublicKeys(`${endpoint}/${realm}`)
    ));

    if (err) {
        throw err;
    }
    return [undefined, result as T];
}

/**
 * Extracts a token from the authorization header or query parameters
 *
 * @param authHeader The authorization header value
 * @param queryParams The query parameters object
 * @returns The extracted token or undefined if not found
 */
export function extractToken(
    authHeader: string | null | undefined,
    queryParams: Record<string, string | undefined>,
): string | undefined {
    let token: string | undefined;

    if (authHeader) {
        token = authHeader.split(' ')[1];
    } else {
        // Check for token in query parameters for WebSocket connections
        token = queryParams.token;
    }

    return token;
}