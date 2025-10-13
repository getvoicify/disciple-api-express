import type { GalleryService } from '../service';
import type { Response, NextFunction } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import { safeExecute } from '../../utils/handle-async';
import { z } from 'zod';

export const GalleryAddMediaParamsInput = z.object({
  churchId: z.uuid(),
  galleryId: z.uuid()
});

export const GalleryAddMediaBodyInput = z.object({
  mediaIds: z.array(z.uuid()).min(1, 'At least one media item is required')
});

/**
 * @openapi
 * /churches/{churchId}/galleries/{galleryId}/media:
 *   post:
 *     summary: Add media to existing gallery
 *     description: Adds new media items to a gallery and generates thumbnails
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mediaIds
 *             properties:
 *               mediaIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 description: Array of media IDs to add to the gallery
 *           example:
 *             mediaIds: ["750e8400-e29b-41d4-a716-446655440002"]
 *     responses:
 *       200:
 *         description: Media added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 gallery:
 *                   $ref: '#/components/schemas/GalleryWithItems'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Gallery not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const galleryAddMediaEndpoint = (service: GalleryService) =>
  async (req: EndpointRequest, res: Response, _next: NextFunction) => {
    const user = req.user?.[1]?.payload;
    const userId = user?.sub;

    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false
      });
      return;
    }

    const { galleryId } = GalleryAddMediaParamsInput.parse(req.params);
    const { mediaIds } = GalleryAddMediaBodyInput.parse(req.body);

    const [error, gallery] = await safeExecute(
      service.addMediaToGallery({ galleryId, mediaIds })
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
      gallery
    });
  };
