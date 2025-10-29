import type { Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import type { EndpointRequest } from '../../../../types/endpoint-handler';
import type { IModerationService } from '../../../services/moderation.service';
import { banUserSchema } from '../../../schemas/moderation.schemas';
import { safeExecute } from '../../../../utils/handle-async';
import errorCodeFactory from '../../../../utils/error-code.factory';
import { getUserIdFromRequest } from '../../../../utils/get-user-id';
import { broadcastUserBanned } from '../../../../websocket/handlers/moderation.handler';

/**
 * Endpoint handler for banning a user from a wall
 * POST /api/prayer-walls/:wallId/members/:userId/ban
 */
export const banUserEndpoint = (service: IModerationService, io?: SocketServer) =>
  async (req: EndpointRequest, res: Response) => {
    // Parse and validate request body
    const parseResult = banUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
        success: false,
      });
      return;
    }

    const { churchWide } = parseResult.data;
    const { wallId, userId: targetUserId } = req.params;

    // Extract user ID from authenticated token
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    // Ban the user (service will verify pastor role)
    const [error, success] = await safeExecute(
      service.banUser(wallId, targetUserId, userId, churchWide)
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
      success: true,
      banned: success,
    });

    // Broadcast WebSocket event
    if (io && success) {
      broadcastUserBanned(io, wallId, targetUserId, userId);
    }
  };
