import { type KeycloakResourcePermissions as BaseKeycloakResourcePermissions } from "./types";
import { type Outbox } from "../outbox";

// Extended permissions type that allows custom scopes
export interface KeycloakResourcePermissions extends BaseKeycloakResourcePermissions {
	[scope: string]: string[];
}

// Resource type definitions
export type ResourceType = 'note' | 'church' | 'event' | 'user' | string;

// Generic resource interface
export interface Resource {
	id: string;
	[key: string]: any;
}

// Keycloak event types
export const KEYCLOAK_EVENTS = {
	RESOURCE_CREATE: 'keycloak.resource.create',
	RESOURCE_DELETE: 'keycloak.resource.delete',
	PERMISSION_GRANT: 'keycloak.permission.grant',
	PERMISSION_REVOKE: 'keycloak.permission.revoke',
	OWNERSHIP_TRANSFER: 'keycloak.ownership.transfer',
	BULK_PERMISSION_UPDATE: 'keycloak.permission.bulk_update'
} as const;

export type KeycloakEventType = typeof KEYCLOAK_EVENTS[keyof typeof KEYCLOAK_EVENTS];

// Event payload types
export interface KeycloakResourceCreatePayload {
	resourceId: string;
	resourceType: ResourceType;
	ownerId: string;
	permissions: KeycloakResourcePermissions;
	metadata?: Record<string, any>;
}

export interface KeycloakResourceDeletePayload {
	resourceId: string;
	resourceType: ResourceType;
	metadata?: Record<string, any>;
}

export interface KeycloakPermissionGrantPayload {
	resourceId: string;
	resourceType: ResourceType;
	granteeId: string;
	scopes: string[];
	metadata?: Record<string, any>;
}

export interface KeycloakPermissionRevokePayload {
	resourceId: string;
	resourceType: ResourceType;
	revokeeId: string;
	scopes: string[];
	metadata?: Record<string, any>;
}

export interface KeycloakOwnershipTransferPayload {
	resourceId: string;
	resourceType: ResourceType;
	currentOwnerId: string;
	newOwnerId: string;
	metadata?: Record<string, any>;
}

export interface KeycloakBulkPermissionUpdatePayload {
	resourceId: string;
	resourceType: ResourceType;
	permissions: KeycloakResourcePermissions;
	metadata?: Record<string, any>;
}

// Union type for all Keycloak event payloads
export type KeycloakEventPayload =
	| KeycloakResourceCreatePayload
	| KeycloakResourceDeletePayload
	| KeycloakPermissionGrantPayload
	| KeycloakPermissionRevokePayload
	| KeycloakOwnershipTransferPayload
	| KeycloakBulkPermissionUpdatePayload;

export interface KeycloakOutboxEvent {
	type: KeycloakEventType;
	payload: KeycloakEventPayload;
	timestamp?: number;
	correlationId?: string;
}

export interface KeycloakResourceCreateOptions {
	sharedReadWith?: string[];
	sharedUpdateWith?: string[];
	sharedDeleteWith?: string[];
	metadata?: Record<string, any>;
}

// Resource-specific configuration
export interface ResourceConfig {
	type: ResourceType;
	validScopes?: string[];
	defaultPermissions?: Partial<KeycloakResourcePermissions>;
	validateResource?: (resource: Resource) => boolean;
	transformResource?: (resource: Resource) => Resource;
}

// Generalized adapter for managing Keycloak resource events through the outbox pattern
export class GeneralizedKeycloakOutboxAdapter {
	private readonly DEFAULT_SCOPES = ['read', 'update', 'delete'];
	private readonly resourceConfigs = new Map<ResourceType, ResourceConfig>();

	constructor(
		private readonly outbox: Outbox<KeycloakOutboxEvent>,
		configs?: ResourceConfig[]
	) {
		// Register default configurations
		this.registerDefaultConfigs();

		// Register custom configurations
		if (configs) {
			configs.forEach(config => this.registerResourceConfig(config));
		}
	}

	/**
	 * Register default resource configurations
	 */
	private registerDefaultConfigs(): void {
		// Note configuration
		this.registerResourceConfig({
			type: 'note',
			validScopes: ['read', 'update', 'delete', 'share'],
			defaultPermissions: {
				read: [],
				update: [],
				delete: []
			}
		});

		// Church configuration
		this.registerResourceConfig({
			type: 'church',
			validScopes: ['read', 'update', 'delete', 'manage', 'invite'],
			defaultPermissions: {
				read: [],
				update: [],
				delete: [],
				manage: []
			}
		});

		// Event configuration
		this.registerResourceConfig({
			type: 'event',
			validScopes: ['read', 'update', 'delete', 'register', 'manage'],
			defaultPermissions: {
				read: [],
				update: [],
				delete: []
			}
		});

		// User configuration
		this.registerResourceConfig({
			type: 'user',
			validScopes: ['read', 'update', 'delete', 'impersonate'],
			defaultPermissions: {
				read: [],
				update: [],
				delete: []
			}
		});
	}

	/**
	 * Register a resource configuration
	 */
	registerResourceConfig(config: ResourceConfig): void {
		this.resourceConfigs.set(config.type, config);
	}

	/**
	 * Get resource configuration
	 */
	private getResourceConfig(resourceType: ResourceType): ResourceConfig {
		const config = this.resourceConfigs.get(resourceType);
		if (!config) {
			// Return a default configuration for unknown resource types
			return {
				type: resourceType,
				validScopes: this.DEFAULT_SCOPES,
				defaultPermissions: {
					read: [],
					update: [],
					delete: []
				}
			};
		}
		return config;
	}

	/**
	 * Queue a resource creation event for Keycloak synchronization
	 */
	async enqueueResourceCreate<T extends Resource>(
		resource: T,
		resourceType: ResourceType,
		ownerId: string,
		options: KeycloakResourceCreateOptions = {}
	): Promise<void> {
		const config = this.getResourceConfig(resourceType);

		// Validate resource if validator is provided
		if (config.validateResource && !config.validateResource(resource)) {
			throw new Error(`Invalid resource of type ${resourceType}`);
		}

		// Transform resource if transformer is provided
		const transformedResource = config.transformResource
			? config.transformResource(resource)
			: resource;

		// Build permissions with defaults and options
		const defaultPerms = config.defaultPermissions || {};
		const permissions: KeycloakResourcePermissions = {
			read: [ownerId, ...(options.sharedReadWith || []), ...(defaultPerms.read || [])],
			update: [ownerId, ...(options.sharedUpdateWith || []), ...(defaultPerms.update || [])],
			delete: [ownerId, ...(options.sharedDeleteWith || []), ...(defaultPerms.delete || [])]
		};

		// Add any custom scopes from the resource config
		if (config.validScopes) {
			config.validScopes.forEach(scope => {
				if (!permissions[scope] && scope !== 'read' && scope !== 'update' && scope !== 'delete') {
					permissions[scope] = [ownerId];
				}
			});
		}

		const event: KeycloakOutboxEvent = {
			type: KEYCLOAK_EVENTS.RESOURCE_CREATE,
			payload: {
				resourceId: transformedResource.id,
				resourceType,
				ownerId,
				permissions,
				metadata: options.metadata
			},
			timestamp: Date.now(),
			correlationId: this.generateCorrelationId()
		};

		await this.outbox.enqueueCreate('keycloak_resource', transformedResource.id, event);
	}

	/**
	 * Queue a permission grant event
	 */
	async enqueuePermissionGrant(
		resourceId: string,
		resourceType: ResourceType,
		granteeId: string,
		scopes: string[],
		metadata?: Record<string, any>
	): Promise<void> {
		const config = this.getResourceConfig(resourceType);
		this.validateScopes(scopes, config.validScopes || this.DEFAULT_SCOPES);

		const event: KeycloakOutboxEvent = {
			type: KEYCLOAK_EVENTS.PERMISSION_GRANT,
			payload: {
				resourceId,
				resourceType,
				granteeId,
				scopes,
				metadata
			},
			timestamp: Date.now(),
			correlationId: this.generateCorrelationId()
		};

		await this.outbox.enqueueUpdate('keycloak_resource', resourceId, event);
	}

	/**
	 * Queue a permission revoke event
	 */
	async enqueuePermissionRevoke(
		resourceId: string,
		resourceType: ResourceType,
		revokeeId: string,
		scopes: string[],
		metadata?: Record<string, any>
	): Promise<void> {
		const config = this.getResourceConfig(resourceType);
		this.validateScopes(scopes, config.validScopes || this.DEFAULT_SCOPES);

		const event: KeycloakOutboxEvent = {
			type: KEYCLOAK_EVENTS.PERMISSION_REVOKE,
			payload: {
				resourceId,
				resourceType,
				revokeeId,
				scopes,
				metadata
			},
			timestamp: Date.now(),
			correlationId: this.generateCorrelationId()
		};

		await this.outbox.enqueueUpdate('keycloak_resource', resourceId, event);
	}

	/**
	 * Queue a bulk permission update event
	 */
	async enqueueBulkPermissionUpdate(
		resourceId: string,
		resourceType: ResourceType,
		permissions: KeycloakResourcePermissions,
		metadata?: Record<string, any>
	): Promise<void> {
		const event: KeycloakOutboxEvent = {
			type: KEYCLOAK_EVENTS.BULK_PERMISSION_UPDATE,
			payload: {
				resourceId,
				resourceType,
				permissions,
				metadata
			},
			timestamp: Date.now(),
			correlationId: this.generateCorrelationId()
		};

		await this.outbox.enqueueUpdate('keycloak_resource', resourceId, event);
	}

	/**
	 * Queue an ownership transfer event
	 */
	async enqueueOwnershipTransfer(
		resourceId: string,
		resourceType: ResourceType,
		currentOwnerId: string,
		newOwnerId: string,
		metadata?: Record<string, any>
	): Promise<void> {
		const event: KeycloakOutboxEvent = {
			type: KEYCLOAK_EVENTS.OWNERSHIP_TRANSFER,
			payload: {
				resourceId,
				resourceType,
				currentOwnerId,
				newOwnerId,
				metadata
			},
			timestamp: Date.now(),
			correlationId: this.generateCorrelationId()
		};

		await this.outbox.enqueueUpdate('keycloak_resource', resourceId, event);
	}

	/**
	 * Queue a resource deletion event
	 */
	async enqueueResourceDelete(
		resourceId: string,
		resourceType: ResourceType,
		metadata?: Record<string, any>
	): Promise<void> {
		const event: KeycloakOutboxEvent = {
			type: KEYCLOAK_EVENTS.RESOURCE_DELETE,
			payload: {
				resourceId,
				resourceType,
				metadata
			},
			timestamp: Date.now(),
			correlationId: this.generateCorrelationId()
		};

		await this.outbox.enqueueDelete('keycloak_resource', resourceId, event);
	}

	/**
	 * Batch enqueue multiple events
	 */
	async enqueueBatch(events: Array<{
		type: 'create' | 'update' | 'delete';
		resourceId: string;
		resourceType: ResourceType;
		event: KeycloakOutboxEvent;
	}>): Promise<void> {
		for (const item of events) {
			switch (item.type) {
				case 'create':
					await this.outbox.enqueueCreate('keycloak_resource', item.resourceId, item.event);
					break;
				case 'update':
					await this.outbox.enqueueUpdate('keycloak_resource', item.resourceId, item.event);
					break;
				case 'delete':
					await this.outbox.enqueueDelete('keycloak_resource', item.resourceId, item.event);
					break;
			}
		}
	}

	/**
	 * Validate event payload structure
	 */
	validateEventPayload(payload: KeycloakEventPayload): void {
		if (!payload.resourceId || payload.resourceId.trim() === '') {
			throw new Error('Invalid resourceId: cannot be empty');
		}

		if (!payload.resourceType || payload.resourceType.trim() === '') {
			throw new Error('Invalid resourceType: cannot be empty');
		}

		// Type-specific validations
		if ('granteeId' in payload && (!payload.granteeId || payload.granteeId.trim() === '')) {
			throw new Error('Invalid granteeId: cannot be empty');
		}

		if ('revokeeId' in payload && (!payload.revokeeId || payload.revokeeId.trim() === '')) {
			throw new Error('Invalid revokeeId: cannot be empty');
		}

		if ('ownerId' in payload && (!payload.ownerId || payload.ownerId.trim() === '')) {
			throw new Error('Invalid ownerId: cannot be empty');
		}

		if ('scopes' in payload && payload.scopes) {
			const config = this.getResourceConfig(payload.resourceType);
			this.validateScopes(payload.scopes, config.validScopes || this.DEFAULT_SCOPES);
		}
	}

	/**
	 * Validate scope values
	 */
	private validateScopes(scopes: string[], validScopes: string[]): void {
		for (const scope of scopes) {
			if (!validScopes.includes(scope)) {
				throw new Error(`Invalid scope: ${scope}. Valid scopes are: ${validScopes.join(', ')}`);
			}
		}
	}

	/**
	 * Generate a correlation ID for tracking events
	 */
	private generateCorrelationId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Create a specialized adapter for a specific resource type
	 */
	createSpecializedAdapter<T extends Resource>(
		resourceType: ResourceType,
		config?: Partial<ResourceConfig>
	): SpecializedKeycloakAdapter<T> {
		if (config) {
			this.registerResourceConfig({ ...config, type: resourceType });
		}
		return new SpecializedKeycloakAdapter<T>(this, resourceType);
	}
}

/**
 * Specialized adapter for a specific resource type
 */
export class SpecializedKeycloakAdapter<T extends Resource> {
	constructor(
		private readonly adapter: GeneralizedKeycloakOutboxAdapter,
		private readonly resourceType: ResourceType
	) {}

	async create(
		resource: T,
		ownerId: string,
		options?: KeycloakResourceCreateOptions
	): Promise<void> {
		return this.adapter.enqueueResourceCreate(resource, this.resourceType, ownerId, options);
	}

	async grantPermission(
		resourceId: string,
		granteeId: string,
		scopes: string[],
		metadata?: Record<string, any>
	): Promise<void> {
		return this.adapter.enqueuePermissionGrant(
			resourceId,
			this.resourceType,
			granteeId,
			scopes,
			metadata
		);
	}

	async revokePermission(
		resourceId: string,
		revokeeId: string,
		scopes: string[],
		metadata?: Record<string, any>
	): Promise<void> {
		return this.adapter.enqueuePermissionRevoke(
			resourceId,
			this.resourceType,
			revokeeId,
			scopes,
			metadata
		);
	}

	async updatePermissions(
		resourceId: string,
		permissions: KeycloakResourcePermissions,
		metadata?: Record<string, any>
	): Promise<void> {
		return this.adapter.enqueueBulkPermissionUpdate(
			resourceId,
			this.resourceType,
			permissions,
			metadata
		);
	}

	async transferOwnership(
		resourceId: string,
		currentOwnerId: string,
		newOwnerId: string,
		metadata?: Record<string, any>
	): Promise<void> {
		return this.adapter.enqueueOwnershipTransfer(
			resourceId,
			this.resourceType,
			currentOwnerId,
			newOwnerId,
			metadata
		);
	}

	async delete(resourceId: string, metadata?: Record<string, any>): Promise<void> {
		return this.adapter.enqueueResourceDelete(resourceId, this.resourceType, metadata);
	}
}