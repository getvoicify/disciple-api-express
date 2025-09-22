export interface KeycloakResourcePermissions {
	read: string[];
	update: string[];
	delete: string[];
}

export interface KeycloakResource {
	id: string;
	name: string;
	type: string;
	attributes: Record<string, string[]>;
	scopes: string[];
}

export interface KeycloakResourceData {
	id: string;
	name: string;
	type: string;
	ownerId: string;
	permissions: KeycloakResourcePermissions;
}

// Abstraction for Keycloak Admin API operations
export interface KeycloakAdminClient {
	createResource(resource: KeycloakResource): Promise<KeycloakResource>;
	updateResource(resourceId: string, resource: KeycloakResource): Promise<KeycloakResource>;
	deleteResource(resourceId: string): Promise<void>;
	getResourcesByIds(resourceIds: string[]): Promise<KeycloakResource[]>;
	getUserPermissions(userToken: string, resourceType: string, scope: string): Promise<string[]>;
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

// Implementation of KeycloakResourceManager
export class KeycloakResourceManagerImpl implements KeycloakResourceManager {
	private readonly VALID_SCOPES = ['read', 'update', 'delete'];

	constructor(private readonly adminClient: KeycloakAdminClient) {}

	async createResource(resourceData: KeycloakResourceData): Promise<KeycloakResource> {
		try {
			// Validate permissions
			this.validatePermissions(resourceData.permissions);

			// Ensure owner has all permissions
			const permissions = this.ensureOwnerPermissions(resourceData.permissions, resourceData.ownerId);

			// Build Keycloak resource
			const resource: KeycloakResource = {
				id: resourceData.id,
				name: resourceData.name,
				type: resourceData.type,
				attributes: {
					owner_id: [resourceData.ownerId],
					can_read: permissions.read,
					can_update: permissions.update,
					can_delete: permissions.delete,
					resource_type: [resourceData.type],
					created_at: [new Date().toISOString()]
				},
				scopes: this.VALID_SCOPES
			};

			return await this.adminClient.createResource(resource);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to create Keycloak resource: ${message}`);
		}
	}

	async updateResourcePermissions(resourceId: string, permissions: KeycloakResourcePermissions): Promise<KeycloakResource> {
		try {
			this.validatePermissions(permissions);

			// Fetch the current resource to preserve existing data
			const [existingResource] = await this.adminClient.getResourcesByIds([resourceId]);
			if (!existingResource) {
				throw new Error(`Resource ${resourceId} not found`);
			}

			// Update the resource with new permissions while preserving existing attributes
			const updatedResource: KeycloakResource = {
				...existingResource,
				attributes: {
					...existingResource.attributes,
					can_read: permissions.read,
					can_update: permissions.update,
					can_delete: permissions.delete,
				}
			};

			return await this.adminClient.updateResource(resourceId, updatedResource);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to update Keycloak resource: ${message}`);
		}
	}

	async deleteResource(resourceId: string): Promise<void> {
		try {
			await this.adminClient.deleteResource(resourceId);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to delete Keycloak resource: ${message}`);
		}
	}

	async getAuthorizedResourceIds(userToken: string, resourceType: string, scope: string): Promise<string[]> {
		try {
			return await this.adminClient.getUserPermissions(userToken, resourceType, scope);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to get authorized resource IDs: ${message}`);
		}
	}

	async grantPermission(resourceId: string, userId: string, scopes: string[]): Promise<void> {
		this.validateScopes(scopes);

		// Get the existing resource to preserve other data
		const [existingResource] = await this.adminClient.getResourcesByIds([resourceId]);
		if (!existingResource) {
			throw new Error(`Resource ${resourceId} not found`);
		}

		// Update resource permissions to include the new user
		const updatedAttributes = { ...existingResource.attributes };
		scopes.forEach(scope => {
			const attributeKey = `can_${scope}` as keyof typeof updatedAttributes;
			if (updatedAttributes[attributeKey]) {
				// Add user if not already present
				const currentUsers = Array.isArray(updatedAttributes[attributeKey])
					? updatedAttributes[attributeKey] as string[]
					: [updatedAttributes[attributeKey] as string];

				if (!currentUsers.includes(userId)) {
					updatedAttributes[attributeKey] = [...currentUsers, userId];
				}
			} else {
				updatedAttributes[attributeKey] = [userId];
			}
		});

		const updatedResource: KeycloakResource = {
			...existingResource,
			attributes: updatedAttributes
		};

		await this.adminClient.updateResource(resourceId, updatedResource);
	}

	async revokePermission(resourceId: string, userId: string, scopes: string[]): Promise<void> {
		this.validateScopes(scopes);

		// Get the existing resource to preserve other data
		const [existingResource] = await this.adminClient.getResourcesByIds([resourceId]);
		if (!existingResource) {
			throw new Error(`Resource ${resourceId} not found`);
		}

		// Update resource permissions to remove the user
		const updatedAttributes = { ...existingResource.attributes };
		scopes.forEach(scope => {
			const attributeKey = `can_${scope}` as keyof typeof updatedAttributes;
			if (updatedAttributes[attributeKey]) {
				const currentUsers = Array.isArray(updatedAttributes[attributeKey])
					? updatedAttributes[attributeKey] as string[]
					: [updatedAttributes[attributeKey] as string];

				updatedAttributes[attributeKey] = currentUsers.filter(user => user !== userId);
			}
		});

		const updatedResource: KeycloakResource = {
			...existingResource,
			attributes: updatedAttributes
		};

		await this.adminClient.updateResource(resourceId, updatedResource);
	}

	async transferOwnership(_resourceId: string, _currentOwnerId: string, _newOwnerId: string): Promise<void> {
		// Implementation would update the owner_id attribute and ensure new owner has full permissions
		// This is a placeholder for the actual implementation
	}

	validatePermissions(permissions: KeycloakResourcePermissions): void {
		const validScopes = new Set(this.VALID_SCOPES);

		for (const scope of Object.keys(permissions)) {
			if (!validScopes.has(scope)) {
				throw new Error(`Invalid permission scope: ${scope}`);
			}
		}
	}

	ensureOwnerPermissions(permissions: KeycloakResourcePermissions, ownerId: string): KeycloakResourcePermissions {
		const result = { ...permissions };

		// Ensure owner is in all permission arrays
		for (const scope of this.VALID_SCOPES) {
			if (!result[scope as keyof KeycloakResourcePermissions]) {
				result[scope as keyof KeycloakResourcePermissions] = [ownerId];
			} else if (!result[scope as keyof KeycloakResourcePermissions].includes(ownerId)) {
				result[scope as keyof KeycloakResourcePermissions].push(ownerId);
			}
		}

		return result;
	}

	validateEventPayload(payload: any): void {
		if (!payload.resourceId || payload.resourceId.trim() === '') {
			throw new Error('Invalid resourceId: cannot be empty');
		}

		if (!payload.resourceType || payload.resourceType.trim() === '') {
			throw new Error('Invalid resourceType: cannot be empty');
		}
	}

	validateScopes(scopes: string[]): void {
		for (const scope of scopes) {
			if (!this.VALID_SCOPES.includes(scope)) {
				throw new Error(`Invalid scope: ${scope}. Valid scopes are: ${this.VALID_SCOPES.join(', ')}`);
			}
		}
	}
}
