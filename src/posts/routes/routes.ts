import {Router} from 'express';
import {jwtVerify} from 'jose';
import {z} from 'zod';
import type {PostService} from '../service';
import type {SeriesService} from '../../series/service';
import {validate} from '../../utils/validate.middleware';
import {validateToken} from '../../utils/validate-token.middleware';
import {canAccessMiddleware} from '../../middleware/get-authorized-ids.middleware/get-authorized-ids.middleware';
import {createCacheRepository} from '../../cache';
import {cacheResponseMiddleware} from '../../middleware/cache-response.middleware/cache-response.middleware';
import {keyGenerator} from '../../middleware/key-generator.middleware';
import {extractFiltersMiddleware} from '../../middleware/extract-filters.middleware';
import {postCreateEndpoint} from './postCreate.endpoint';
import {postFetchEndpoint} from './postFetch.endpoint';
import {postUpdateEndpoint} from './postUpdate.endpoint';
import {postDeleteEndpoint} from './postDelete.endpoint';
import {postListEndpoint, InputSchema as ListFilterSchema} from './postList.endpoint';
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
	const cacheRepo = createCacheRepository();
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

	// Public endpoint - fetch specific post
	router.get('/:id', [
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

	// Public endpoint with optional filtering - list posts
	router.get('/', [
		validate(ListFilterSchema, 'query'),
		canAccessMiddleware({
			scope: 'read',
			resource: 'posts',
			queryUri: '/posts',
		}),
		extractFiltersMiddleware(ListFilterSchema, 'query'),
		keyGenerator('post', true),
		cacheResponseMiddleware(cacheRepo),
	], postListEndpoint(service, cacheRepo));

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