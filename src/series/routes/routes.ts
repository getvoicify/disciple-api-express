import { Router } from 'express';
import { jwtVerify } from 'jose';
import { validate } from '../../utils/validate.middleware';
import { validateToken } from '../../utils/validate-token.middleware';
import type { AuthorizeOptions } from '../../authorization';
import type { SeriesService } from '../service';
import { CreateSeriesInput } from '../schemas';
import { devotionalCreateEndpoint } from './devotionalCreate.endpoint';

export const devotionalRouter = (service: SeriesService, authorize: (options: AuthorizeOptions) => any) => {
	const router = Router();
	const {
		IAM_ENDPOINT,
		IAM_REALM,
	} = process.env;
	const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

	router.post(
		'/',
		[
			tokenVerifier(),
			validate(CreateSeriesInput),
			authorize({ resource: 'series', action: 'create' }),
		],
		devotionalCreateEndpoint(service),
	);

	return router;
}
