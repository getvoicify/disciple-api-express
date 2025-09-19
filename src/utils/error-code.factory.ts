export default (err: Error) => {
	const message = err.message;
	if (message.includes('not found')) {
		return 404;
	}

	if (
		message.includes('version conflict') ||
		message.includes('Version mismatch')
	) {
		return 409;
	}

	return 400;
}
