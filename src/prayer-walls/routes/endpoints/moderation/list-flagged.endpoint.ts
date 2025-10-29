import type { Response } from 'express';
import type { EndpointRequest } from '../../../../types/endpoint-handler';
import type { IModerationService } from '../../../services/moderation.service';
import { safeExecute } from '../../../../utils/handle-async';
import errorCodeFactory from '../../../../utils/error-code.factory';
import { getUserIdFromRequest } from '../../../../utils/get-user-id';

/**
 * Endpoint handler for listing flagged content for a church
 * GET /api/churches/:churchId/moderation/flagged
 */
export const listFlaggedContentEndpoint = (service: IModerationService) =>
  async (req: EndpointRequest, res: Response) => {
    const { churchId } = req.params;

    // Extract user ID from authenticated token
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      res.status(401).json({
        error: 'User authentication required',
        success: false,
      });
      return;
    }

    // List flagged content (service will verify pastor role)
    const [error, flaggedContent] = await safeExecute(
      service.listFlaggedContent(churchId, userId)
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
      flaggedContent,
      success: true,
    });
  };
