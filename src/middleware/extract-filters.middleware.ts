import { type Request, type Response, type NextFunction } from 'express';
import { type z } from 'zod';
import { safeExecute } from '../utils/handle-async';

interface RequestWithFilters extends Request {
	filters?: Record<string, any>;
}

type RequestKey = 'query' | 'body' | 'params' | 'headers';

/**
 * Generic middleware to extract and parse request data as filters
 * for use by the keyGenerator middleware
 *
 * @param schema - Zod schema to validate and parse the request data
 * @param requestKey - Part of the request object to parse (default: 'query')
 * @returns Express middleware function
 */
export const extractFiltersMiddleware = <T extends z.ZodTypeAny>(
	schema: T,
	requestKey: RequestKey = 'query'
) => async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const request = req as RequestWithFilters;

	// Parse the specified part of the request using the provided schema
	const [error, parsedData] = await safeExecute(() => schema.parse(req[requestKey]));

	if (error) {
		// Log the error and continue without filters (validation middleware will catch this)
		(req as any).log?.error({ error, requestKey }, 'Failed to parse request filters');
	}

	// Convert parsed data to filters, excluding null/undefined/empty values
	const filters: Record<string, any> = {};

	if (parsedData) {
		Object.keys(parsedData).forEach(key => {
			const value = parsedData[key];
			// Exclude undefined, null, empty strings, and 0 from null coercion
			if (value !== undefined && value !== null && value !== '' &&
				!(value === 0 && req[requestKey][key] === null)) {
				filters[key] = value;
			}
		});

		// Only set filters if there are valid values
		if (Object.keys(filters).length > 0) {
			request.filters = filters;
		}
	}

	next();
};
