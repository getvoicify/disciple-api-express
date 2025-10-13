import {type OutboxEvent, type OutboxPublisher} from "../outbox";
import {type KeycloakResourceManager} from "./types";
import {
	KEYCLOAK_EVENTS,
	type KeycloakOutboxEvent,
	type KeycloakOwnershipTransferPayload,
	type KeycloakPermissionGrantPayload,
	type KeycloakPermissionRevokePayload,
	type KeycloakResourceCreatePayload,
	type KeycloakResourceDeletePayload
} from "./generalized-outbox.adapter";

/**
 * Publisher that processes Keycloak synchronization events from the outbox
 * Implements the OutboxPublisher interface to handle Keycloak resource management
 */
export class KeycloakOutboxPublisher implements OutboxPublisher<KeycloakOutboxEvent> {
	constructor(private readonly resourceManager: KeycloakResourceManager) {}

	async publish(event: OutboxEvent<KeycloakOutboxEvent>): Promise<void> {
		if (!event.payload) {
			throw new Error('Keycloak outbox event missing payload');
		}

		const { type, payload } = event.payload;

		try {
			switch (type) {
				case KEYCLOAK_EVENTS.RESOURCE_CREATE:
					await this.handleResourceCreate(payload as KeycloakResourceCreatePayload);
					break;

				case KEYCLOAK_EVENTS.RESOURCE_DELETE:
					await this.handleResourceDelete(payload as KeycloakResourceDeletePayload);
					break;

				case KEYCLOAK_EVENTS.PERMISSION_GRANT:
					await this.handlePermissionGrant(payload as KeycloakPermissionGrantPayload);
					break;

				case KEYCLOAK_EVENTS.PERMISSION_REVOKE:
					await this.handlePermissionRevoke(payload as KeycloakPermissionRevokePayload);
					break;

				case KEYCLOAK_EVENTS.OWNERSHIP_TRANSFER:
					await this.handleOwnershipTransfer(payload as KeycloakOwnershipTransferPayload);
					break;

				default:
					throw new Error(`Unsupported Keycloak event type: ${type}`);
			}
		} catch (error) {
			// Handle graceful errors that shouldn't cause retries
			if (error instanceof Error && this.isGracefulError(error)) {
				// Log the error but don't throw (prevents retry)
				console.warn(`Graceful error processing Keycloak event ${event.id}:`, error.message);
				return;
			}

			// Re-throw other errors to trigger retry mechanism
			throw error;
		}
	}

	private async handleResourceCreate(payload: KeycloakResourceCreatePayload): Promise<void> {
		// Build URIs based on resource type
		const uris = this.buildResourceUris(payload.resourceType, payload.resourceId);

		const resourceData = {
			id: payload.resourceId,
			name: payload.resourceId.replace(/-/g, '_'),
			type: payload.resourceType,
			ownerId: payload.ownerId,
			permissions: payload.permissions,
			uris: uris,
			// Include any additional metadata as attributes
			additionalAttributes: payload.metadata ?
				Object.entries(payload.metadata).reduce((acc, [key, value]) => {
					acc[key] = Array.isArray(value) ? value : [String(value)];
					return acc;
				}, {} as Record<string, string[]>) : undefined
		};

		try {
			await this.resourceManager.createResource(resourceData);
		} catch (error) {
			// Handle duplicate resource creation gracefully
			if (error instanceof Error &&
				(error.name === 'ResourceConflictError' || error.message?.includes('already exists'))) {
				console.warn(`Resource ${payload.resourceId} already exists in Keycloak, skipping creation`);
				return;
			}
			throw error;
		}
	}

	private async handleResourceDelete(payload: KeycloakResourceDeletePayload): Promise<void> {
		try {
			await this.resourceManager.deleteResource(payload.resourceId);
		} catch (error) {
			// Handle resource not found gracefully
			if (error instanceof Error &&
				(error.name === 'ResourceNotFoundError' || error.message?.includes('not found'))) {
				console.warn(`Resource ${payload.resourceId} not found in Keycloak, skipping deletion`);
				return;
			}
			throw error;
		}
	}

	private async handlePermissionGrant(payload: KeycloakPermissionGrantPayload): Promise<void> {
		await this.resourceManager.grantPermission(
			payload.resourceId,
			payload.granteeId,
			payload.scopes
		);
	}

	private async handlePermissionRevoke(payload: KeycloakPermissionRevokePayload): Promise<void> {
		await this.resourceManager.revokePermission(
			payload.resourceId,
			payload.revokeeId,
			payload.scopes
		);
	}

	private async handleOwnershipTransfer(payload: KeycloakOwnershipTransferPayload): Promise<void> {
		await this.resourceManager.transferOwnership(
			payload.resourceId,
			payload.currentOwnerId,
			payload.newOwnerId
		);
	}

	/**
	 * Build URIs for a resource based on its type
	 * For notes, returns both /notes and /notes/{id}
	 * For other resources, returns /{type} and /{type}/{id}
	 */
	private buildResourceUris(resourceType: string, resourceId: string): string[] {
		const baseUri = `/${resourceType}`;
		const specificUri = `/${resourceType}/${resourceId}`;

		// Return both the collection URI and the specific resource URI
		return [baseUri, specificUri];
	}

	/**
	 * Determine if an error should be handled gracefully (no retry)
	 */
	private isGracefulError(error: Error): boolean {
		const gracefulErrorNames = [
			'ResourceConflictError',
			'ResourceNotFoundError'
		];

		const gracefulErrorMessages = [
			'already exists',
			'not found',
			'does not exist'
		];

		return gracefulErrorNames.includes(error.name) ||
			gracefulErrorMessages.some(msg => error.message?.toLowerCase().includes(msg));
	}
}
