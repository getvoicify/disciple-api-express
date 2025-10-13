import type express from 'express';
import {type User} from "../utils/validate-token.middleware";

/**
 * Extended Express Request type with authenticated user information.
 *
 * The `user` property is added by the authentication middleware and contains
 * the JWT verification result tuple: [undefined, JWTVerifyResult]
 *
 * @example
 * // Access user payload and ID:
 * const user = req.user?.[1]?.payload;
 * const userId = user?.sub;
 *
 * // Or directly:
 * const userId = req.user?.[1]?.payload?.sub;
 */
export type EndpointRequest = express.Request & {
    user?: User;
};

/**
 * Standard endpoint handler type for async Express route handlers.
 */
export type EndpointHandler = (req: EndpointRequest, res: express.Response) => Promise<void>;
