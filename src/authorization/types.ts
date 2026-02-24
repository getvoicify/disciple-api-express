export type Role = 'Owner' | 'Manager' | 'Member';
export type Actor = Role | 'author' | '*';
export type ResourceType = 'church' | 'post' | 'series' | 'gallery' | 'note';
export type Action = 'create' | 'read' | 'update' | 'delete';

export interface AuthorizationContext {
  userId: string;
  resourceType: ResourceType;
  action: Action;
  resourceId?: string;
  churchId?: string;
}

export interface ResourceInfo {
  authorId?: string;
  churchId?: string;
  ownerId?: string;
}
