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
import {createCacheRepository} from "../../cache";
import {cacheResponseMiddleware} from "../../middleware/cache-response.middleware/cache-response.middleware";
import {keyGenerator} from "../../middleware/key-generator.middleware";
import {extractFiltersMiddleware} from "../../middleware/extract-filters.middleware";
import type {AuthorizeOptions} from '../../authorization';


export const notesRouter = (service: NoteService, authorize: (options: AuthorizeOptions) => any) => {
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
		authorize({ resource: 'note', action: 'read' }),
	], noteFetchEndpoint(service));

	router.put('/:noteId', [
		tokenVerifier(),
		validate(NoteUpdateParamsInput, 'params'),
		validate(UpdateNoteInput, 'body'),
		authorize({ resource: 'note', action: 'update' }),
	], noteUpdateEndpoint(service));

	router.delete('/:noteId', [
		tokenVerifier(),
		validate(NoteDeleteParamsInput, 'params'),
		authorize({ resource: 'note', action: 'delete' }),
	], noteDeleteEndpoint(service));

	router.get('/', [
		tokenVerifier(),
		validate(ListFilterSchema, 'query'),
		extractFiltersMiddleware(ListFilterSchema, 'query'),
		keyGenerator('note', true),
		cacheResponseMiddleware(cacheRepo),
	], noteListEndpoint(service, cacheRepo));

	router.post(
		'/',
		[
			tokenVerifier(),
			validate(CreateNoteInput),
		],
		noteCreateEndpoint(service),
	);

	return router;
}
