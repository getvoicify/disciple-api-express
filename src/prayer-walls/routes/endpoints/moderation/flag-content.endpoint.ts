import type { Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import type { EndpointRequest } from '../../../../types/endpoint-handler';
import type { IModerationService } from '../../../services/moderation.service';
import { flagContentSchema } from '../../../schemas/moderation.schemas';
import { safeExecute } from '../../../../utils/handle-async';
import errorCodeFactory from '../../../../utils/error-code.factory';
import {
  broadcastContentFlagged,
  broadcastContentHidden,
} from '../../../../websocket/handlers/moderation.handler';

/**
 * Endpoint handler for flagging prayer content
 * POST /api/prayer-walls/:wallId/prayers/:prayerId/flag
 */
export const flagContentEndpoint = (service: IModerationService, io?: SocketServer) =>
  async (req: EndpointRequest, res: Response) => {
    // Parse and validate request body
    const parseResult = flagContentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
        success: false,
      });
      return;
    }

    const { reason } = parseResult.data;
    const { wallId, prayerId } = req.params;

    // Extract user ID from authenticated token
    const user = req.user?.[1]?.payload;
    const userId = user?.sub as string;

    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    // Flag the content
    const [error, flaggedContent] = await safeExecute(
      service.flagContent(prayerId, userId, reason)
    );

    if (error) {
      const statusCode = errorCodeFactory(error);
      res.status(statusCode).json({
        error: error.message,
        success: false,
      });
      return;
    }

    res.status(201).json({
      flaggedContent,
      success: true,
    });

    // Broadcast WebSocket events
    if (io) {
      broadcastContentFlagged(io, wallId, prayerId, flaggedContent!.id, reason);
      broadcastContentHidden(io, wallId, prayerId);
    }
  };
