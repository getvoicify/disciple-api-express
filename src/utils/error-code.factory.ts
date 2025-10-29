import { isAppError, hasStatusCode } from './errors';

/**
 * Factory function to determine HTTP status code from an error
 * @param err - The error to extract status code from
 * @returns The appropriate HTTP status code
 */
export default function errorCodeFactory(err: unknown): number {
	// If it's our custom AppError, use its status code
	if (isAppError(err)) {
		return err.statusCode;
	}

	// If the error has a statusCode property, use it
	if (hasStatusCode(err)) {
		return err.statusCode;
	}

	// Handle objects with statusCode as string (convert to number)
	if (
		typeof err === 'object' &&
		err !== null &&
		'statusCode' in err &&
		typeof (err as any).statusCode === 'string'
	) {
		const statusCode = Number((err as any).statusCode);
		if (!isNaN(statusCode) && statusCode >= 100 && statusCode < 600) {
			return statusCode;
		}
	}

	// For standard errors, check the message for patterns (backward compatibility)
	if (err instanceof Error) {
		const message = err.message.toLowerCase();

		if (message.includes('not found')) {
			return 404;
		}

		if (message.includes('unauthorized')) {
			return 401;
		}

		if (message.includes('forbidden')) {
			return 403;
		}

		if (
			message.includes('version conflict') ||
			message.includes('version mismatch') ||
			message.includes('already exists')
		) {
			return 409;
		}

		if (message.includes('validation') || message.includes('invalid')) {
			return 400;
		}
	}

	// Default to 400 for unknown errors
	return 400;
}
