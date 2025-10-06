import type { GalleryService } from '../service';
import type { Response, NextFunction } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import { safeExecute } from '../../utils/handle-async';
import { z } from 'zod';

export const GalleryRemoveMediaParamsInput = z.object({
  churchId: z.uuid(),
  galleryId: z.uuid(),
  mediaId: z.uuid()
});

/**
 * @openapi
 * /churches/{churchId}/galleries/{galleryId}/media/{mediaId}:
 *   delete:
 *     summary: Remove media from gallery
 *     description: Removes a media item from the gallery
 *     tags: [Galleries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: churchId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The church ID
 *       - in: path
 *         name: galleryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The gallery ID
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The media ID to remove
 *     responses:
 *       200:
 *         description: Media removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const galleryRemoveMediaEndpoint = (service: GalleryService) =>
  async (req: EndpointRequest, res: Response, next: NextFunction) => {
    const user = req.user?.[0];
    const userId = user?.sub;

    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false
      });
      return;
    }

    const { galleryId, mediaId } = GalleryRemoveMediaParamsInput.parse(req.params);

    const [error] = await safeExecute(
      service.removeMediaFromGallery(galleryId, mediaId)
    );

    if (error) {
      res.status(400).json({
        error: error.message,
        success: false
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Media removed from gallery successfully'
    });
  };