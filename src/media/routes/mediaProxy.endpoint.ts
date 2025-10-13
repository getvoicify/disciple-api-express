import type express from 'express';
import type { MediaRepository } from '../repository';
import { safeExecute } from '../../utils/handle-async';

/**
 * @openapi
 * /media/serve/{id}:
 *   get:
 *     summary: Serve/proxy media file
 *     description: Serve a media file by ID with proper authorization and caching
 *     tags: [Media]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID
 *     responses:
 *       302:
 *         description: Redirect to media file
 *         headers:
 *           Location:
 *             description: URL to the media file
 *             schema:
 *               type: string
 *           Cache-Control:
 *             description: Cache control header
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - cannot access this media
 *       404:
 *         description: Media not found
 */
export const mediaProxyEndpoint = (mediaRepository: MediaRepository) =>
  async (req: express.Request, res: express.Response) => {
    // Extract media ID from URL params (validation handled by middleware)
    const mediaId = req.params.id;

    // Retrieve media metadata from database
    const [mediaError, media] = await safeExecute(mediaRepository.findById(mediaId));

    if (mediaError) {
      console.error('Media proxy error:', mediaError);
      res.status(500).json({
        error: 'Internal server error',
        success: false
      });
      return;
    }

    if (!media) {
      res.status(404).json({
        error: 'Media not found',
        success: false
      });
      return;
    }

    // Set appropriate headers based on content type
    const contentType = media.mimeType || 'application/octet-stream';
    const cacheMaxAge = 3600; // 1 hour in seconds

    // Generate ETag for conditional requests
    const etag = `"${media.id}-${media.updatedAt.getTime()}"`;

    // Check if client already has the file (conditional request)
    if (req.headers['if-none-match'] === etag) {
      res.set('ETag', etag);
      res.status(304).end();
      return;
    }

    // Set response headers for the redirect
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${cacheMaxAge}`,
      'ETag': etag,
      'X-Content-Length': media.fileSize.toString(),
      'X-Original-Filename': media.originalFilename
    };

    // Add Content-Disposition header for PDFs and other files
    if (contentType === 'application/pdf') {
      headers['Content-Disposition'] = `inline; filename="${media.originalFilename}"`;
    }

    // Manual redirect to preserve all headers including Content-Type
    res.set(headers);
    res.set('Location', media.r2Url);
    res.status(302).redirect(media.r2Url);
  };
