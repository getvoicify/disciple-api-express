import type { Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import type { EndpointRequest } from '../../../../types/endpoint-handler';
import type { IModerationService } from '../../../services/moderation.service';
import type { IPrayerRequestRepository } from '../../../repositories/prayer-request.repository';
import { reviewFlaggedContentSchema } from '../../../schemas/moderation.schemas';
import { safeExecute } from '../../../../utils/handle-async';
import errorCodeFactory from '../../../../utils/error-code.factory';
import { getUserIdFromRequest } from '../../../../utils/get-user-id';
import { broadcastContentRestored } from '../../../../websocket/handlers/moderation.handler';
import { logger } from '../../../../logging';

/**
 * Endpoint handler for reviewing flagged content (delete or restore)
 * POST /api/moderation/flagged/:flagId/review
 */
export const reviewFlaggedContentEndpoint = (
  service: IModerationService,
  prayerRepository: IPrayerRequestRepository,
  io?: SocketServer
) =>
  async (req: EndpointRequest, res: Response) => {
    // Parse and validate request body
    const parseResult = reviewFlaggedContentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
        success: false,
      });
      return;
    }

    const { action, notes } = parseResult.data;
    const { flagId } = req.params;

    // Extract user ID from authenticated token
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    // Review flagged content (service will verify pastor role)
    const [error, reviewedFlag] = await safeExecute(
      service.reviewFlaggedContent(flagId, action, userId, notes)
    );

    if (error) {
      const statusCode = errorCodeFactory(error);
      res.status(statusCode).json({
        error: error.message,
        success: false,
      });
      return;
    }

    res.status(200).json({
      reviewedFlag,
      success: true,
    });

    // Broadcast WebSocket event if content was restored
    if (io && action === 'restore') {
      // Fetch the prayer to get its wallId for broadcasting
      const [prayerError, prayer] = await safeExecute(
        prayerRepository.findById(reviewedFlag!.prayer_request_id)
      );

      if (prayerError) {
        logger.error(
          { error: prayerError, prayerId: reviewedFlag!.prayer_request_id },
          'Failed to fetch prayer for WebSocket broadcast'
        );
      } else if (prayer) {
        broadcastContentRestored(io, prayer.prayer_wall_id, prayer.id, userId);
      }
    }
  };
