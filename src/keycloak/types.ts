export interface KeycloakResourcePermissions {
	read: string[];
	update: string[];
	delete: string[];
}

export interface KeycloakResource {
	id: string;
	name: string;
	type: string;
	uris?: string[]; // URIs for the resource (Keycloak native field)
	attributes: Record<string, string[]>;
	scopes: string[];
}

export interface KeycloakResourceData {
	id: string;
	name: string;
	type: string;
	ownerId: string;
	permissions: KeycloakResourcePermissions;
	uris?: string[]; // Optional URIs for the resource (can be multiple)
	additionalAttributes?: Record<string, string[]>; // Optional additional attributes
}

// Abstraction for Keycloak Admin API operations
export interface KeycloakAdminClient {
	createResource(resource: KeycloakResource): Promise<KeycloakResource>;
	updateResource(resourceId: string, resource: KeycloakResource): Promise<KeycloakResource>;
	deleteResource(resourceId: string): Promise<void>;
	getResourcesByIds(resourceIds: string[]): Promise<KeycloakResource[]>;
	getUserPermissions(userToken: string, resourceType: string, scope: string): Promise<string[]>;
	// User attribute methods for church membership sync
	getUserAttributes(userId: string): Promise<Record<string, any>>;
	updateUserAttributes(userId: string, attributes: Record<string, any>): Promise<void>;
}

// Main interface for resource management operations
export interface KeycloakResourceManager {
	createResource(resourceData: KeycloakResourceData): Promise<KeycloakResource>;
	updateResourcePermissions(resourceId: string, permissions: KeycloakResourcePermissions): Promise<KeycloakResource>;
	deleteResource(resourceId: string): Promise<void>;
	getAuthorizedResourceIds(userToken: string, resourceType: string, scope: string): Promise<string[]>;

	// Permission management methods
	grantPermission(resourceId: string, userId: string, scopes: string[]): Promise<void>;
	revokePermission(resourceId: string, userId: string, scopes: string[]): Promise<void>;
	transferOwnership(resourceId: string, currentOwnerId: string, newOwnerId: string): Promise<void>;

	// Validation methods
	validatePermissions(permissions: KeycloakResourcePermissions): void;
	ensureOwnerPermissions(permissions: KeycloakResourcePermissions, ownerId: string): KeycloakResourcePermissions;
	validateEventPayload(payload: any): void;
	validateScopes(scopes: string[]): void;
}
