import type { GalleryService } from '../service';
import type { Response, NextFunction } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import { safeExecute } from '../../utils/handle-async';
import { z } from 'zod';

export const GalleryCreateParamsInput = z.object({
  churchId: z.uuid()
});

export const GalleryCreateBodyInput = z.object({
  mediaIds: z.array(z.uuid()).min(1, 'At least one media item is required')
});

/**
 * @openapi
 * /churches/{churchId}/galleries:
 *   post:
 *     summary: Create a new gallery for a church
 *     description: Creates a gallery with media items and generates thumbnails
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
 *             mediaIds: ["550e8400-e29b-41d4-a716-446655440000", "650e8400-e29b-41d4-a716-446655440001"]
 *     responses:
 *       201:
 *         description: Gallery created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 gallery:
 *                   $ref: '#/components/schemas/Gallery'
 *       400:
 *         description: Invalid input or gallery already exists
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
 */
export const galleryCreateEndpoint = (service: GalleryService) =>
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

    const { churchId } = GalleryCreateParamsInput.parse(req.params);
    const { mediaIds } = GalleryCreateBodyInput.parse(req.body);

    const [error, gallery] = await safeExecute(
      service.createGallery({ churchId, mediaIds })
    );

    if (error) {
      res.status(400).json({
        error: error.message,
        success: false
      });
      return;
    }

    res.status(201).json({
      success: true,
      gallery
    });
  };