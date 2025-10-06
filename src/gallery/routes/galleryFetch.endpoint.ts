import type { GalleryService } from '../service';
import type { Response, NextFunction } from 'express';
import type { EndpointRequest } from '../../types/endpoint-handler';
import { safeExecute } from '../../utils/handle-async';
import { z } from 'zod';

export const GalleryFetchParamsInput = z.object({
  churchId: z.uuid()
});

/**
 * @openapi
 * /churches/{churchId}/galleries:
 *   get:
 *     summary: Get gallery for a church
 *     description: Retrieves the gallery associated with a church
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
 *     responses:
 *       200:
 *         description: Gallery retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 gallery:
 *                   $ref: '#/components/schemas/Gallery'
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
export const galleryFetchEndpoint = (service: GalleryService) =>
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

    const { churchId } = GalleryFetchParamsInput.parse(req.params);

    const [error, gallery] = await safeExecute(
      service.getGalleryByChurchId(churchId)
    );

    if (error) {
      res.status(400).json({
        error: error.message,
        success: false
      });
      return;
    }

    if (!gallery) {
      res.status(404).json({
        error: 'Gallery not found',
        success: false
      });
      return;
    }

    res.status(200).json({
      success: true,
      gallery
    });
  };