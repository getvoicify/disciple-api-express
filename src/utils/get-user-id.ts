import type { EndpointRequest } from '../types/endpoint-handler';

/**
 * Safely extracts the user ID from an EndpointRequest object
 *
 * The user object structure is: req.user[1].payload.sub
 *
 * @param req - The Express request object with user authentication data
 * @returns The user ID (sub) as a string, or undefined if not found or invalid
 */
export function getUserIdFromRequest(req: EndpointRequest): string | undefined {
  // Check if user exists and is an array with at least 2 elements
  if (!req.user || !Array.isArray(req.user) || req.user.length < 2) {
    return undefined;
  }

  // Access user[1].payload
  const userPayload = req.user[1];
  if (!userPayload || typeof userPayload !== 'object' || !('payload' in userPayload)) {
    return undefined;
  }

  // Access payload.sub
  const payload = userPayload.payload;
  if (!payload || typeof payload !== 'object' || !('sub' in payload)) {
    return undefined;
  }

  const sub = payload.sub;

  // Validate sub is a non-empty string
  if (typeof sub !== 'string' || sub.trim() === '') {
    return undefined;
  }

  return sub;
}
