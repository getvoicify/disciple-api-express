import {Router} from 'express';
import {jwtVerify} from 'jose';
import {z} from 'zod';
import type {PostService} from '../service';
import type {SeriesService} from '../../series/service';
import {validate} from '../../utils/validate.middleware';
import {validateToken} from '../../utils/validate-token.middleware';
import {canAccessMiddleware} from '../../middleware/get-authorized-ids.middleware/get-authorized-ids.middleware';
import {postCreateEndpoint} from './postCreate.endpoint';
import {postFetchEndpoint} from './postFetch.endpoint';
import {postUpdateEndpoint} from './postUpdate.endpoint';
import {postDeleteEndpoint} from './postDelete.endpoint';
import {postPublishEndpoint} from './postPublish.endpoint';
import {dailyDevotionalsEndpoint} from './dailyDevotionals.endpoint';
import {CreatePostInput, UpdatePostInput} from '../schemas';

// Param validation schemas
export const PostIdParamsInput = z.object({
	id: z.uuid(),
});

export const PublishActionInput = z.object({
	action: z.enum(['publish', 'unpublish'])
});

export const postsRouter = (service: PostService, seriesService: SeriesService) => {
	const router = Router();
	const {
		IAM_ENDPOINT,
		IAM_REALM,
	} = process.env;

	if (!IAM_ENDPOINT || !IAM_REALM) {
		throw new Error('IAM_ENDPOINT and IAM_REALM environment variables are required');
	}

	const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

	// Protected endpoint - daily devotionals (MUST be before /:id to prevent routing conflicts)
	router.get('/daily-devotionals', [
		tokenVerifier(),
	], dailyDevotionalsEndpoint(seriesService));

	// Public/protected endpoint - fetch specific post (public for published, auth required for drafts)
	router.get('/:id', [
		tokenVerifier(false),
		validate(PostIdParamsInput, 'params'),
	], postFetchEndpoint(service));

	// Protected endpoint - update post
	router.patch('/:id', [
		tokenVerifier(),
		validate(PostIdParamsInput, 'params'),
		validate(UpdatePostInput, 'body')
	], postUpdateEndpoint(service));

	// Protected endpoint - delete post
	router.delete('/:id', [
		tokenVerifier(),
		validate(PostIdParamsInput, 'params'),
	], postDeleteEndpoint(service));

	// Protected endpoint - publish/unpublish post
	router.patch('/:id/publish', [
		tokenVerifier(),
		validate(PostIdParamsInput, 'params'),
		validate(PublishActionInput, 'body'),
	], postPublishEndpoint(service));

	// Protected endpoint - create post
	// Note: Uses singular 'post' resource name (intentional, not 'posts')
	router.post('/', [
		tokenVerifier(),
		validate(CreatePostInput),
		canAccessMiddleware({
			scope: 'create',
			resource: 'post',
		})
	], postCreateEndpoint(service));

	return router;
};
