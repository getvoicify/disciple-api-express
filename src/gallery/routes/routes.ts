import { Router } from 'express';
import type { GalleryService } from '../service';
import { validateToken } from '../../utils/validate-token.middleware';
import { jwtVerify } from 'jose';
import { validate } from '../../utils/validate.middleware';
import {
  galleryCreateEndpoint,
  GalleryCreateParamsInput,
  GalleryCreateBodyInput
} from './galleryCreate.endpoint';
import {
  galleryAddMediaEndpoint,
  GalleryAddMediaParamsInput,
  GalleryAddMediaBodyInput
} from './galleryAddMedia.endpoint';
import {
  galleryFetchEndpoint,
  GalleryFetchParamsInput
} from './galleryFetch.endpoint';
import {
  galleryRemoveMediaEndpoint,
  GalleryRemoveMediaParamsInput
} from './galleryRemoveMedia.endpoint';

export const galleryRouter = (service: GalleryService) => {
  const router = Router({ mergeParams: true });
  const {
    IAM_ENDPOINT,
    IAM_REALM
  } = process.env;
  const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

  // POST /churches/:churchId/galleries
  router.post('/', [
    tokenVerifier(),
    validate(GalleryCreateParamsInput, 'params'),
    validate(GalleryCreateBodyInput, 'body')
  ], galleryCreateEndpoint(service));

  // GET /churches/:churchId/galleries
  router.get('/', [
    tokenVerifier(),
    validate(GalleryFetchParamsInput, 'params')
  ], galleryFetchEndpoint(service));

  // POST /churches/:churchId/galleries/:galleryId/media
  router.post('/:galleryId/media', [
    tokenVerifier(),
    validate(GalleryAddMediaParamsInput, 'params'),
    validate(GalleryAddMediaBodyInput, 'body')
  ], galleryAddMediaEndpoint(service));

  // DELETE /churches/:churchId/galleries/:galleryId/media/:mediaId
  router.delete('/:galleryId/media/:mediaId', [
    tokenVerifier(),
    validate(GalleryRemoveMediaParamsInput, 'params')
  ], galleryRemoveMediaEndpoint(service));

  return router;
};
