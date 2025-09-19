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


export const notesRouter = (service: NoteService) => {
    const router = Router();
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
        validate(ListFilterSchema, 'query')
    ], noteListEndpoint(service));

    router.post(
        '/',
        [
            tokenVerifier(),
            validate(CreateNoteInput)
        ],
        noteCreateEndpoint(service),
    );

    return router;
}
