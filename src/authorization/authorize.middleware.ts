import type { Request, Response, NextFunction } from 'express';
import type { ResourceType, Action, Role } from './types';
import type { ResourceResolver } from './resolvers';
import { isActionAllowed } from './policies';
import { safeExecute } from '../utils/handle-async';
import { logger } from '../logging';
import { InternalServerError } from '../utils/errors';

export interface AuthorizeOptions {
  resource: ResourceType;
  action: Action;
  paramName?: string;
}

type MemberRoleLookup = (churchId: string, userId: string) => Promise<Role | null>;

export function createAuthorizeMiddleware(
  resolvers: Record<ResourceType, ResourceResolver>,
  memberRoleLookup: MemberRoleLookup,
) {
  return (options: AuthorizeOptions) => {
    const { resource, action } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const userId = (req as any)['user']?.[1]?.payload?.sub as string | undefined;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required', success: false });
        return;
      }

      // For create actions, check role against the target church
      if (action === 'create') {
        // Notes: any authenticated user can create
        if (isActionAllowed(resource, action, undefined, false)) {
          next();
          return;
        }

        // Church-scoped resources need a churchId
        const churchId = req.params?.churchId || req.body?.churchId;
        if (!churchId) {
          res.status(400).json({ error: 'Church context required', success: false });
          return;
        }

        const [roleErr, role] = await safeExecute(memberRoleLookup(churchId, userId));
        if (roleErr) {
          logger.error({ error: roleErr, userId, churchId }, 'Failed to look up member role');
          next(new InternalServerError('Authorization check failed'));
          return;
        }

        if (isActionAllowed(resource, action, role ?? undefined, false)) {
          next();
          return;
        }

        res.status(403).json({ error: 'Forbidden', success: false });
        return;
      }

      // For read/update/delete, resolve the resource first
      const resourceId = options.paramName
        ? req.params?.[options.paramName]
        : req.params?.id || req.params?.noteId || req.params?.churchId;
      if (!resourceId) {
        res.status(400).json({ error: 'Resource identifier required', success: false });
        return;
      }

      const resolver = resolvers[resource];
      const [resolveErr, resourceInfo] = await safeExecute(resolver(resourceId));

      if (resolveErr) {
        logger.error({ error: resolveErr, resourceId, resource }, 'Failed to resolve resource');
        next(new InternalServerError('Authorization check failed'));
        return;
      }

      if (!resourceInfo) {
        res.status(404).json({ error: `${resource} not found`, success: false });
        return;
      }

      // Determine if user is the author/owner
      const isAuthor = resourceInfo.authorId === userId || resourceInfo.ownerId === userId;

      // Look up church role if resource is church-scoped
      let role: Role | undefined;
      const churchId = resourceInfo.churchId;
      if (churchId) {
        const [roleErr, memberRole] = await safeExecute(memberRoleLookup(churchId, userId));
        if (roleErr) {
          logger.error({ error: roleErr, userId, churchId }, 'Failed to look up member role');
          next(new InternalServerError('Authorization check failed'));
          return;
        }
        role = memberRole ?? undefined;
      }

      if (isActionAllowed(resource, action, role, isAuthor)) {
        next();
        return;
      }

      (req as any).log?.warn({ userId, resource, action, resourceId }, 'Authorization denied');
      res.status(403).json({ error: 'Forbidden', success: false });
    };
  };
}
