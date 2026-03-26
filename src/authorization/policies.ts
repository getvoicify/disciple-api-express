import type { Actor, ResourceType, Action, Role } from './types';

export const policies: Record<string, Record<string, Actor[]>> = {
  church:  { create: ['*'],                        update: ['Owner'],                    delete: ['Owner'] },
  post:    { create: ['Owner', 'Manager'],         read: ['*'],      update: ['Owner', 'Manager', 'author'], delete: ['Owner', 'author'] },
  series:  { create: ['Owner', 'Manager'],         read: ['*'],      update: ['Owner', 'Manager', 'author'], delete: ['Owner', 'author'] },
  gallery: { create: ['Owner', 'Manager'],         read: ['*'],      update: ['Owner', 'Manager'],           delete: ['Owner'] },
  note:    { create: ['*'],                        read: ['author'], update: ['author'],                      delete: ['author'] },
};

export function isActionAllowed(
  resourceType: ResourceType,
  action: Action,
  role: Role | undefined,
  isAuthor: boolean,
): boolean {
  const resourcePolicies = policies[resourceType];
  if (!resourcePolicies) return false;

  const allowedActors = resourcePolicies[action];
  if (!allowedActors) return false;

  if (allowedActors.includes('*')) return true;
  if (isAuthor && allowedActors.includes('author')) return true;
  return role && allowedActors.includes(role);
}
