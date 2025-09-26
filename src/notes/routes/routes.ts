import {Router} from 'express';

import {InputSchema as ListFilterSchema, noteListEndpoint} from './noteList.endpoint'
import {validate} from "../../utils/validate.middleware";
import type {NoteService} from "../service";
import {noteCreateEndpoint} from "./noteCreate.endpoint";
import {CreateNoteInput, UpdateNoteInput} from "../schemas";
import {noteFetchEndpoint, NoteFetchParamsInput} from "./noteFetch.endpoint";
import {noteUpdateEndpoint, NoteUpdateParamsInput} from "./noteUpdate.endpoint";
import {noteDeleteEndpoint, NoteDeleteParamsInput} from "./noteDelete.endpoint";
import {jwtVerify} from 'jose'
import {validateToken} from "../../utils/validate-token.middleware";
import {canAccessMiddleware} from "../../middleware/get-authorized-ids.middleware/get-authorized-ids.middleware";
import {createCacheRepository} from "../../cache";
import {cacheResponseMiddleware} from "../../middleware/cache-response.middleware/cache-response.middleware";
import {keyGenerator} from "../../middleware/key-generator.middleware";


export const notesRouter = (service: NoteService) => {
	const router = Router();
	const cacheRepo = createCacheRepository();
	const {
		IAM_ENDPOINT,
		IAM_REALM,
	} = process.env;
	const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

	router.get('/:noteId', [
		tokenVerifier(),
		validate(NoteFetchParamsInput, 'params'),
	], noteFetchEndpoint(service));

	router.put('/:noteId', [
		tokenVerifier(),
		validate(NoteUpdateParamsInput, 'params'),
		validate(UpdateNoteInput, 'body')
	], noteUpdateEndpoint(service));

	router.delete('/:noteId', [
		tokenVerifier(),
		validate(NoteDeleteParamsInput, 'params'),
	], noteDeleteEndpoint(service));

	router.get('/', [
		tokenVerifier(),
		validate(ListFilterSchema, 'query'),
		canAccessMiddleware({
			scope: 'read',
			resource: 'notes',
			queryUri: '/notes',
		}),
		keyGenerator('note', true),
		cacheResponseMiddleware(cacheRepo),
	], noteListEndpoint(service));

	router.post(
		'/',
		[
			tokenVerifier(),
			validate(CreateNoteInput),
			canAccessMiddleware({
				scope: 'create',
				resource: 'note',
			})
		],
		noteCreateEndpoint(service),
	);

	return router;
}
