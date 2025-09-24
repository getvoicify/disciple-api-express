import { Router } from 'express';
import type { MediaRepository } from '../repository';
import type { MediaUploadService } from '../media-upload-service';
import { mediaUploadEndpoint } from './mediaUpload.endpoint';
import { mediaProxyEndpoint } from './mediaProxy.endpoint';
import { validateToken } from '../../utils/validate-token.middleware';
import { validate } from '../../utils/validate.middleware';
import { MediaIdInput } from '../schemas';
import { jwtVerify } from 'jose';

export const mediaRouter = (
  mediaRepository: MediaRepository,
  uploadService: MediaUploadService
) => {
  const router = Router();
  const {
    IAM_ENDPOINT,
    IAM_REALM,
  } = process.env;
  const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

  // Media upload endpoint with authentication and multer middleware
  router.post('/upload', [
    tokenVerifier(true)
  ], ...mediaUploadEndpoint(uploadService));

  // Media proxy/serve endpoint with authentication and UUID validation
  router.get('/serve/:id', [
    tokenVerifier(true),
    validate(MediaIdInput, 'params')
  ], mediaProxyEndpoint(mediaRepository));

  return router;
};